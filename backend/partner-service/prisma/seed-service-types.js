/**
 * Seed Script for Service Types
 * Populates initial logistics service types
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const initialServiceTypes = [
  {
    name: "COD",
    displayName: "Cash on Delivery",
    category: "PAYMENT",
    description: "Cash payment at the time of delivery",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 1,
    additionalInfo: {
      processingTime: "Same day",
      supportedCouriers: ["all"],
    },
  },
  {
    name: "PREPAID",
    displayName: "Prepaid Service",
    category: "PAYMENT",
    description: "Payment made in advance before shipment",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 2,
    additionalInfo: {
      processingTime: "Instant",
      supportedCouriers: ["all"],
    },
  },
  {
    name: "EXPRESS",
    displayName: "Express Delivery",
    category: "LOGISTICS",
    description: "Fast delivery service with guaranteed time slots",
    isAvailable: true,
    baseCharge: "50",
    sortOrder: 3,
    additionalInfo: {
      deliveryTime: "Same day or next day",
      cutoffTime: "14:00",
    },
  },
  {
    name: "STANDARD",
    displayName: "Standard Delivery",
    category: "LOGISTICS",
    description: "Regular delivery service with standard timing",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 4,
    additionalInfo: {
      deliveryTime: "3-5 business days",
    },
  },
  {
    name: "PICKUP",
    displayName: "Pickup Service",
    category: "LOCATION",
    description: "Package pickup from customer location",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 5,
    additionalInfo: {
      availableSlots: ["10:00-12:00", "14:00-16:00", "16:00-18:00"],
    },
  },
];

async function seedServiceTypes() {
  console.log("Starting service types seeding...");

  try {
    for (const serviceType of initialServiceTypes) {
      const existing = await prisma.serviceType.findUnique({
        where: { name: serviceType.name },
      });

      if (existing) {
        console.log(
          `✓ Service type '${serviceType.name}' already exists, skipping...`,
        );
        continue;
      }

      await prisma.serviceType.create({
        data: serviceType,
      });

      console.log(
        `✓ Created service type: ${serviceType.name} (${serviceType.displayName})`,
      );
    }

    console.log("\n✅ Service types seeding completed successfully!");
    console.log(`📊 Total service types: ${initialServiceTypes.length}`);

    // Display summary
    const count = await prisma.serviceType.count();
    const types = await prisma.serviceType.findMany({
      orderBy: { sortOrder: "asc" },
    });

    console.log("\n📋 Current Service Types:");
    types.forEach((type) => {
      console.log(
        `   ${type.sortOrder}. ${type.name} - ${type.displayName} (${type.category})`,
      );
    });
  } catch (error) {
    console.error("❌ Error seeding service types:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedServiceTypes()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { seedServiceTypes };
