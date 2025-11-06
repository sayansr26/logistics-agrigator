import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Predefined service types to seed the database
 */
const PREDEFINED_SERVICE_TYPES = [
  {
    name: "PICKUP",
    displayName: "Pickup Service",
    description: "Package pickup from customer location",
    category: "LOGISTICS",
    isChargeable: false,
    defaultCharge: null,
    configuration: {
      requiresApproval: false,
      autoAssignToZones: true,
      applicableRegions: ["ALL"],
    },
    status: "ACTIVE",
    sortOrder: 10,
  },
  {
    name: "DELIVERY",
    displayName: "Delivery Service",
    description: "Package delivery to destination",
    category: "LOGISTICS",
    isChargeable: false,
    defaultCharge: null,
    configuration: {
      requiresApproval: false,
      autoAssignToZones: true,
      applicableRegions: ["ALL"],
    },
    status: "ACTIVE",
    sortOrder: 20,
  },
  {
    name: "COD",
    displayName: "Cash on Delivery",
    description: "Cash collection on delivery",
    category: "PAYMENT",
    isChargeable: true,
    defaultCharge: 25.0,
    configuration: {
      requiresApproval: false,
      autoAssignToZones: false,
      chargeCalculationMethod: "PERCENTAGE",
      minimumCharge: 10.0,
      maximumCharge: 100.0,
      applicableRegions: ["DOMESTIC"],
    },
    status: "ACTIVE",
    sortOrder: 30,
  },
  {
    name: "PREPAID",
    displayName: "Prepaid Service",
    description: "Prepaid shipment processing",
    category: "PAYMENT",
    isChargeable: false,
    defaultCharge: null,
    configuration: {
      requiresApproval: false,
      autoAssignToZones: true,
      applicableRegions: ["ALL"],
    },
    status: "ACTIVE",
    sortOrder: 40,
  },
  {
    name: "ODA",
    displayName: "Out of Delivery Area",
    description: "Additional service for remote locations",
    category: "LOCATION",
    isChargeable: true,
    defaultCharge: 50.0,
    configuration: {
      requiresApproval: true,
      autoAssignToZones: false,
      chargeCalculationMethod: "FIXED",
      minimumCharge: 25.0,
      maximumCharge: 200.0,
      applicableRegions: ["REMOTE"],
    },
    status: "ACTIVE",
    sortOrder: 50,
  },
  {
    name: "HILLS",
    displayName: "Hill Station Delivery",
    description: "Special handling for hill station deliveries",
    category: "SPECIAL",
    isChargeable: true,
    defaultCharge: 75.0,
    configuration: {
      requiresApproval: true,
      autoAssignToZones: false,
      chargeCalculationMethod: "FIXED",
      minimumCharge: 50.0,
      maximumCharge: 150.0,
      applicableRegions: ["HILLS"],
      restrictions: {
        maxWeight: 10,
        prohibitedItems: ["FRAGILE", "LIQUID"],
      },
    },
    status: "ACTIVE",
    sortOrder: 60,
  },
];

/**
 * Seed the service types table with predefined service types
 */
async function seedServiceTypes() {
  console.log("🌱 Starting service types seeding...");

  try {
    // Check if service types already exist
    const existingCount = await prisma.serviceType.count();

    if (existingCount > 0) {
      console.log(
        `⚠️  Found ${existingCount} existing service types. Checking for updates...`,
      );

      // Update existing service types or create missing ones
      for (const serviceType of PREDEFINED_SERVICE_TYPES) {
        const existing = await prisma.serviceType.findUnique({
          where: { name: serviceType.name },
        });

        if (existing) {
          // Update existing service type with new configuration
          await prisma.serviceType.update({
            where: { name: serviceType.name },
            data: {
              displayName: serviceType.displayName,
              description: serviceType.description,
              category: serviceType.category,
              isChargeable: serviceType.isChargeable,
              defaultCharge: serviceType.defaultCharge,
              configuration: serviceType.configuration,
              status: serviceType.status,
              sortOrder: serviceType.sortOrder,
            },
          });
          console.log(`✅ Updated service type: ${serviceType.name}`);
        } else {
          // Create new service type
          await prisma.serviceType.create({
            data: serviceType,
          });
          console.log(`🆕 Created service type: ${serviceType.name}`);
        }
      }
    } else {
      // Create all service types in bulk
      await prisma.serviceType.createMany({
        data: PREDEFINED_SERVICE_TYPES,
        skipDuplicates: true,
      });
      console.log(
        `✅ Created ${PREDEFINED_SERVICE_TYPES.length} service types`,
      );
    }

    // Display final count
    const finalCount = await prisma.serviceType.count();
    console.log(`📊 Total service types in database: ${finalCount}`);

    // Display all service types
    const allServiceTypes = await prisma.serviceType.findMany({
      orderBy: { sortOrder: "asc" },
    });

    console.log("\n📋 Available Service Types:");
    console.log("═".repeat(80));
    allServiceTypes.forEach((st) => {
      const charge = st.isChargeable ? `₹${st.defaultCharge}` : "Free";
      console.log(
        `${st.sortOrder.toString().padStart(2)}) ${st.name.padEnd(10)} - ${st.displayName.padEnd(25)} [${st.category}] (${charge})`,
      );
    });
    console.log("═".repeat(80));

    console.log("🎉 Service types seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding service types:", error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await seedServiceTypes();
  } catch (error) {
    console.error("💥 Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { seedServiceTypes, PREDEFINED_SERVICE_TYPES };
