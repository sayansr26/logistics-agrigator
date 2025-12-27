// Use service-specific Prisma client (generated from auth-service schema)
const { PrismaClient } = require("@prisma/client");
const { prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client with auth-service models
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Auth Service: Prisma connected to PostgreSQL");
    return prisma;
  } catch (error) {
    console.error("Auth Service: Database connection failed:", error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("Auth Service: Prisma disconnected");
  } catch (error) {
    console.error("Auth Service: Error disconnecting from database:", error);
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  prismaHelpers,
};
