/**
 * Shipment wallet ledger.
 *
 * Reconstructs every wallet movement a shipment caused, in order. The wallet
 * itself has no shipment dimension to filter on — it only knows the reference
 * strings we send it (`SHIPMENT_<id>`, `SHIPMENT_<id>_RERATE_<ts>`) — so the
 * ledger is assembled from our own records and echoes those references back so
 * a row can be matched against the wallet by eye.
 *
 * Shared by GET /shipments/:id/transactions and the invoice PDF annexure so the
 * two can never disagree.
 */
const { prisma } = require("../config/database");

const toNum = (v) => (v === null || v === undefined ? null : parseFloat(v));

const SHIPMENT_LEDGER_SELECT = {
  id: true,
  orderId: true,
  paymentType: true,
  systemCharge: true,
  totalCost: true,
  walletTransactionId: true,
  walletUserId: true,
  refundTransactionId: true,
  refundAmount: true,
  createdAt: true,
};

/**
 * @param {Object} shipment - row selected with SHIPMENT_LEDGER_SELECT
 * @param {Array} adjustments - shipmentFinancialAdjustment rows, oldest first
 */
function assembleLedger(shipment, adjustments) {
  const entries = [];

  // Opening booking debit. After a re-rate the shipment's walletTransactionId
  // points at the replacement charge, so the original id survives only as the
  // first adjustment's refundTransactionId — hence null rather than a guess
  // once adjustments exist.
  if (shipment.paymentType === "PREPAID") {
    entries.push({
      kind: "DEBIT",
      label: "Booking charge",
      amount: toNum(shipment.systemCharge) ?? toNum(shipment.totalCost),
      transactionId: adjustments.length ? null : shipment.walletTransactionId,
      reference: `SHIPMENT_${shipment.id}`,
      reason: `Shipment charge for order ${shipment.orderId}`,
      occurredAt: shipment.createdAt,
    });
  }

  for (const adj of adjustments) {
    const oldAmount = toNum(adj.oldAmount);
    const newAmount = toNum(adj.newAmount);
    const difference = toNum(adj.difference);

    // Rows written before the reversal fix settled only the difference: one
    // leg, amount = |difference|. Rows written after carry both legs, with the
    // full old amount reversed and the full new amount charged.
    const isFullReversal = !!(
      adj.refundTransactionId && adj.chargeTransactionId
    );

    if (adj.refundTransactionId) {
      entries.push({
        kind: "REFUND",
        label: isFullReversal
          ? "Reversal of previous charge"
          : "Partial refund (difference only)",
        amount: isFullReversal ? oldAmount : Math.abs(difference ?? 0),
        transactionId: adj.refundTransactionId,
        reference: null,
        reason: adj.reason,
        adjustmentId: adj.id,
        adjustmentType: adj.adjustmentType,
        occurredAt: adj.createdAt,
      });
    }

    if (adj.chargeTransactionId) {
      entries.push({
        kind: "DEBIT",
        label: isFullReversal
          ? "Re-rated charge"
          : "Top-up charge (difference only)",
        amount: isFullReversal ? newAmount : Math.abs(difference ?? 0),
        transactionId: adj.chargeTransactionId,
        reference: null,
        reason: adj.reason,
        adjustmentId: adj.id,
        adjustmentType: adj.adjustmentType,
        occurredAt: adj.createdAt,
      });
    }

    // An adjustment that moved no money at all is still worth showing — it is
    // usually a failed settlement, and its absence reads as "nothing happened".
    if (!adj.refundTransactionId && !adj.chargeTransactionId) {
      entries.push({
        kind: "NONE",
        label:
          difference === 0
            ? "Re-rate with no price change"
            : "Adjustment recorded — no wallet movement",
        amount: 0,
        transactionId: null,
        reference: null,
        reason: adj.reason,
        adjustmentId: adj.id,
        adjustmentType: adj.adjustmentType,
        oldAmount,
        newAmount,
        occurredAt: adj.createdAt,
      });
    }
  }

  if (shipment.refundTransactionId || toNum(shipment.refundAmount)) {
    entries.push({
      kind: "REFUND",
      label: "Cancellation refund",
      amount: toNum(shipment.refundAmount),
      transactionId: shipment.refundTransactionId,
      reference: `REFUND_${shipment.id}`,
      reason: "Shipment cancelled",
      occurredAt: null,
    });
  }

  const sum = (kind) =>
    entries
      .filter((e) => e.kind === kind)
      .reduce((t, e) => t + (e.amount || 0), 0);
  const totalDebited = Math.round(sum("DEBIT") * 100) / 100;
  const totalRefunded = Math.round(sum("REFUND") * 100) / 100;

  return {
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    paymentType: shipment.paymentType,
    walletUserId: shipment.walletUserId,
    currentTransactionId: shipment.walletTransactionId,
    summary: {
      totalDebited,
      totalRefunded,
      netCharged: Math.round((totalDebited - totalRefunded) * 100) / 100,
      currentPrice: toNum(shipment.totalCost),
    },
    transactions: entries,
  };
}

/**
 * Build the ledger for a shipment id. Returns null when the shipment is gone.
 */
async function buildShipmentLedger(shipmentId) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: SHIPMENT_LEDGER_SELECT,
  });
  if (!shipment) return null;

  const adjustments = await prisma.shipmentFinancialAdjustment.findMany({
    where: { shipmentId },
    orderBy: { createdAt: "asc" },
  });

  return assembleLedger(shipment, adjustments);
}

module.exports = {
  buildShipmentLedger,
  assembleLedger,
  SHIPMENT_LEDGER_SELECT,
};
