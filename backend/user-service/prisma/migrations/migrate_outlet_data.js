/**
 * Migration Script: Migrate Outlet Data from Customer to Outlet Table
 * 
 * This script migrates existing Customer records with customerType=OUTLET
 * to the new Outlet table, preserving the same UUIDs.
 * 
 * Run this script inside the Docker container AFTER running Prisma migrations:
 * docker exec logistics-user-service node prisma/migrations/migrate_outlet_data.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrateOutletData() {
  console.log("Starting outlet data migration...");

  try {
    // Find all customers with customerType = OUTLET
    const outletCustomers = await prisma.$queryRaw`
      SELECT * FROM customers WHERE customer_type = 'OUTLET'
    `;

    console.log(`Found ${outletCustomers.length} outlet records to migrate.`);

    if (outletCustomers.length === 0) {
      console.log("No outlet records to migrate. Migration complete.");
      return;
    }

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      for (const outletCustomer of outletCustomers) {
        console.log(`Migrating outlet: ${outletCustomer.outlet_code || outletCustomer.name}`);

        // Check if outlet already exists (idempotent migration)
        const existingOutlet = await tx.$queryRaw`
          SELECT id FROM outlets WHERE id = ${outletCustomer.id}::uuid
        `;

        if (existingOutlet.length > 0) {
          console.log(`  Outlet ${outletCustomer.id} already migrated, skipping.`);
          continue;
        }

        // Map outlet status
        let outletStatus = "ACTIVE";
        if (outletCustomer.outlet_status) {
          const statusMap = {
            active: "ACTIVE",
            inactive: "INACTIVE",
            suspended: "SUSPENDED",
            pending: "PENDING",
          };
          outletStatus = statusMap[outletCustomer.outlet_status.toLowerCase()] || "ACTIVE";
        }

        // Map outlet type
        let outletType = "RETAIL";
        if (outletCustomer.outlet_type) {
          const typeMap = {
            retail: "RETAIL",
            franchise: "FRANCHISE",
            warehouse: "WAREHOUSE",
            direct: "DIRECT",
          };
          outletType = typeMap[outletCustomer.outlet_type.toLowerCase()] || "RETAIL";
        }

        // Create the outlet with the same ID as the customer
        await tx.$executeRaw`
          INSERT INTO outlets (
            id,
            outlet_code,
            name,
            contact_person,
            email,
            phone,
            outlet_type,
            outlet_status,
            address,
            city,
            state,
            pincode,
            country,
            gst_number,
            pan_number,
            bank_details,
            is_active,
            created_at,
            updated_at
          ) VALUES (
            ${outletCustomer.id}::uuid,
            ${outletCustomer.outlet_code || `OUT-${Date.now()}`},
            ${outletCustomer.outlet_name || outletCustomer.name},
            ${outletCustomer.contact_person},
            ${outletCustomer.email},
            ${outletCustomer.phone},
            ${outletType}::"OutletType",
            ${outletStatus}::"OutletStatus",
            ${outletCustomer.address},
            ${outletCustomer.city},
            ${outletCustomer.state},
            ${outletCustomer.pincode},
            ${outletCustomer.country || "India"},
            ${outletCustomer.gst_number},
            ${outletCustomer.pan_number},
            ${outletCustomer.bank_details},
            ${outletCustomer.is_active},
            ${outletCustomer.created_at},
            NOW()
          )
        `;

        console.log(`  Outlet created with ID: ${outletCustomer.id}`);

        // Migrate any UserProfiles that were linked to this customer as outlet users
        // by setting their outletId
        await tx.$executeRaw`
          UPDATE user_profiles 
          SET outlet_id = ${outletCustomer.id}::uuid,
              outlet_role = customer_role
          WHERE customer_id = ${outletCustomer.id}::uuid
            AND customer_role IN ('customer', 'customer_account', 'customer_sales', 'customer_support')
        `;

        // Migrate CustomerUser records to OutletUser
        const customerUsers = await tx.$queryRaw`
          SELECT * FROM customer_users WHERE customer_id = ${outletCustomer.id}::uuid
        `;

        for (const cu of customerUsers) {
          // Map customer role to outlet role
          let outletRole = "outlet_staff";
          if (cu.role === "customer") {
            outletRole = "outlet_admin";
          }

          // Check if OutletUser already exists
          const existingOU = await tx.$queryRaw`
            SELECT id FROM outlet_users 
            WHERE outlet_id = ${outletCustomer.id}::uuid AND user_id = ${cu.user_id}::uuid
          `;

          if (existingOU.length === 0) {
            await tx.$executeRaw`
              INSERT INTO outlet_users (
                id,
                outlet_id,
                user_id,
                role,
                enabled_modules,
                is_active,
                created_at,
                updated_at
              ) VALUES (
                gen_random_uuid(),
                ${outletCustomer.id}::uuid,
                ${cu.user_id}::uuid,
                ${outletRole},
                ${cu.enabled_modules},
                ${cu.is_active},
                ${cu.created_at},
                NOW()
              )
            `;
            console.log(`  Created OutletUser for user ${cu.user_id}`);
          }
        }

        console.log(`  Migration completed for outlet: ${outletCustomer.outlet_code || outletCustomer.name}`);
      }
    });

    console.log("\n✅ Outlet data migration completed successfully!");
    console.log("\nNote: The old Customer records with customerType=OUTLET are preserved.");
    console.log("Once you verify the migration, you can optionally remove them or keep for reference.");

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateOutletData()
  .then(() => {
    console.log("Migration script finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });

