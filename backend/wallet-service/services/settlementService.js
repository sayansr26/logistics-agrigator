/**
 * Settlement Service
 *
 * COD settlement lifecycle: generate (single/bulk/partial), adjustments, the
 * approval workflow state machine (DRAFT → FINANCE_VERIFICATION → APPROVED →
 * RELEASED, plus REJECTED / HOLD / CANCELLED), and payout on release
 * (wallet credit / bank / UPI / manual).
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const walletService = require("./walletService");
const notificationService = require("./notificationService");

// Allowed workflow transitions
const TRANSITIONS = {
  verify: { from: ["DRAFT"], to: "FINANCE_VERIFICATION" },
  approve: { from: ["FINANCE_VERIFICATION"], to: "APPROVED" },
  release: { from: ["APPROVED"], to: "RELEASED" },
  reject: { from: ["DRAFT", "FINANCE_VERIFICATION", "APPROVED"], to: "REJECTED" },
  hold: { from: ["DRAFT", "FINANCE_VERIFICATION", "APPROVED"], to: "HOLD" },
  cancel: { from: ["DRAFT", "HOLD", "REJECTED"], to: "CANCELLED" },
  reprocess: { from: ["HOLD", "REJECTED", "CANCELLED"], to: "DRAFT" },
};

// Eligible states for a COD shipment to be settled
const ELIGIBLE_RECON = ["MATCHED", "EXCESS", "MANUAL"];

function toNum(v) {
  return v === null || v === undefined ? 0 : parseFloat(v);
}

async function audit(action, resourceId, userId, details) {
  try {
    await prisma.auditLog.create({
      data: { action, resource: "Settlement", resourceId, userId, details },
    });
  } catch (e) {
    logger.warn("Settlement audit log failed", { action, error: e.message });
  }
}

/** Generate a unique-ish settlement number (STL-YYYYMMDD-XXXXXX). */
function generateSettlementNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `STL-${y}${m}${d}-${rand}`;
}

/** Recompute totalCod / totalAdjustments / netPayable from items + adjustments. */
async function recomputeTotals(settlementId) {
  const [items, adjustments] = await Promise.all([
    prisma.settlementItem.findMany({ where: { settlementId } }),
    prisma.settlementAdjustment.findMany({ where: { settlementId } }),
  ]);
  const totalCod = items.reduce((s, i) => s + toNum(i.amount), 0);
  const totalAdjustments = adjustments.reduce((s, a) => s + toNum(a.amount), 0);
  const netPayable = Number((totalCod + totalAdjustments).toFixed(2));
  return prisma.settlement.update({
    where: { id: settlementId },
    data: {
      totalCod: Number(totalCod.toFixed(2)),
      totalAdjustments: Number(totalAdjustments.toFixed(2)),
      netPayable,
    },
  });
}

/**
 * Generate a settlement for a customer from eligible reconciled COD shipments.
 * @param {Object} data - { userId, clientCode, codShipmentIds?, cycle, paymentMode, remarks, createdBy }
 */
async function generateSettlement(data) {
  const {
    userId,
    clientCode = "DEFAULT",
    codShipmentIds,
    cycle,
    paymentMode,
    remarks,
    createdBy,
  } = data;

  const where = {
    userId,
    settlementId: null,
    collectionStatus: "COLLECTED",
    reconStatus: { in: ELIGIBLE_RECON },
  };
  if (Array.isArray(codShipmentIds) && codShipmentIds.length) {
    where.id = { in: codShipmentIds };
  }

  const eligible = await prisma.codShipment.findMany({ where });
  if (eligible.length === 0) {
    throw new Error("No eligible (collected + reconciled, unsettled) COD shipments found");
  }

  const settlement = await prisma.settlement.create({
    data: {
      settlementNo: generateSettlementNo(),
      userId,
      clientCode,
      cycle: cycle || null,
      paymentMode: paymentMode || null,
      remarks: remarks || null,
      createdBy: createdBy || null,
      status: "DRAFT",
    },
  });

  for (const s of eligible) {
    await prisma.settlementItem.create({
      data: {
        settlementId: settlement.id,
        codShipmentId: s.id,
        awbNumber: s.awbNumber,
        amount: s.collectedAmount ?? s.codAmount,
      },
    });
    await prisma.codShipment.update({
      where: { id: s.id },
      data: { settlementId: settlement.id },
    });
  }

  const updated = await recomputeTotals(settlement.id);
  await audit("GENERATE_SETTLEMENT", settlement.id, createdBy, {
    userId,
    items: eligible.length,
    netPayable: toNum(updated.netPayable),
  });

  return getSettlement(settlement.id);
}

async function listSettlements(filters = {}) {
  const { userId, clientCode, status, page = 1, limit = 20 } = filters;
  const where = {};
  if (userId) where.userId = userId;
  if (clientCode) where.clientCode = clientCode;
  if (status) where.status = status;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = ((Number(page) || 1) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.settlement.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.settlement.count({ where }),
  ]);
  return { items, pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) } };
}

async function getSettlement(id) {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { items: true, adjustments: true },
  });
  if (!settlement) throw new Error("Settlement not found");
  return settlement;
}

/**
 * Add an adjustment to a settlement and recompute totals.
 * @param {Object} data - { settlementId, type, amount, reason, referenceAwb, createdBy }
 */
async function addAdjustment(data) {
  const { settlementId, type, amount, reason, referenceAwb, createdBy } = data;
  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!settlement) throw new Error("Settlement not found");
  if (["RELEASED", "CANCELLED"].includes(settlement.status)) {
    throw new Error(`Cannot adjust a ${settlement.status} settlement`);
  }

  const adjustment = await prisma.settlementAdjustment.create({
    data: {
      settlementId,
      userId: settlement.userId,
      clientCode: settlement.clientCode,
      type,
      amount,
      reason,
      referenceAwb: referenceAwb || null,
      createdBy: createdBy || null,
    },
  });

  const updated = await recomputeTotals(settlementId);
  await audit("ADD_SETTLEMENT_ADJUSTMENT", settlementId, createdBy, {
    type,
    amount,
    netPayable: toNum(updated.netPayable),
  });
  return { adjustment, settlement: updated };
}

/**
 * Release a settlement: perform payout by mode, mark RELEASED, mark COD shipments REMITTED.
 */
async function releaseSettlement(settlement, opts) {
  const { userId, payoutReference } = opts;
  let payoutTransactionId = null;
  let payoutRef = payoutReference || null;

  const netPayable = toNum(settlement.netPayable);
  if (netPayable <= 0) {
    throw new Error("Net payable must be positive to release a settlement");
  }

  if (settlement.paymentMode === "WALLET_CREDIT") {
    // Credit the customer's wallet
    const tx = await walletService.creditWallet(
      settlement.userId,
      netPayable,
      settlement.settlementNo,
      `COD settlement ${settlement.settlementNo}`,
    );
    payoutTransactionId = tx?.id || null;
  } else if (["BANK_TRANSFER", "UPI", "MANUAL"].includes(settlement.paymentMode)) {
    // Recorded payout (external); reference required for traceability
    payoutRef = payoutReference || `${settlement.paymentMode}-${settlement.settlementNo}`;
  } else {
    throw new Error("A payment mode is required before releasing a settlement");
  }

  const released = await prisma.settlement.update({
    where: { id: settlement.id },
    data: {
      status: "RELEASED",
      releasedBy: userId,
      releasedAt: new Date(),
      payoutTransactionId,
      payoutReference: payoutRef,
    },
  });

  // Mark all linked COD shipments as remitted
  await prisma.codShipment.updateMany({
    where: { settlementId: settlement.id },
    data: { collectionStatus: "REMITTED" },
  });

  return released;
}

/**
 * Apply a workflow transition to a settlement.
 * @param {string} id
 * @param {string} action - verify|approve|release|reject|hold|cancel|reprocess
 * @param {Object} opts - { userId, paymentMode, payoutReference, reason }
 */
async function transition(id, action, opts = {}) {
  const rule = TRANSITIONS[action];
  if (!rule) throw new Error(`Unknown settlement action: ${action}`);

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) throw new Error("Settlement not found");
  if (!rule.from.includes(settlement.status)) {
    throw new Error(
      `Cannot ${action} a settlement in ${settlement.status} status (allowed: ${rule.from.join(", ")})`,
    );
  }

  const { userId, paymentMode, payoutReference, reason } = opts;

  // release has bespoke payout handling
  if (action === "release") {
    // allow setting/overriding payment mode at release time
    if (paymentMode) {
      await prisma.settlement.update({ where: { id }, data: { paymentMode } });
      settlement.paymentMode = paymentMode;
    }
    const released = await releaseSettlement(settlement, { userId, payoutReference });
    await audit("RELEASE_SETTLEMENT", id, userId, {
      paymentMode: settlement.paymentMode,
      netPayable: toNum(settlement.netPayable),
      payoutTransactionId: released.payoutTransactionId,
    });
    notificationService.notify(notificationService.EVENTS.SETTLEMENT_RELEASED, {
      userId: settlement.userId,
      settlementNo: settlement.settlementNo,
      amount: toNum(settlement.netPayable),
    });
    return released;
  }

  const data = { status: rule.to };
  if (action === "approve") {
    data.approvedBy = userId;
    data.approvedAt = new Date();
  }
  if (action === "reject") data.rejectedReason = reason || "Rejected";
  if (action === "hold") data.holdReason = reason || "On hold";
  if (action === "reprocess") {
    // clear terminal-state reasons on reprocess back to DRAFT
    data.rejectedReason = null;
    data.holdReason = null;
  }

  const updated = await prisma.settlement.update({ where: { id }, data });
  await audit(`${action.toUpperCase()}_SETTLEMENT`, id, userId, {
    from: settlement.status,
    to: rule.to,
    reason: reason || undefined,
  });

  // Fire lifecycle notifications (best-effort)
  const NEV = notificationService.EVENTS;
  const eventMap = {
    approve: NEV.SETTLEMENT_READY,
    hold: NEV.SETTLEMENT_HOLD,
    reject: NEV.SETTLEMENT_REJECTED,
  };
  if (eventMap[action]) {
    notificationService.notify(eventMap[action], {
      userId: settlement.userId,
      settlementNo: settlement.settlementNo,
      amount: toNum(settlement.netPayable),
      reason: reason || undefined,
    });
  }

  return updated;
}

module.exports = {
  generateSettlement,
  listSettlements,
  getSettlement,
  addAdjustment,
  transition,
  TRANSITIONS,
};
