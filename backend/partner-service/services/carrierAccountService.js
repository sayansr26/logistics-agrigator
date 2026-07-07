/**
 * Carrier Account (Service Channel) Service
 *
 * Manages weight-slab shipping products / accounts per carrier partner
 * (e.g. "Delhivery Surface A" 0-5kg → Account 1, "Delhivery Air" all-weight → Account 3).
 *
 * Distinct from PartnerChannelConfig (credential/env channel) — this is a shipping
 * PRODUCT keyed by weight slab + account type, selected at rating/booking time by
 * chargeable weight.
 *
 * Follows auth-service patterns: Prisma ORM, service layer, audit logging.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

// Non-secret columns safe to return over HTTP. NEVER include `credentials`
// (per-account API keys / warehouse secrets) in any HTTP response.
const PUBLIC_ACCOUNT_SELECT = {
  id: true,
  partnerId: true,
  channelConfigId: true,
  channelName: true,
  accountRef: true,
  serviceType: true,
  minWeight: true,
  maxWeight: true,
  isActive: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
};

class CarrierAccountService {
  constructor() {
    this.serviceName = "CarrierAccountService";
  }

  /**
   * List all carrier accounts for a partner (credentials excluded).
   * @param {string} partnerId
   * @returns {Promise<Array>}
   */
  async listAccounts(partnerId) {
    return prisma.partnerServiceChannel.findMany({
      where: { partnerId },
      select: PUBLIC_ACCOUNT_SELECT,
      orderBy: [{ serviceType: "asc" }, { priority: "asc" }, { minWeight: "asc" }],
    });
  }

  /**
   * Select the best-matching carrier account for a given chargeable weight.
   * Match rule: isActive AND minWeight <= weight AND (maxWeight is null OR maxWeight >= weight),
   * optionally filtered by serviceType, ordered by priority then narrowest slab.
   * @param {string} partnerId
   * @param {number} chargeableWeight - kg
   * @param {string|null} [serviceType] - SURFACE | AIR | EXPRESS
   * @returns {Promise<Object|null>} matching account or null
   */
  async selectAccount(partnerId, chargeableWeight, serviceType = null) {
    const weight = Number(chargeableWeight) || 0;

    const candidates = await prisma.partnerServiceChannel.findMany({
      where: {
        partnerId,
        isActive: true,
        ...(serviceType ? { serviceType } : {}),
        minWeight: { lte: weight },
        OR: [{ maxWeight: null }, { maxWeight: { gte: weight } }],
      },
      // credentials excluded — selection returns non-secret routing metadata only
      select: PUBLIC_ACCOUNT_SELECT,
      orderBy: [{ priority: "asc" }, { minWeight: "desc" }],
    });

    if (candidates.length === 0) {
      logger.warn("No carrier account matched weight slab", {
        partnerId,
        chargeableWeight: weight,
        serviceType,
      });
      return null;
    }

    // Prefer the narrowest slab (highest minWeight already via order); return first.
    return candidates[0];
  }

  /**
   * Create one or more carrier accounts for a partner.
   * @param {Object} data - { partnerId, accounts: [...], userId }
   * @returns {Promise<Array>} created accounts
   */
  async createAccounts({ partnerId, accounts, userId }) {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true },
    });
    if (!partner) {
      throw new Error("Partner not found");
    }

    const results = [];
    for (const account of accounts) {
      const existing = await prisma.partnerServiceChannel.findFirst({
        where: { partnerId, channelName: account.channelName },
      });
      if (existing) {
        throw new Error(
          `Carrier account with name "${account.channelName}" already exists`,
        );
      }

      const created = await prisma.partnerServiceChannel.create({
        data: {
          partnerId,
          channelConfigId: account.channelConfigId ?? null,
          channelName: account.channelName,
          accountRef: account.accountRef,
          serviceType: account.serviceType ?? "SURFACE",
          minWeight: account.minWeight ?? 0,
          maxWeight: account.maxWeight ?? null,
          credentials: account.credentials ?? undefined,
          isActive: account.isActive ?? true,
          priority: account.priority ?? 1,
        },
        select: PUBLIC_ACCOUNT_SELECT,
      });

      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "CARRIER_ACCOUNT",
          resourceId: created.id,
          userId,
          requestData: { partnerId, account },
        },
      });

      results.push(created);
    }

    logger.info("Carrier accounts created", {
      partnerId,
      count: results.length,
    });
    return results;
  }

  /**
   * Update a carrier account.
   * @param {Object} data - { accountId, updates, userId }
   * @returns {Promise<Object>}
   */
  async updateAccount({ accountId, updates, userId }) {
    if (updates.channelName) {
      const existing = await prisma.partnerServiceChannel.findFirst({
        where: { id: { not: accountId }, channelName: updates.channelName },
      });
      if (existing) {
        throw new Error(
          `Carrier account with name "${updates.channelName}" already exists`,
        );
      }
    }

    const account = await prisma.partnerServiceChannel.update({
      where: { id: accountId },
      data: updates,
      select: PUBLIC_ACCOUNT_SELECT,
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        resourceType: "CARRIER_ACCOUNT",
        resourceId: accountId,
        userId,
        requestData: updates,
      },
    });

    logger.info("Carrier account updated", { accountId });
    return account;
  }

  /**
   * Delete a carrier account.
   * @param {string} accountId
   * @param {string} [userId]
   * @returns {Promise<{success: boolean}>}
   */
  async deleteAccount(accountId, userId) {
    await prisma.partnerServiceChannel.delete({ where: { id: accountId } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        resourceType: "CARRIER_ACCOUNT",
        resourceId: accountId,
        userId,
      },
    });

    logger.info("Carrier account deleted", { accountId });
    return { success: true };
  }
}

module.exports = new CarrierAccountService();
