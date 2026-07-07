/**
 * Settlement Rule Service
 *
 * Configurable settlement cycles/rules per customer or courier, plus the
 * auto-settlement runner used by the scheduler:
 *  - Cycle: DAILY | WEEKLY | T_PLUS_1 | T_PLUS_2 controls how long after delivery
 *    a COD becomes settle-eligible.
 *  - autoRelease + paymentMode drive automatic wallet credit / bank / UPI payout.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const settlementService = require("./settlementService");

// Cycle → minimum age (days) since delivery before a COD is auto-settle eligible
const CYCLE_MIN_AGE_DAYS = {
  DAILY: 0,
  T_PLUS_1: 1,
  T_PLUS_2: 2,
  WEEKLY: 7,
};

const ELIGIBLE_RECON = ["MATCHED", "EXCESS", "MANUAL"];

async function audit(action, resourceId, userId, details) {
  try {
    await prisma.auditLog.create({
      data: { action, resource: "SettlementRule", resourceId, userId, details },
    });
  } catch (e) {
    logger.warn("SettlementRule audit failed", { action, error: e.message });
  }
}

// ---- CRUD ----

async function listRules(filters = {}) {
  const where = {};
  if (filters.scope) where.scope = filters.scope;
  if (filters.userId) where.userId = filters.userId;
  if (filters.clientCode) where.clientCode = filters.clientCode;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  return prisma.settlementRule.findMany({ where, orderBy: { createdAt: "desc" } });
}

async function createRule(data, actingUserId) {
  const rule = await prisma.settlementRule.create({
    data: {
      scope: data.scope || "CUSTOMER",
      clientCode: data.clientCode || null,
      userId: data.userId || null,
      partnerId: data.partnerId || null,
      cycle: data.cycle || "T_PLUS_2",
      paymentMode: data.paymentMode || "WALLET_CREDIT",
      autoRelease: data.autoRelease ?? false,
      isActive: data.isActive ?? true,
    },
  });
  await audit("CREATE_SETTLEMENT_RULE", rule.id, actingUserId, data);
  return rule;
}

async function updateRule(id, updates, actingUserId) {
  const rule = await prisma.settlementRule.update({ where: { id }, data: updates });
  await audit("UPDATE_SETTLEMENT_RULE", id, actingUserId, updates);
  return rule;
}

async function deleteRule(id, actingUserId) {
  await prisma.settlementRule.delete({ where: { id } });
  await audit("DELETE_SETTLEMENT_RULE", id, actingUserId, {});
  return { success: true };
}

/**
 * Resolve the effective rule for a customer (CUSTOMER rule wins, then GLOBAL).
 */
async function resolveRuleForCustomer(userId, clientCode) {
  const custom = await prisma.settlementRule.findFirst({
    where: { scope: "CUSTOMER", userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (custom) return custom;
  return prisma.settlementRule.findFirst({
    where: { scope: "GLOBAL", isActive: true, OR: [{ clientCode }, { clientCode: null }] },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Auto-settlement runner. For each active CUSTOMER/GLOBAL rule, find customers with
 * eligible (collected + reconciled + unsettled) COD older than the cycle window,
 * generate a settlement, and optionally auto-release the payout.
 *
 * @param {Object} opts - { now?: Date, dryRun?: boolean }
 * @returns {Promise<{ processedCustomers, generated, released, errors }>}
 */
async function runAutoSettlement(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const dryRun = !!opts.dryRun;

  const rules = await prisma.settlementRule.findMany({
    where: { isActive: true, scope: { in: ["CUSTOMER", "GLOBAL"] } },
  });

  const summary = { processedCustomers: 0, generated: 0, released: 0, errors: [] };
  const handled = new Set(); // avoid double-processing a customer across overlapping rules

  for (const rule of rules) {
    const minAge = CYCLE_MIN_AGE_DAYS[rule.cycle] ?? 2;
    const cutoff = new Date(now.getTime() - minAge * 24 * 60 * 60 * 1000);

    // Which customers to consider
    let userIds = [];
    if (rule.scope === "CUSTOMER" && rule.userId) {
      userIds = [rule.userId];
    } else {
      // GLOBAL: all customers with eligible COD
      const grouped = await prisma.codShipment.groupBy({
        by: ["userId"],
        where: {
          settlementId: null,
          collectionStatus: "COLLECTED",
          reconStatus: { in: ELIGIBLE_RECON },
          deliveredAt: { lte: cutoff },
          ...(rule.clientCode ? { clientCode: rule.clientCode } : {}),
        },
      });
      userIds = grouped.map((g) => g.userId);
    }

    for (const userId of userIds) {
      if (handled.has(userId)) continue;
      handled.add(userId);
      summary.processedCustomers += 1;

      // Eligible COD older than the cycle cutoff
      const eligible = await prisma.codShipment.findMany({
        where: {
          userId,
          settlementId: null,
          collectionStatus: "COLLECTED",
          reconStatus: { in: ELIGIBLE_RECON },
          deliveredAt: { lte: cutoff },
        },
        select: { id: true, clientCode: true },
      });
      if (eligible.length === 0) continue;

      if (dryRun) {
        summary.generated += 1;
        continue;
      }

      try {
        const settlement = await settlementService.generateSettlement({
          userId,
          clientCode: eligible[0].clientCode,
          codShipmentIds: eligible.map((e) => e.id),
          cycle: rule.cycle,
          paymentMode: rule.paymentMode,
          remarks: `Auto-generated by settlement rule (${rule.cycle})`,
          createdBy: null,
        });
        summary.generated += 1;

        if (rule.autoRelease) {
          // Advance through the workflow: verify → approve → release
          await settlementService.transition(settlement.id, "verify", { userId: null });
          await settlementService.transition(settlement.id, "approve", { userId: null });
          await settlementService.transition(settlement.id, "release", {
            userId: null,
            paymentMode: rule.paymentMode,
          });
          summary.released += 1;
        }
      } catch (e) {
        logger.warn("Auto-settlement failed for customer", { userId, error: e.message });
        summary.errors.push({ userId, error: e.message });
      }
    }
  }

  logger.info("Auto-settlement run complete", summary);
  return summary;
}

module.exports = {
  CYCLE_MIN_AGE_DAYS,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  resolveRuleForCustomer,
  runAutoSettlement,
};
