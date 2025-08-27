// Use shared database utilities
const { createPrismaClient, prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client
const prisma = createPrismaClient({
  // Wallet service specific options can go here
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Wallet Service: Prisma connected to PostgreSQL");
    return prisma;
  } catch (error) {
    console.error("Wallet Service: Database connection failed:", error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("Wallet Service: Prisma disconnected");
  } catch (error) {
    console.error("Wallet Service: Error disconnecting from database:", error);
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  prismaHelpers,
};
