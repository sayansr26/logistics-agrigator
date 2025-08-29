// Use shared database utilities
const { createPrismaClient, prismaHelpers } = require("../shared/lib/database");

// Create service-specific Prisma client
const prisma = createPrismaClient({
  // Shipment service specific options can go here
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Shipment Service: Prisma connected to PostgreSQL");
    return prisma;
  } catch (error) {
    console.error("Shipment Service: Database connection failed:", error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("Shipment Service: Prisma disconnected");
  } catch (error) {
    console.error(
      "Shipment Service: Error disconnecting from database:",
      error,
    );
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  prismaHelpers,
};
