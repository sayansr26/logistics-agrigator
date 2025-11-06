/**
 * Geographical Data Seeder
 *
 * Loads Indian geographical hierarchy data from IN.txt file:
 * - 36+ States/UTs
 * - 4000+ Districts (as Cities)
 * - 15000+ Sub-districts/Areas
 * - 19,300+ Pincodes with lat/lng coordinates
 *
 * Data Source: external_partner_service/pincode-api/IN.txt
 * Format: Tab-separated values (TSV)
 * Columns: country_code, pincode, area, state, state_code, district,
 *          district_code, sub_district, latitude, longitude, accuracy
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { PrismaClient } = require("@prisma/client");

// Create Prisma client for seeding
const prisma = new PrismaClient({
  log: ["warn", "error"],
});

// Statistics tracking
const stats = {
  linesProcessed: 0,
  statesCreated: 0,
  citiesCreated: 0,
  areasCreated: 0,
  pincodesCreated: 0,
  errors: 0,
  startTime: Date.now(),
};

// In-memory caches to avoid duplicate database lookups
const stateCache = new Map();
const cityCache = new Map();
const areaCache = new Map();
const pincodeCache = new Set();

// State code to name mapping (Indian states and UTs)
// eslint-disable-next-line no-unused-vars
const STATE_CODES = {
  "01": "Andaman & Nicobar Islands",
  "02": "Andhra Pradesh",
  "03": "Arunachal Pradesh",
  "04": "Assam",
  "05": "Bihar",
  "06": "Chandigarh",
  "07": "Dadra & Nagar Haveli and Daman & Diu",
  "08": "Delhi",
  "09": "Goa",
  10: "Gujarat",
  11: "Haryana",
  12: "Himachal Pradesh",
  13: "Jammu & Kashmir",
  14: "Jharkhand",
  15: "Karnataka",
  16: "Kerala",
  17: "Ladakh",
  18: "Lakshadweep",
  19: "Madhya Pradesh",
  20: "Maharashtra",
  21: "Manipur",
  22: "Meghalaya",
  23: "Mizoram",
  24: "Nagaland",
  25: "Odisha",
  26: "Puducherry",
  27: "Punjab",
  28: "Rajasthan",
  29: "Sikkim",
  30: "Tamil Nadu",
  31: "Telangana",
  32: "Tripura",
  33: "Uttar Pradesh",
  34: "Uttarakhand",
  35: "West Bengal",
};

/**
 * Parse a TSV line from IN.txt
 */
function parseLine(line) {
  const parts = line.split("\t");

  if (parts.length < 11) {
    return null; // Invalid line
  }

  return {
    countryCode: parts[0]?.trim() || "IN",
    pincode: parts[1]?.trim(),
    areaName: parts[2]?.trim(),
    stateName: parts[3]?.trim(),
    stateCode: parts[4]?.trim(),
    districtName: parts[5]?.trim(),
    districtCode: parts[6]?.trim(),
    subDistrict: parts[7]?.trim(),
    latitude: parts[8]?.trim(),
    longitude: parts[9]?.trim(),
    accuracy: parts[10]?.trim(),
  };
}

/**
 * Normalize string for consistent comparison
 */
function normalize(str) {
  return str?.trim().replace(/\s+/g, " ").toLowerCase() || "";
}

/**
 * Get or create state
 */
async function getOrCreateState(stateName, stateCode) {
  const normalizedName = normalize(stateName);
  const cacheKey = `${normalizedName}_${stateCode}`;

  // Check cache first
  if (stateCache.has(cacheKey)) {
    return stateCache.get(cacheKey);
  }

  try {
    // Try to find existing state
    let state = await prisma.state.findFirst({
      where: {
        OR: [
          { code: stateCode },
          { name: { equals: stateName, mode: "insensitive" } },
        ],
      },
    });

    // Create if not exists
    if (!state) {
      state = await prisma.state.create({
        data: {
          name: stateName,
          code: stateCode,
          status: true,
        },
      });
      stats.statesCreated++;
      console.log(`✓ Created state: ${stateName} (${stateCode})`);
    }

    stateCache.set(cacheKey, state);
    return state;
  } catch (error) {
    console.error(`Error creating state ${stateName}:`, error.message);
    throw error;
  }
}

