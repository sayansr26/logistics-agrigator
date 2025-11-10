const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { PrismaClient } = require("@prisma/client");
const logger = require("../shared/lib/logger");
const { connectRedis, getRedisClient } = require("../config/redis");

const prisma = new PrismaClient();
const BATCH_SIZE = 1000; // Process in batches of 1000 records
const CSV_FILE_PATH = path.join(__dirname, "../data/merged_pincode_data.csv");

// Cache for states and cities to avoid duplicate database queries
const stateCache = new Map();
const cityCache = new Map();
const areaCache = new Map();

// Statistics tracking
const stats = {
  totalProcessed: 0,
  statesCreated: 0,
  citiesCreated: 0,
  areasCreated: 0,
  pincodesCreated: 0,
  errors: 0,
  startTime: Date.now(),
};

/**
 * Normalize string for database storage
 */
function normalizeString(str) {
  if (!str) return null;
  return str.toString().trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Generate state code from state name
 */
function generateStateCode(stateName) {
  if (!stateName) return "UNK";
  return stateName.replace(/[^A-Z]/g, "").substring(0, 10) || "UNK";
}

/**
 * Find or create state
 */
async function findOrCreateState(stateName) {
  const normalizedName = normalizeString(stateName);
  if (!normalizedName) return null;

  // Check cache first
  if (stateCache.has(normalizedName)) {
    return stateCache.get(normalizedName);
  }

  try {
    // Try to find existing state
    let state = await prisma.state.findFirst({
      where: { name: normalizedName },
    });

    if (!state) {
      // Create new state
      const stateCode = generateStateCode(normalizedName);
      state = await prisma.state.create({
        data: {
          name: normalizedName,
          code: stateCode,
        },
      });
      stats.statesCreated++;
      logger.info(`Created state: ${normalizedName} (${stateCode})`);
    }

    // Cache the result
    stateCache.set(normalizedName, state);
    return state;
  } catch (error) {
    logger.error(`Error creating state ${normalizedName}:`, error);
    return null;
  }
}

/**
 * Find or create city
 */
async function findOrCreateCity(cityName, stateId) {
  const normalizedName = normalizeString(cityName);
  if (!normalizedName || !stateId) return null;

  const cacheKey = `${stateId}_${normalizedName}`;

  // Check cache first
  if (cityCache.has(cacheKey)) {
    return cityCache.get(cacheKey);
  }

  try {
    // Try to find existing city
    let city = await prisma.city.findFirst({
      where: {
        name: normalizedName,
        stateId: stateId,
      },
    });

    if (!city) {
      // Create new city
      city = await prisma.city.create({
        data: {
          name: normalizedName,
          stateId: stateId,
        },
      });
      stats.citiesCreated++;
      logger.info(`Created city: ${normalizedName} in state ID ${stateId}`);
    }

    // Cache the result
    cityCache.set(cacheKey, city);
    return city;
  } catch (error) {
    logger.error(`Error creating city ${normalizedName}:`, error);
    return null;
  }
}

/**
 * Find or create area
 */
async function findOrCreateArea(areaName, cityId) {
  const normalizedName = normalizeString(areaName);
  if (!normalizedName || !cityId) return null;

  const cacheKey = `${cityId}_${normalizedName}`;

  // Check cache first
  if (areaCache.has(cacheKey)) {
    return areaCache.get(cacheKey);
  }

  try {
    // Try to find existing area
    let area = await prisma.area.findFirst({
      where: {
        name: normalizedName,
        cityId: cityId,
      },
    });

    if (!area) {
      // Create new area
      area = await prisma.area.create({
        data: {
          name: normalizedName,
          cityId: cityId,
        },
      });
      stats.areasCreated++;
      logger.info(`Created area: ${normalizedName} in city ID ${cityId}`);
    }

    // Cache the result
    areaCache.set(cacheKey, area);
    return area;
  } catch (error) {
    logger.error(`Error creating area ${normalizedName}:`, error);
    return null;
  }
}

/**
 * Process a batch of pincode records
 */
async function processBatch(records) {
  const pincodeData = [];

  for (const record of records) {
    try {
      // Skip if pincode is missing or invalid
      if (!record.pincode || record.pincode.length < 5) {
        stats.errors++;
        continue;
      }

      // Create geographical hierarchy
      const state = await findOrCreateState(record.state);
      if (!state) {
        stats.errors++;
        continue;
      }

      const city = await findOrCreateCity(record.district, state.id);
      if (!city) {
        stats.errors++;
        continue;
      }

      const area = await findOrCreateArea(record.area, city.id);
      if (!area) {
        stats.errors++;
        continue;
      }

      // Prepare pincode data
      const pincodeRecord = {
        areaId: area.id,
        stateId: state.id,
        code: record.pincode.toString().trim(),
        areaName: normalizeString(record.area),
        latitude:
          record.lat && !isNaN(parseFloat(record.lat))
            ? parseFloat(record.lat)
            : null,
        longitude:
          record.lng && !isNaN(parseFloat(record.lng))
            ? parseFloat(record.lng)
            : null,
        district: normalizeString(record.district),
      };

      pincodeData.push(pincodeRecord);
    } catch (error) {
      logger.error(`Error processing record:`, error);
      stats.errors++;
    }
  }

  // Bulk insert pincodes
  if (pincodeData.length > 0) {
    try {
      await prisma.pincode.createMany({
        data: pincodeData,
        skipDuplicates: true, // Skip duplicates to avoid conflicts
      });
      stats.pincodesCreated += pincodeData.length;
    } catch (error) {
      logger.error(`Error bulk inserting pincodes:`, error);
      stats.errors += pincodeData.length;
    }
  }

  stats.totalProcessed += records.length;
}

/**
 * Display progress and statistics
 */
function displayProgress() {
  const elapsedTime = (Date.now() - stats.startTime) / 1000;
  const recordsPerSecond = Math.round(stats.totalProcessed / elapsedTime);

  console.log(`\n📊 Import Progress:`);
  console.log(`   Total Processed: ${stats.totalProcessed.toLocaleString()}`);
  console.log(`   States Created: ${stats.statesCreated}`);
  console.log(`   Cities Created: ${stats.citiesCreated}`);
  console.log(`   Areas Created: ${stats.areasCreated}`);
  console.log(`   Pincodes Created: ${stats.pincodesCreated.toLocaleString()}`);
  console.log(`   Errors: ${stats.errors.toLocaleString()}`);
  console.log(`   Processing Speed: ${recordsPerSecond} records/sec`);
  console.log(`   Elapsed Time: ${Math.round(elapsedTime)}s`);
}

/**
 * Main import function
 */
async function importPincodeData() {
  logger.info("🚀 Starting pincode data import...");
  console.log("📁 Reading CSV file:", CSV_FILE_PATH);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found: ${CSV_FILE_PATH}`);
  }

  return new Promise((resolve, reject) => {
    const records = [];
    let batchCount = 0;

    const stream = fs
      .createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on("data", async (data) => {
        records.push(data);

        // Process when batch is full
        if (records.length === BATCH_SIZE) {
          stream.pause(); // Pause reading while processing

          const batch = records.splice(0, BATCH_SIZE);
          batchCount++;

          console.log(
            `\n🔄 Processing batch ${batchCount} (${batch.length} records)...`,
          );

          try {
            await processBatch(batch);
            displayProgress();
          } catch (error) {
            logger.error(`Error processing batch ${batchCount}:`, error);
            stats.errors += batch.length;
          }

          stream.resume(); // Resume reading
        }
      })
      .on("end", async () => {
        try {
          // Process remaining records
          if (records.length > 0) {
            batchCount++;
            console.log(
              `\n🔄 Processing final batch ${batchCount} (${records.length} records)...`,
            );
            await processBatch(records);
          }

          displayProgress();

          const totalTime = (Date.now() - stats.startTime) / 1000;
          console.log(`\n✅ Import completed successfully!`);
          console.log(`   Total Time: ${Math.round(totalTime)}s`);
          console.log(`   Final Statistics:`);
          console.log(
            `     - Records Processed: ${stats.totalProcessed.toLocaleString()}`,
          );
          console.log(`     - States Created: ${stats.statesCreated}`);
          console.log(`     - Cities Created: ${stats.citiesCreated}`);
          console.log(`     - Areas Created: ${stats.areasCreated}`);
          console.log(
            `     - Pincodes Created: ${stats.pincodesCreated.toLocaleString()}`,
          );
          console.log(`     - Errors: ${stats.errors.toLocaleString()}`);

          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Cleanup and validation
 */
async function validateImport() {
  console.log("\n🔍 Validating import...");

  const stateCount = await prisma.state.count();
  const cityCount = await prisma.city.count();
  const areaCount = await prisma.area.count();
  const pincodeCount = await prisma.pincode.count();

  console.log(`📊 Database Summary:`);
  console.log(`   States: ${stateCount}`);
  console.log(`   Cities: ${cityCount}`);
  console.log(`   Areas: ${areaCount}`);
  console.log(`   Pincodes: ${pincodeCount.toLocaleString()}`);

  // Sample validation
  const samplePincode = await prisma.pincode.findFirst({
    include: {
      area: {
        include: {
          city: {
            include: {
              state: true,
            },
          },
        },
      },
    },
  });

  if (samplePincode) {
    console.log(`\n📍 Sample Record:`);
    console.log(`   Pincode: ${samplePincode.pincode}`);
    console.log(`   Area: ${samplePincode.area.name}`);
    console.log(`   City: ${samplePincode.area.city.name}`);
    console.log(`   State: ${samplePincode.area.city.state.name}`);
    console.log(`   Type: ${samplePincode.type}`);
    console.log(
      `   Coordinates: ${samplePincode.latitude}, ${samplePincode.longitude}`,
    );
  }
}

/**
 * Clear Redis cache for geographical data
 */
async function clearGeographicalCache() {
  try {
    console.log("\n🗑️  Clearing geographical data cache...");

    const redis = getRedisClient();
    if (!redis) {
      console.log("   ⚠️  Redis client not available, skipping cache clear");
      return;
    }

    // Clear all geographical cache keys using SCAN for production safety
    const pattern = "geo:*";
    let cursor = 0;
    let totalKeysDeleted = 0;

    do {
      // Use SCAN to iterate through keys matching the pattern
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys;

      if (keys && keys.length > 0) {
        // Delete the keys found in this iteration
        await redis.del(keys);
        totalKeysDeleted += keys.length;
        console.log(
          `   🔄 Deleted ${keys.length} cache keys (total: ${totalKeysDeleted})`,
        );
      }
    } while (cursor !== 0);

    if (totalKeysDeleted > 0) {
      console.log(
        `   ✅ Successfully cleared ${totalKeysDeleted} geographical cache keys`,
      );
      logger.info("Cleared geographical cache after import", {
        keysCleared: totalKeysDeleted,
      });
    } else {
      console.log("   ℹ️  No cache keys found to clear");
      logger.info("No geographical cache keys found to clear");
    }
  } catch (error) {
    // Don't fail the import if cache clearing fails
    console.warn("   ⚠️  Failed to clear cache:", error.message);
    logger.warn("Failed to clear geographical cache", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log("🏁 Starting Partner Services Pincode Import");
    console.log("=".repeat(50));

    // Connect to Redis for cache clearing at the end
    console.log("\n🔌 Connecting to Redis...");
    await connectRedis();
    console.log("✅ Redis connected successfully");

    await importPincodeData();
    await validateImport();
    await clearGeographicalCache();

    console.log("\n🎉 Import process completed successfully!");
  } catch (error) {
    logger.error("❌ Import failed:", error);
    console.error("❌ Import failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    // Close Redis connection
    const redis = getRedisClient();
    if (redis) {
      await redis.quit();
      console.log("✅ Redis connection closed");
    }
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { importPincodeData, validateImport, main };
