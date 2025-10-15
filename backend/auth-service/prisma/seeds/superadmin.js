/**
 * Superadmin User Seeding Script
 *
 * Creates the initial superadmin user for the system.
 * This user has full access to all system features.
 *
 * Default credentials:
 *   Email: admin@logistics.com
 *   Password: Admin@123456
 *
 * ⚠️ IMPORTANT: Change the password immediately after first login in production!
 *
 * @module prisma/seeds/superadmin
 */

const bcrypt = require("bcryptjs");

/**
 * Default superadmin credentials
 * CHANGE THESE IN PRODUCTION!
 */
const SUPERADMIN_DEFAULTS = {
  email: "admin@logistics.com",
  password: "Admin@123456", // Must meet password requirements
  role: "superadmin",
};

/**
 * Seed the superadmin user
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Promise<Object>} Created or existing superadmin user
 */
async function seedSuperadmin(prisma) {
  console.log("\n👤 Seeding superadmin user...");

  try {
    // Check if superadmin already exists
    const existingSuperadmin = await prisma.user.findUnique({
      where: { email: SUPERADMIN_DEFAULTS.email },
    });

    if (existingSuperadmin) {
      console.log(`✓ Superadmin already exists: ${SUPERADMIN_DEFAULTS.email}`);
      console.log(`  ID: ${existingSuperadmin.id}`);
      console.log(`  Role: ${existingSuperadmin.role}`);
      console.log(`  Active: ${existingSuperadmin.isActive}`);
      return existingSuperadmin;
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(SUPERADMIN_DEFAULTS.password, 10);

    // Create superadmin user
    const superadmin = await prisma.user.create({
      data: {
        email: SUPERADMIN_DEFAULTS.email,
        passwordHash,
        role: SUPERADMIN_DEFAULTS.role,
        isActive: true,
        twoFactorEnabled: false,
        accessLevel: "FULL",
        isLicenseActive: true, // Superadmin doesn't need license check
      },
    });

    console.log(`✅ Superadmin created successfully!`);
    console.log(`  Email: ${superadmin.email}`);
    console.log(`  Password: ${SUPERADMIN_DEFAULTS.password}`);
    console.log(`  ID: ${superadmin.id}`);
    console.log(
      `\n⚠️  IMPORTANT: Change password after first login in production!`,
    );

    return superadmin;
  } catch (error) {
    console.error("❌ Error seeding superadmin:", error.message);
    throw error;
  }
}

module.exports = { seedSuperadmin, SUPERADMIN_DEFAULTS };
