/**
 * Zone Data Purge Script
 *
 * Purpose: Clean slate zone data purge for Zone System v2 migration
 * Run this ONCE before applying the zone_system_v2 migration to avoid FK conflicts
 *
 * Usage:
 *   cd backend/partner-service
 *   node scripts/purge-zone-data.js
 *
 * WARNING: This will DELETE ALL zone-related data. Make sure to backup if needed!
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function purgeZoneData() {
  console.log("🚨 Zone Data Purge Script - Zone System v2 Migration");
  console.log("=".repeat(60));
  console.log(
    "This script will DELETE ALL zone-related data for clean-slate migration.",
  );
  console.log("");

  try {
    // Start transaction for atomic deletion
    await prisma.$transaction(async (tx) => {
      // 1. Delete zone services (if table still exists)
      try {
        const zoneServicesCount = await tx.$executeRaw`
          DELETE FROM zone_services WHERE 1=1
        `;
        console.log(`✓ Deleted ${zoneServicesCount} zone_services records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log(
            "⚠ zone_services table does not exist (already dropped)",
          );
        } else {
          console.log(`⚠ zone_services: ${e.message}`);
        }
      }

      // 2. Delete zone pincodes
      try {
        const zonePincodesCount = await tx.$executeRaw`
          DELETE FROM zone_pincodes WHERE 1=1
        `;
        console.log(`✓ Deleted ${zonePincodesCount} zone_pincodes records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log("⚠ zone_pincodes table does not exist");
        } else {
          console.log(`⚠ zone_pincodes: ${e.message}`);
        }
      }

      // 3. Delete zone areas
      try {
        const zoneAreasCount = await tx.$executeRaw`
          DELETE FROM zone_areas WHERE 1=1
        `;
        console.log(`✓ Deleted ${zoneAreasCount} zone_areas records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log("⚠ zone_areas table does not exist");
        } else {
          console.log(`⚠ zone_areas: ${e.message}`);
        }
      }

      // 4. Delete zone cities
      try {
        const zoneCitiesCount = await tx.$executeRaw`
          DELETE FROM zone_cities WHERE 1=1
        `;
        console.log(`✓ Deleted ${zoneCitiesCount} zone_cities records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log("⚠ zone_cities table does not exist");
        } else {
          console.log(`⚠ zone_cities: ${e.message}`);
        }
      }

      // 5. Delete zone states
      try {
        const zoneStatesCount = await tx.$executeRaw`
          DELETE FROM zone_states WHERE 1=1
        `;
        console.log(`✓ Deleted ${zoneStatesCount} zone_states records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log("⚠ zone_states table does not exist");
        } else {
          console.log(`⚠ zone_states: ${e.message}`);
        }
      }

      // 6. Delete zones (parent table - must be last)
      try {
        const zonesCount = await tx.$executeRaw`
          DELETE FROM zones WHERE 1=1
        `;
        console.log(`✓ Deleted ${zonesCount} zones records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log("⚠ zones table does not exist");
        } else {
          console.log(`⚠ zones: ${e.message}`);
        }
      }

      // 7. Delete service_types (global ServiceType table)
      try {
        const serviceTypesCount = await tx.$executeRaw`
          DELETE FROM service_types WHERE 1=1
        `;
        console.log(`✓ Deleted ${serviceTypesCount} service_types records`);
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log(
            "⚠ service_types table does not exist (already dropped)",
          );
        } else {
          console.log(`⚠ service_types: ${e.message}`);
        }
      }
    });

    console.log("");
    console.log("=".repeat(60));
    console.log("✅ Zone data purge completed successfully!");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Run: npx prisma migrate dev --name zone_system_v2");
    console.log("  2. Generate client: npx prisma generate");
    console.log("  3. Restart partner-service");
  } catch (error) {
    console.error("");
    console.error("❌ Error during zone data purge:", error.message);
    console.error("");
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  purgeZoneData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { purgeZoneData };
