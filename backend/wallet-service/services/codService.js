/**
 * COD Service
 *
 * COD shipment ingestion + collection management for the remittance module.
 * - Ingest delivered COD shipments (from shipment-service) into CodShipment.
 * - List/search COD shipments with filters.
 * - Record courier COD collections (manual / import / API) and match to shipments.
 * - Verify received COD amounts.
 *
 * Follows wallet-service patterns: Prisma ORM, audit logging.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const notificationService = require("./notificationService");

async function audit(action, resourceId, userId, details) {
  try {
    await prisma.auditLog.create({
      data: { action, resource: "CodShipment", resourceId, userId, details },
    });
  } catch (e) {
    logger.warn("COD audit log failed", { action, error: e.message });
  }
}

/**
 * Ingest (upsert) a delivered COD shipment for remittance.
 * @param {Object} data
 */
async function ingestCodShipment(data) {
  const {
    shipmentId,
    awbNumber,
    orderId,
    invoiceNo,
    userId,
    clientCode = "DEFAULT",
    partnerId,
    partnerName,
    codAmount,
    deliveredAt,
  } = data;

  const record = await prisma.codShipment.upsert({
    where: { shipmentId },
    create: {
      shipmentId,
      awbNumber,
      orderId,
      invoiceNo: invoiceNo || null,
      userId,
      clientCode,
      partnerId: partnerId || null,
      partnerName: partnerName || null,
      codAmount,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : null,
    },
    update: {
      awbNumber,
      orderId,
      invoiceNo: invoiceNo || null,
      codAmount,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
    },
  });

  await audit("INGEST_COD_SHIPMENT", record.id, userId, { shipmentId, codAmount });
  return record;
}

/**
 * List / search COD shipments with filters + pagination.
 * @param {Object} filters
 */
async function listCodShipments(filters = {}) {
  const {
    search,
    userId,
    clientCode,
    partnerId,
    collectionStatus,
    reconStatus,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
  } = filters;

  const where = {};
  if (userId) where.userId = userId;
  if (clientCode) where.clientCode = clientCode;
  if (partnerId) where.partnerId = partnerId;
  if (collectionStatus) where.collectionStatus = collectionStatus;
  if (reconStatus) where.reconStatus = reconStatus;
  if (dateFrom || dateTo) {
    where.deliveredAt = {};
    if (dateFrom) where.deliveredAt.gte = new Date(dateFrom);
    if (dateTo) where.deliveredAt.lte = new Date(dateTo);
  }
  if (search) {
    where.OR = [
      { awbNumber: { contains: search, mode: "insensitive" } },
      { orderId: { contains: search, mode: "insensitive" } },
      { invoiceNo: { contains: search, mode: "insensitive" } },
    ];
  }

  const take = Math.min(Number(limit) || 20, 100);
  const skip = ((Number(page) || 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.codShipment.findMany({
      where,
      orderBy: { deliveredAt: "desc" },
      skip,
      take,
    }),
    prisma.codShipment.count({ where }),
  ]);

  return {
    items,
    pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
  };
}

/**
 * Record a courier COD collection and attempt to match it to a COD shipment by AWB.
 * @param {Object} data - { awbNumber, reportedAmount, collectionDate, source, courierReportId, metadata, userId }
 */
async function addCollection(data) {
  const {
    awbNumber,
    reportedAmount,
    collectionDate,
    source = "MANUAL",
    courierReportId,
    metadata,
    userId,
  } = data;

  // Match to a COD shipment by AWB (most recent unsettled)
  const match = await prisma.codShipment.findFirst({
    where: { awbNumber },
    orderBy: { createdAt: "desc" },
  });

  const collection = await prisma.codCollection.create({
    data: {
      awbNumber,
      reportedAmount,
      collectionDate: collectionDate ? new Date(collectionDate) : null,
      source,
      courierReportId: courierReportId || null,
      matchedCodShipmentId: match ? match.id : null,
      metadata: metadata || undefined,
    },
  });

  // Update the matched shipment's collected amount / status
  if (match) {
    await prisma.codShipment.update({
      where: { id: match.id },
      data: {
        collectedAmount: reportedAmount,
        collectionStatus: "COLLECTED",
      },
    });
  }

  await audit("ADD_COD_COLLECTION", collection.id, userId, {
    awbNumber,
    reportedAmount,
    source,
    matched: !!match,
  });

  if (match) {
    notificationService.notify(notificationService.EVENTS.COD_RECEIVED, {
      userId: match.userId,
      awbNumber,
      amount: Number(reportedAmount),
    });
  }

  return { collection, matched: !!match, codShipmentId: match ? match.id : null };
}

/**
 * Bulk import courier COD collections (parsed rows).
 * @param {Array} rows
 * @param {string} source - IMPORT | API
 * @param {string} userId
 */
async function importCollections(rows, source, userId) {
  const successful = [];
  const failed = [];
  for (const row of rows) {
    try {
      const res = await addCollection({ ...row, source, userId });
      successful.push({ awbNumber: row.awbNumber, matched: res.matched });
    } catch (e) {
      failed.push({ awbNumber: row.awbNumber, error: e.message });
    }
  }
  return { total: rows.length, successCount: successful.length, failureCount: failed.length, successful, failed };
}

/**
 * Verify a received COD collection.
 * @param {string} collectionId
 * @param {string} userId
 */
async function verifyCollection(collectionId, userId) {
  const collection = await prisma.codCollection.update({
    where: { id: collectionId },
    data: { verified: true, verifiedBy: userId, verifiedAt: new Date() },
  });
  await audit("VERIFY_COD_COLLECTION", collectionId, userId, {
    awbNumber: collection.awbNumber,
  });
  return collection;
}

module.exports = {
  ingestCodShipment,
  listCodShipments,
  addCollection,
  importCollections,
  verifyCollection,
};
