/**
 * Main Database Seeding Script for Auth Service
 *
 * This script seeds the database with:
 * 1. 120+ permissions across 12 modules
 * 2. Role-permission mappings for all 11 roles
 *
 * Usage:
 *   NODE_ENV=development node prisma/seed.js
 *   OR
 *   npx prisma db seed
 *
 * IMPORTANT: This script will clear existing permissions and role-permissions
 * in development mode. Use with caution!
 *
 * @module prisma/seed
 */

const { PrismaClient } = require("@prisma/client");
const { permissions } = require("./seeds/permissions");
const {
  seedRolePermissions,
  getRolePermissionSummary,
} = require("./seeds/rolePermissions");
const { seedSuperadmin } = require("./seeds/superadmin");

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

/**
 * Main seeding function
 */
async function main() {
  console.log("🌱 Starting database seeding...\n");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Database: ${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0] || "Unknown"}\n`,
  );

  try {
    // Step 1: Clear existing data (development only)
    if (process.env.NODE_ENV !== "production") {
      console.log("🧹 Clearing existing permission data...");
      await prisma.$transaction(async (tx) => {
        // Delete in correct order to respect foreign keys
        const deletedUserPerms = await tx.userPermission.deleteMany({});
        const deletedRolePerms = await tx.rolePermission.deleteMany({});
        const deletedPerms = await tx.permission.deleteMany({});

        console.log(`  ✓ Deleted ${deletedUserPerms.count} user permissions`);
        console.log(`  ✓ Deleted ${deletedRolePerms.count} role permissions`);
        console.log(`  ✓ Deleted ${deletedPerms.count} permissions`);
      });
    } else {
      console.log(
        "⚠️  PRODUCTION MODE: Skipping data deletion. Will use upsert instead.",
      );
    }

    // Step 2: Seed permissions
    console.log("\n📝 Seeding permissions...");
    const createdPermissions = await seedPermissions();
    console.log(`✅ Created ${createdPermissions.length} permissions`);

    // Display module breakdown
    const moduleBreakdown = createdPermissions.reduce((acc, perm) => {
      acc[perm.module] = (acc[perm.module] || 0) + 1;
      return acc;
    }, {});

    console.log("\n📊 Permissions by module:");
    Object.entries(moduleBreakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([module, count]) => {
        console.log(`  ${module.padEnd(15)} : ${count} permissions`);
      });

    // Step 3: Seed role-permission mappings
    const rolePermStats = await seedRolePermissions(prisma, createdPermissions);

    // Step 4: Seed superadmin user
    await seedSuperadmin(prisma);

    // Step 5: Display summary
    console.log("\n📈 Role-permission summary:");
    Object.entries(rolePermStats.byRole)
      .sort((a, b) => b[1] - a[1])
      .forEach(([role, count]) => {
        console.log(`  ${role.padEnd(20)} : ${count} permissions`);
      });

    // Step 6: Verify and display examples
    console.log("\n🔍 Verification - Sample permissions by role:");
    const summary = await getRolePermissionSummary(prisma);
    for (const [role, data] of Object.entries(summary)) {
      console.log(`\n  ${role.toUpperCase()} (${data.count} total):`);
      data.examples.forEach((example) => {
        console.log(`    - ${example}`);
      });
    }

    console.log("\n\n✅ Database seeding completed successfully!");
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total Permissions: ${createdPermissions.length}`);
    console.log(`   Total Role Mappings: ${rolePermStats.total}`);
    console.log(`   Roles Configured: 11`);
    console.log(`   Modules Covered: ${Object.keys(moduleBreakdown).length}`);
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    throw error;
  }
}

/**
 * Seed all permissions
 * @returns {Promise<Array>} Array of created permissions with IDs
 */
async function seedPermissions() {
  const createdPermissions = [];

  for (const permData of permissions) {
    try {
      const permission = await prisma.permission.upsert({
        where: {
          module_action_scope: {
            module: permData.module,
            action: permData.action,
            scope: permData.scope,
          },
        },
        update: {
          description: permData.description,
          isActive: true,
        },
        create: {
          module: permData.module,
          action: permData.action,
          scope: permData.scope,
          description: permData.description,
          isActive: true,
        },
      });

      createdPermissions.push(permission);
    } catch (error) {
      console.error(
        `Error creating permission ${permData.module}:${permData.action}:${permData.scope}:`,
        error.message,
      );
      throw error;
    }
  }

  return createdPermissions;
}

// Run the seeding
main()
  .catch((e) => {
    console.error("\n❌ Fatal error during database seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("\n🔌 Disconnecting from database...");
    await prisma.$disconnect();
    console.log("👋 Seeding script completed.\n");
  });

// Export for testing
module.exports = { main, seedPermissions };
