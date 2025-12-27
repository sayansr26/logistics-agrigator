// Use service-specific Prisma client (generated from user-service schema)
const { PrismaClient } = require("@prisma/client");
const { prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client with user-service models
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("User Service: Prisma connected to PostgreSQL");
    return prisma;
  } catch (error) {
    console.error("User Service: Database connection failed:", error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("User Service: Prisma disconnected");
  } catch (error) {
    console.error("User Service: Error disconnecting from database:", error);
  }
};

// Export getPrismaClient function for services
const getPrismaClient = () => {
  return prisma;
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  getPrismaClient,
  prismaHelpers,
};
