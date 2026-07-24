/**
 * Classify Cities  (Government MoF X / Y / Z HRA classification)
 *
 * Sets `cityClass` (X/Y/Z) and `isMetro` on every city in the DB using the
 * official Ministry of Finance HRA city classification, read from
 * data/city-classification.json.
 *
 *   X = metro urban agglomeration  -> isMetro = true
 *   Y = tier-2 city                -> isMetro = false
 *   Z = everything else            -> isMetro = false
 *
 * Our "cities" are India Post DISTRICTS, and a metro agglomeration spans
 * several districts, so X is matched by (state + district-name substring) and
 * Y by district-name substring — this flags the whole metro region, nationwide,
 * not just a single exactly-named district.
 *
 * Idempotent and safe to re-run.
 *
 * Usage (inside the partner-service container):
 *   node scripts/classify-cities.js
 *   yarn classify:cities
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

let logger;
try {
  logger = require("../shared/lib/logger");
} catch {
  logger = console;
}

const prisma = new PrismaClient();
const CLASS_FILE = path.join(__dirname, "../data/city-classification.json");

const norm = (s) => (s || "").toString().trim().toUpperCase();

/**
 * Decide the class of one city given the loaded reference data.
 * Returns "X", "Y" or "Z".
 */
function classifyCity(cityName, stateName, ref) {
  const city = norm(cityName);
  const state = norm(stateName);

  // X (metro): state must match the agglomeration and the district name must
  // contain one of its matchers.
  for (const ua of ref.X.agglomerations) {
    const states = ua.states.map(norm);
    if (!states.includes(state)) continue;
    for (const m of ua.districtMatchers) {
      if (city.includes(norm(m))) return "X";
    }
  }

  // Y (tier-2): district name contains a Y city fragment.
  for (const m of ref.Y.nameMatchers) {
    if (city.includes(norm(m))) return "Y";
  }

  return "Z";
}

async function main() {
  console.log("🏁 Classifying cities (MoF X/Y/Z HRA classification)");
  console.log("=".repeat(55));

  if (!fs.existsSync(CLASS_FILE)) {
    console.error(`❌ Missing reference file: ${CLASS_FILE}`);
    process.exit(1);
  }
  const ref = JSON.parse(fs.readFileSync(CLASS_FILE, "utf-8"));

  const cities = await prisma.city.findMany({
    include: { state: { select: { name: true } } },
  });
  console.log(`📦 Cities to classify: ${cities.length.toLocaleString()}`);

  const buckets = { X: [], Y: [], Z: [] };
  const updates = [];

  for (const c of cities) {
    const cls = classifyCity(c.name, c.state?.name, ref);
    buckets[cls].push(c.name);
    const isMetro = cls === "X";
    // Only write when something actually changed (keeps re-runs cheap).
    if (c.cityClass !== cls || c.isMetro !== isMetro) {
      updates.push(
        prisma.city.update({
          where: { id: c.id },
          data: { cityClass: cls, isMetro },
        }),
      );
    }
  }

  if (updates.length) {
    // Chunk the updates to avoid an oversized transaction.
    const CHUNK = 500;
    for (let i = 0; i < updates.length; i += CHUNK) {
      await prisma.$transaction(updates.slice(i, i + CHUNK));
      console.log(
        `   updated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`,
      );
    }
  }

  console.log("\n✅ Classification complete");
  console.log(`   X (Metro)  : ${buckets.X.length}`);
  console.log(`   Y (Tier-2) : ${buckets.Y.length}`);
  console.log(`   Z (Other)  : ${buckets.Z.length}`);
  console.log(`   Rows changed: ${updates.length}`);
  console.log(`\n   Metro cities/districts flagged:`);
  console.log(
    "   " + buckets.X.sort().join(", ") || "   (none — check reference data)",
  );

  // Clear geography cache so the new isMetro values are served immediately.
  try {
    const { getRedisClient, connectRedis } = require("../config/redis");
    await connectRedis();
    const redis = getRedisClient();
    if (redis) {
      let cursor = 0;
      let deleted = 0;
      do {
        const res = await redis.scan(cursor, { MATCH: "geo:*", COUNT: 100 });
        cursor = res.cursor;
        if (res.keys?.length) {
          await redis.del(res.keys);
          deleted += res.keys.length;
        }
      } while (cursor !== 0);
      console.log(`\n🗑️  Cleared ${deleted} geo cache key(s).`);
      await redis.quit();
    }
  } catch (e) {
    console.warn("⚠️  Could not clear geo cache:", e.message);
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      logger.error("Classification failed:", err);
      console.error("❌ Failed:", err.message);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { classifyCity, main };