/**
 * Get or create city (district)
 */
async function getOrCreateCity(stateId, cityName, cityCode) {
  const normalizedName = normalize(cityName);
  const cacheKey = `${stateId}_${normalizedName}_${cityCode}`;

  // Check cache first
  if (cityCache.has(cacheKey)) {
    return cityCache.get(cacheKey);
  }

  try {
    // Try to find existing city
    let city = await prisma.city.findFirst({
      where: {
        stateId: stateId,
        name: { equals: cityName, mode: "insensitive" },
      },
    });

    // Create if not exists
    if (!city) {
      city = await prisma.city.create({
        data: {
          stateId: stateId,
          name: cityName,
          code: cityCode || null,
          status: true,
        },
      });
      stats.citiesCreated++;

      if (stats.citiesCreated % 100 === 0) {
        console.log(`✓ Created ${stats.citiesCreated} cities...`);
      }
    }

    cityCache.set(cacheKey, city);
    return city;
  } catch (error) {
    console.error(`Error creating city ${cityName}:`, error.message);
    throw error;
  }
}

/**
 * Get or create area (sub-district)
 */
async function getOrCreateArea(cityId, areaName) {
  if (!areaName || areaName.trim() === "") {
    return null; // No area specified
  }

  const normalizedName = normalize(areaName);
  const cacheKey = `${cityId}_${normalizedName}`;

  // Check cache first
  if (areaCache.has(cacheKey)) {
    return areaCache.get(cacheKey);
  }

  try {
    // Try to find existing area
    let area = await prisma.area.findFirst({
      where: {
        cityId: cityId,
        name: { equals: areaName, mode: "insensitive" },
      },
    });

    // Create if not exists
    if (!area) {
      area = await prisma.area.create({
        data: {
          cityId: cityId,
          name: areaName,
          status: true,
        },
      });
      stats.areasCreated++;

      if (stats.areasCreated % 500 === 0) {
        console.log(`✓ Created ${stats.areasCreated} areas...`);
      }
    }

    areaCache.set(cacheKey, area);
    return area;
  } catch (error) {
    console.error(`Error creating area ${areaName}:`, error.message);
    throw error;
  }
}

/**
 * Create pincode entry
 */
async function createPincode(data) {
  const {
    pincode,
    areaName,
    stateName,
    stateCode,
    districtName,
    districtCode,
    subDistrict,
    latitude,
    longitude,
  } = data;

  // Skip if already processed
  if (pincodeCache.has(pincode)) {
    return;
  }

  try {
    // Get or create state
    const state = await getOrCreateState(stateName, stateCode);

    // Get or create city (district)
    const city = await getOrCreateCity(state.id, districtName, districtCode);

    // Get or create area (sub-district or area name)
    const areaToUse =
      subDistrict && subDistrict.trim() !== "" ? subDistrict : areaName;
    const area = await getOrCreateArea(city.id, areaToUse);

    // Parse coordinates
    const lat = latitude && latitude !== "" ? parseFloat(latitude) : null;
    const lng = longitude && longitude !== "" ? parseFloat(longitude) : null;

    // Check if pincode already exists
    const existingPincode = await prisma.pincode.findUnique({
      where: { code: pincode },
    });

    if (existingPincode) {
      pincodeCache.add(pincode);
      return; // Already exists
    }

    // Determine ODA and Hill applicability based on location
    const odaApplicable = isODAApplicable(stateName, districtName);
    const hillApplicable = isHillArea(stateName, districtName, areaName);

    // Create pincode
    await prisma.pincode.create({
      data: {
        code: pincode,
        stateId: state.id,
        areaId: area?.id || null,
        areaName: areaName,
        district: districtName,
        latitude: lat,
        longitude: lng,
        odaApplicable: odaApplicable,
        hillApplicable: hillApplicable,
        status: true,
      },
    });

    stats.pincodesCreated++;
    pincodeCache.add(pincode);

    // Progress logging
    if (stats.pincodesCreated % 1000 === 0) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      const rate = (stats.pincodesCreated / elapsed).toFixed(0);
      console.log(
        `✓ Created ${stats.pincodesCreated} pincodes (${rate}/sec)...`,
      );
    }
  } catch (error) {
    console.error(`Error creating pincode ${pincode}:`, error.message);
    stats.errors++;
  }
}

/**
 * Determine if area is ODA (Out of Delivery Area)
 * Based on remote locations and island territories
 */
function isODAApplicable(stateName, districtName) {
  const odaStates = [
    "Andaman & Nicobar Islands",
    "Lakshadweep",
    "Arunachal Pradesh",
    "Sikkim",
    "Mizoram",
    "Nagaland",
    "Manipur",
    "Meghalaya",
    "Tripura",
  ];

  const odaDistricts = [
    "Ladakh",
    "Kargil",
    "Leh",
    "Lahaul and Spiti",
    "Kinnaur",
  ];

  return (
    odaStates.some((s) => normalize(stateName).includes(normalize(s))) ||
    odaDistricts.some((d) => normalize(districtName).includes(normalize(d)))
  );
}

/**
 * Determine if area is in hill region
 */
function isHillArea(stateName, districtName, areaName) {
  const hillStates = [
    "Himachal Pradesh",
    "Uttarakhand",
    "Sikkim",
    "Arunachal Pradesh",
    "Jammu & Kashmir",
    "Ladakh",
  ];

  const hillKeywords = ["hill", "mountain", "ghat", "valley", "peak"];

  const stateIsHilly = hillStates.some((s) =>
    normalize(stateName).includes(normalize(s)),
  );
  const hasHillKeyword = hillKeywords.some(
    (k) =>
      normalize(districtName).includes(k) || normalize(areaName).includes(k),
  );

  return stateIsHilly || hasHillKeyword;
}

/**
 * Main seeding function
 */
async function seedGeographicalData() {
  console.log("\n🌍 Starting Geographical Data Seeding...\n");
  console.log("Source: external_partner_service/pincode-api/IN.txt");
  console.log("Target: partner-service database\n");

  // Try multiple paths (host vs Docker container)
  const possiblePaths = [
    path.join(
      __dirname,
      "../../../external_partner_service/pincode-api/IN.txt",
    ), // Host path
    path.join(__dirname, "../../external_partner_service/pincode-api/IN.txt"), // Docker path
    "/app/external_partner_service/pincode-api/IN.txt", // Absolute Docker path
  ];

  let filePath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      filePath = testPath;
      break;
    }
  }

  if (!filePath) {
    console.error("❌ Error: IN.txt file not found in any of these locations:");
    possiblePaths.forEach((p) => console.error(`   - ${p}`));
    console.error(
      "Please ensure external_partner_service directory is present",
    );
    process.exit(1);
  }

  console.log(`✓ Found data file: ${filePath}\n`);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  console.log("📖 Reading and processing data...\n");

  // Process line by line
  for await (const line of rl) {
    stats.linesProcessed++;

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Parse line
    const data = parseLine(line);

    if (!data || !data.pincode) {
      console.warn(`⚠️  Skipping invalid line ${stats.linesProcessed}`);
      stats.errors++;
      continue;
    }

    // Create pincode and related entities
    await createPincode(data);
  }

  console.log("\n✅ Data seeding completed!\n");
  printStatistics();
}

/**
 * Print final statistics
 */
function printStatistics() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);

  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 SEEDING STATISTICS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(
    `Total lines processed:    ${stats.linesProcessed.toLocaleString()}`,
  );
  console.log(`States created:           ${stats.statesCreated}`);
  console.log(
    `Cities created:           ${stats.citiesCreated.toLocaleString()}`,
  );
  console.log(
    `Areas created:            ${stats.areasCreated.toLocaleString()}`,
  );
  console.log(
    `Pincodes created:         ${stats.pincodesCreated.toLocaleString()}`,
  );
  console.log(`Errors encountered:       ${stats.errors}`);
  console.log(`Time elapsed:             ${elapsed}s`);
  console.log(
    `Processing rate:          ${(stats.linesProcessed / elapsed).toFixed(0)} lines/sec`,
  );
  console.log("═══════════════════════════════════════════════════════\n");
}

/**
 * Run seeder
 */
async function main() {
  try {
    await seedGeographicalData();
  } catch (error) {
    console.error("\n❌ Fatal error during seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("✓ Seed script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("✗ Seed script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedGeographicalData };
