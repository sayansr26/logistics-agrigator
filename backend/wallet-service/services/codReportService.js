/**
 * COD / Settlement Reports Service
 *
 * Aggregate reports: customer-wise & courier-wise COD, pending settlement,
 * settled, hold, reconciliation, adjustment, COD ledger, settlement summary.
 */

const { prisma } = require("../config/database");

function toNum(v) {
  return v === null || v === undefined ? 0 : parseFloat(v);
}

/** COD grouped by customer (userId). */
async function customerWiseCod(filters = {}) {
  const where = {};
  if (filters.clientCode) where.clientCode = filters.clientCode;
  if (filters.collectionStatus) where.collectionStatus = filters.collectionStatus;
  const grouped = await prisma.codShipment.groupBy({
    by: ["userId"],
    where,
    _sum: { codAmount: true, collectedAmount: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    userId: g.userId,
    shipments: g._count._all,
    totalCod: toNum(g._sum.codAmount),
    totalCollected: toNum(g._sum.collectedAmount),
  }));
}

/** COD grouped by courier (partnerId). */
async function courierWiseCod(filters = {}) {
  const where = {};
  if (filters.clientCode) where.clientCode = filters.clientCode;
  const grouped = await prisma.codShipment.groupBy({
    by: ["partnerId", "partnerName"],
    where,
    _sum: { codAmount: true, collectedAmount: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    partnerId: g.partnerId,
    partnerName: g.partnerName,
    shipments: g._count._all,
    totalCod: toNum(g._sum.codAmount),
    totalCollected: toNum(g._sum.collectedAmount),
  }));
}

/** Pending settlement: collected + reconciled, not yet settled, grouped by customer. */
async function pendingSettlementReport(filters = {}) {
  const where = {
    settlementId: null,
    collectionStatus: "COLLECTED",
    reconStatus: { in: ["MATCHED", "EXCESS", "MANUAL"] },
  };
  if (filters.clientCode) where.clientCode = filters.clientCode;
  const grouped = await prisma.codShipment.groupBy({
    by: ["userId"],
    where,
    _sum: { collectedAmount: true, codAmount: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    userId: g.userId,
    pendingShipments: g._count._all,
    pendingAmount: toNum(g._sum.collectedAmount) || toNum(g._sum.codAmount),
  }));
}

/** Settlements filtered by status (settled/hold/etc.). */
async function settlementStatusReport(status, filters = {}) {
  const where = { status };
  if (filters.clientCode) where.clientCode = filters.clientCode;
  const settlements = await prisma.settlement.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const totalNet = settlements.reduce((s, x) => s + toNum(x.netPayable), 0);
  return { count: settlements.length, totalNet: Number(totalNet.toFixed(2)), settlements };
}

/** Reconciliation report grouped by status. */
async function reconciliationReport(filters = {}) {
  const grouped = await prisma.codReconciliation.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { variance: true },
  });
  return grouped.map((g) => ({
    status: g.status,
    count: g._count._all,
    totalVariance: toNum(g._sum.variance),
  }));
}

/** Adjustment report grouped by type. */
async function adjustmentReport(filters = {}) {
  const grouped = await prisma.settlementAdjustment.groupBy({
    by: ["type"],
    _count: { _all: true },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({
    type: g.type,
    count: g._count._all,
    totalAmount: toNum(g._sum.amount),
  }));
}

/** COD ledger for a customer: shipments with collection + recon status. */
async function codLedger(filters = {}) {
  const where = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.clientCode) where.clientCode = filters.clientCode;
  const rows = await prisma.codShipment.findMany({
    where,
    orderBy: { deliveredAt: "desc" },
    take: 1000,
    select: {
      awbNumber: true,
      orderId: true,
      codAmount: true,
      collectedAmount: true,
      collectionStatus: true,
      reconStatus: true,
      settlementId: true,
      deliveredAt: true,
    },
  });
  return rows;
}

/** Settlement summary: counts + totals by status. */
async function settlementSummary(filters = {}) {
  const where = {};
  if (filters.clientCode) where.clientCode = filters.clientCode;
  const grouped = await prisma.settlement.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
    _sum: { netPayable: true },
  });
  return grouped.map((g) => ({
    status: g.status,
    count: g._count._all,
    totalNetPayable: toNum(g._sum.netPayable),
  }));
}

module.exports = {
  customerWiseCod,
  courierWiseCod,
  pendingSettlementReport,
  settlementStatusReport,
  reconciliationReport,
  adjustmentReport,
  codLedger,
  settlementSummary,
};
