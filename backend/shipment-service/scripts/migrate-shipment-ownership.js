/**
 * One-time backfill: re-own shipments that were booked on behalf of an outlet.
 *
 * Historical bug: a shipment created by an admin/superadmin FOR an outlet was
 * stamped with the creator's userId, so the outlet (portal login and External
 * API alike) could never see its own parcels. Shipments created by outlet
 * sessions also stored the outlet USER id in outlet_id where every consumer
 * (re-rating, charges engine, invoices) expects the outlet ENTITY id.
 *
 * For every shipment with an outlet_id this script resolves the outlet via
 * user-service internal endpoints (the id may be an entity id OR a legacy
 * user id) and rewrites:
 *   - user_id   -> the outlet owner's user id
 *   - outlet_id -> the outlet entity id
 * Each change is recorded in audit_logs.
 *
 * Usage (inside the shipment-service container, where env vars exist):
 *   node scripts/migrate-shipment-ownership.js           # dry run (default)
 *   node scripts/migrate-shipment-ownership.js --apply   # write changes
 */

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "internal-service-secret";

const APPLY = process.argv.includes("--apply");

async function fetchOutlet(path) {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}${path}`, {
      headers: { "X-Internal-Request": INTERNAL_SECRET },
      timeout: 10000,
    });
    const data = response.data?.data;
    return data?.found ? data : null;
  } catch (error) {
    console.error(`  lookup failed ${path}: ${error.message}`);
    return null;
  }
}

/**
 * Resolve a stored outlet_id (entity id or legacy user id) to
 * { outletId, userId } or null when no outlet matches.
 */
async function resolveOutlet(storedId) {
  const byEntity = await fetchOutlet(
    `/api/v1/internal/outlets/${storedId}/badge`,
  );
  if (byEntity) return { outletId: byEntity.outletId, userId: byEntity.userId };

  const byUser = await fetchOutlet(
    `/api/v1/internal/outlets/by-user/${storedId}`,
  );
  if (byUser) return { outletId: byUser.outletId, userId: byUser.userId };

  return null;
}

async function main() {
  console.log(
    `Shipment ownership migration — ${APPLY ? "APPLY" : "DRY RUN"} mode`,
  );

  const shipments = await prisma.shipment.findMany({
    where: { outletId: { not: null } },
    select: { id: true, orderId: true, userId: true, outletId: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${shipments.length} shipment(s) carry an outlet_id`);

  const outletCache = new Map();
  let changed = 0;
  let skipped = 0;
  let unresolved = 0;
  let failed = 0;

  for (const shipment of shipments) {
    if (!outletCache.has(shipment.outletId)) {
      outletCache.set(
        shipment.outletId,
        await resolveOutlet(shipment.outletId),
      );
    }
    const outlet = outletCache.get(shipment.outletId);

    if (!outlet) {
      unresolved += 1;
      console.warn(
        `  UNRESOLVED ${shipment.orderId}: outlet_id ${shipment.outletId} matches no outlet`,
      );
      continue;
    }

    const next = { userId: outlet.userId, outletId: outlet.outletId };
    if (
      next.userId === shipment.userId &&
      next.outletId === shipment.outletId
    ) {
      skipped += 1;
      continue;
    }

    console.log(
      `  ${shipment.orderId}: user ${shipment.userId} -> ${next.userId}, outlet ${shipment.outletId} -> ${next.outletId}`,
    );

    if (!APPLY) {
      changed += 1;
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.shipment.update({
          where: { id: shipment.id },
          data: next,
        }),
        prisma.auditLog.create({
          data: {
            userId: null, // system migration, no acting user
            action: "UPDATE",
            resource: "Shipment",
            resourceId: shipment.id,
            changes: {
              reason:
                "migrate-shipment-ownership: re-own outlet bookings to the outlet owner",
              before: { userId: shipment.userId, outletId: shipment.outletId },
              after: next,
            },
            ipAddress: null,
            userAgent: "scripts/migrate-shipment-ownership.js",
          },
        }),
      ]);
      changed += 1;
    } catch (error) {
      failed += 1;
      console.error(`  FAILED ${shipment.orderId}: ${error.message}`);
    }
  }

  console.log(
    `Done. ${changed} ${APPLY ? "updated" : "would update"}, ${skipped} already correct, ${unresolved} unresolved, ${failed} failed.`,
  );
  if (!APPLY) {
    console.log("Dry run only — re-run with --apply to write changes.");
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
