// Use service-specific Prisma client (generated from partner-service schema)
const { PrismaClient } = require("@prisma/client");
const { prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client with partner-service models
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Partner Service: Prisma connected to PostgreSQL");
    return prisma;
  } catch (error) {
    console.error("Partner Service: Database connection failed:", error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("Partner Service: Prisma disconnected");
  } catch (error) {
    console.error("Partner Service: Error disconnecting from database:", error);
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  prismaHelpers,
};
