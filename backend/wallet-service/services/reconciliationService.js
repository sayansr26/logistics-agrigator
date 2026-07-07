/**
 * COD Reconciliation Service
 *
 * Matches courier-reported collections against expected COD amounts and flags
 * MATCHED / MISSING / SHORT / EXCESS / DUPLICATE. Supports manual reconciliation.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

function toNum(v) {
  return v === null || v === undefined ? 0 : parseFloat(v);
}

async function audit(action, resourceId, userId, details) {
  try {
    await prisma.auditLog.create({
      data: { action, resource: "CodReconciliation", resourceId, userId, details },
    });
  } catch (e) {
    logger.warn("Reconciliation audit log failed", { action, error: e.message });
  }
}

/**
 * Determine reconciliation status from expected vs reported and collection count.
 */
function deriveStatus(expected, reported, collectionCount) {
  if (collectionCount > 1) return "DUPLICATE";
  if (reported === null || reported === undefined) return "MISSING";
  const variance = Number((reported - expected).toFixed(2));
  if (variance === 0) return "MATCHED";
  if (variance < 0) return "SHORT";
  return "EXCESS";
}

/**
 * Auto-reconcile COD shipments against their collections.
 * @param {Object} filters - { userId, clientCode, dateFrom, dateTo }
 * @param {string} actingUserId
 * @returns {Promise<{processed, summary}>}
 */
async function autoReconcile(filters = {}, actingUserId) {
  const { userId, clientCode, dateFrom, dateTo } = filters;
  const where = { reconStatus: { in: ["UNRECONCILED", "MISSING", "SHORT", "EXCESS"] } };
  if (userId) where.userId = userId;
  if (clientCode) where.clientCode = clientCode;
  if (dateFrom || dateTo) {
    where.deliveredAt = {};
    if (dateFrom) where.deliveredAt.gte = new Date(dateFrom);
    if (dateTo) where.deliveredAt.lte = new Date(dateTo);
  }

  const shipments = await prisma.codShipment.findMany({ where, take: 1000 });
  const summary = { MATCHED: 0, MISSING: 0, SHORT: 0, EXCESS: 0, DUPLICATE: 0 };

  for (const s of shipments) {
    const collections = await prisma.codCollection.findMany({
      where: { OR: [{ matchedCodShipmentId: s.id }, { awbNumber: s.awbNumber }] },
    });

    const expected = toNum(s.codAmount);
    const reported = collections.length
      ? collections.reduce((sum, c) => sum + toNum(c.reportedAmount), 0)
      : null;
    const status = deriveStatus(expected, reported, collections.length);
    const variance = reported === null ? 0 : Number((reported - expected).toFixed(2));

    // Upsert a reconciliation record (one per shipment, latest wins)
    const existing = await prisma.codReconciliation.findFirst({
      where: { codShipmentId: s.id },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.codReconciliation.update({
        where: { id: existing.id },
        data: {
          collectionId: collections[0]?.id || null,
          expectedAmount: expected,
          reportedAmount: reported,
          variance,
          status,
        },
      });
    } else {
      await prisma.codReconciliation.create({
        data: {
          codShipmentId: s.id,
          collectionId: collections[0]?.id || null,
          expectedAmount: expected,
          reportedAmount: reported,
          variance,
          status,
        },
      });
    }

    await prisma.codShipment.update({
      where: { id: s.id },
      data: { reconStatus: status },
    });

    summary[status] = (summary[status] || 0) + 1;
  }

  await audit("AUTO_RECONCILE", null, actingUserId, { count: shipments.length, summary });
  logger.info("Auto reconciliation complete", { processed: shipments.length, summary });
  return { processed: shipments.length, summary };
}

/**
 * List reconciliation records with filters.
 */
async function listReconciliations(filters = {}) {
  const { status, page = 1, limit = 20 } = filters;
  const where = {};
  if (status) where.status = status;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = ((Number(page) || 1) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.codReconciliation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      include: { codShipment: { select: { awbNumber: true, orderId: true, userId: true } } },
    }),
    prisma.codReconciliation.count({ where }),
  ]);
  return { items, pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) } };
}

/**
 * Manually reconcile a COD shipment.
 * @param {string} codShipmentId
 * @param {Object} data - { status, remarks, reportedAmount, userId }
 */
async function manualReconcile(codShipmentId, data) {
  const { status = "MANUAL", remarks, reportedAmount, userId } = data;
  const shipment = await prisma.codShipment.findUnique({ where: { id: codShipmentId } });
  if (!shipment) throw new Error("COD shipment not found");

  const expected = toNum(shipment.codAmount);
  const reported = reportedAmount !== undefined ? toNum(reportedAmount) : null;
  const variance = reported === null ? 0 : Number((reported - expected).toFixed(2));

  const existing = await prisma.codReconciliation.findFirst({
    where: { codShipmentId },
    orderBy: { createdAt: "desc" },
  });

  const recon = existing
    ? await prisma.codReconciliation.update({
        where: { id: existing.id },
        data: { status, remarks, reportedAmount: reported, variance, resolvedBy: userId },
      })
    : await prisma.codReconciliation.create({
        data: {
          codShipmentId,
          expectedAmount: expected,
          reportedAmount: reported,
          variance,
          status,
          remarks,
          resolvedBy: userId,
        },
      });

  await prisma.codShipment.update({
    where: { id: codShipmentId },
    data: { reconStatus: status },
  });

  await audit("MANUAL_RECONCILE", recon.id, userId, { codShipmentId, status, variance });
  return recon;
}

module.exports = { autoReconcile, listReconciliations, manualReconcile };
