// Use shared database utilities
const { createPrismaClient, prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client
const prisma = createPrismaClient({
  // Auth service specific options can go here
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
