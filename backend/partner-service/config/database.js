// Use shared database utilities
const { createPrismaClient, prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client
const prisma = createPrismaClient({
  // Partner service specific options can go here
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
