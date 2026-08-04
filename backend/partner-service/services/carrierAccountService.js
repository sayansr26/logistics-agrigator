/**
 * Carrier Account (Service Channel) Service
 *
 * Manages rule-based shipping channels/accounts per carrier partner
 * (e.g. "Delhivery B2C" 0-100kg → Account 1, "Delhivery B2B Heavy" 100kg+ → LTL account).
 *
 * Each channel carries routing rules (businessType B2B/B2C, weight slab,
 * order-amount range, payment modes, serviceType, priority) plus a link to a
 * credential account (PartnerChannelConfig) and optional per-channel credential
 * overrides. Selected at rating/booking time via selectChannel().
 *
 * Follows auth-service patterns: Prisma ORM, service layer, audit logging.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { resolveVolumetricConfig } = require("../shared/utils/weightCalc");

// Non-secret columns safe to return over HTTP. NEVER include `credentials`
// (per-account API keys / warehouse secrets) in any HTTP response.
const PUBLIC_ACCOUNT_SELECT = {
  id: true,
  partnerId: true,
  channelConfigId: true,
  channelName: true,
  accountRef: true,
  serviceType: true,
  businessType: true,
  minWeight: true,
  maxWeight: true,
  minOrderAmount: true,
  maxOrderAmount: true,
  paymentModes: true,
  isActive: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  // Non-secret volumetric config from the linked credential account
  channelConfig: {
    select: { volumetricDivisor: true, volumetricFactor: true },
  },
};

// Selection outcomes for selectChannel()
const SELECTION_MODES = {
  LEGACY: "LEGACY", // partner has no channels — caller uses getActiveChannel
  NO_MATCH: "NO_MATCH", // channels exist but none matches the shipment profile
  MATCHED: "MATCHED",
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
      orderBy: [
        { priority: "asc" },
        { serviceType: "asc" },
        { minWeight: "asc" },
      ],
    });
  }

  /**
   * Select the best-matching channel for a shipment profile.
   *
   * Match rule: isActive AND businessType IN (shipment type, BOTH)
   *   AND weight within [minWeight, maxWeight] (null maxWeight = open)
   *   AND orderAmount within [minOrderAmount, maxOrderAmount] (null = open)
   *   AND paymentType in paymentModes (empty list = all modes)
   *   AND serviceType filter when given,
   * ordered by priority then narrowest weight slab.
   *
   * @param {string} partnerId
   * @param {Object} criteria
   * @param {number} criteria.weight - chargeable weight in kg
   * @param {string} [criteria.businessType="B2C"] - B2B | B2C
   * @param {number|null} [criteria.orderAmount] - declared/invoice value (INR)
   * @param {string|null} [criteria.paymentType] - COD | PREPAID
   * @param {string|null} [criteria.serviceType] - SURFACE | AIR | EXPRESS
   * @returns {Promise<{mode: string, channel?: Object}>}
   */
  async selectChannel(partnerId, criteria = {}) {
    const {
      businessType = "B2C",
      orderAmount = null,
      paymentType = null,
      serviceType = null,
    } = criteria;
    const weight = Number(criteria.weight) || 0;

    const totalActive = await prisma.partnerServiceChannel.count({
      where: { partnerId, isActive: true },
    });

    if (totalActive === 0) {
      return { mode: SELECTION_MODES.LEGACY };
    }

    const andFilters = [
      { businessType: { in: [businessType, "BOTH"] } },
      { minWeight: { lte: weight } },
      { OR: [{ maxWeight: null }, { maxWeight: { gte: weight } }] },
    ];

    if (orderAmount !== null && orderAmount !== undefined) {
      andFilters.push({
        OR: [
          { minOrderAmount: null },
          { minOrderAmount: { lte: orderAmount } },
        ],
      });
      andFilters.push({
        OR: [
          { maxOrderAmount: null },
          { maxOrderAmount: { gte: orderAmount } },
        ],
      });
    }

    if (paymentType) {
      andFilters.push({
        OR: [
          { paymentModes: { isEmpty: true } },
          { paymentModes: { has: paymentType } },
        ],
      });
    }

    if (serviceType) {
      andFilters.push({ serviceType });
    }

    const candidates = await prisma.partnerServiceChannel.findMany({
      where: { partnerId, isActive: true, AND: andFilters },
      // credentials excluded — selection returns non-secret routing metadata only
      select: PUBLIC_ACCOUNT_SELECT,
      orderBy: [{ priority: "asc" }, { minWeight: "desc" }],
    });

    if (candidates.length === 0) {
      logger.warn("No channel matched shipment profile", {
        partnerId,
        weight,
        businessType,
        orderAmount,
        paymentType,
        serviceType,
      });
      return { mode: SELECTION_MODES.NO_MATCH };
    }

    // Prefer the narrowest slab (highest minWeight already via order); return first.
    return { mode: SELECTION_MODES.MATCHED, channel: candidates[0] };
  }

  /**
   * Resolve the credentials for a selected channel into the same shape
   * partnerChannelService.getActiveChannel returns, so createAdapter() and the
   * webhook layer work unchanged. Precedence: per-channel `credentials` Json
   * overrides > linked PartnerChannelConfig fields.
   *
   * @param {Object|string} channelOrId - channel row (from selectChannel) or its id
   * @returns {Promise<Object>} adapter-ready channel config
   */
  async resolveChannelCredentials(channelOrId) {
    const channelId =
      typeof channelOrId === "string" ? channelOrId : channelOrId?.id;

    const channel = await prisma.partnerServiceChannel.findUnique({
      where: { id: channelId },
      include: { channelConfig: true },
    });

    if (!channel) {
      throw Object.assign(new Error("Service channel not found"), {
        code: "CHANNEL_NOT_FOUND",
        statusCode: 404,
      });
    }

    const config = channel.channelConfig;
    const overrides = channel.credentials || {};

    // Per-account overrides win over the linked credential account; a null on
    // either side falls through to the system default (27000 / 6).
    const volumetric = resolveVolumetricConfig({
      divisor: overrides.volumetricDivisor ?? config?.volumetricDivisor,
      factor: overrides.volumetricFactor ?? config?.volumetricFactor,
    });

    const resolved = {
      serviceChannelId: channel.id,
      channelName: channel.channelName,
      accountRef: channel.accountRef,
      serviceType: channel.serviceType,
      businessType: channel.businessType,
      apiUrl: overrides.apiUrl ?? config?.apiUrl ?? "",
      apiKey: overrides.apiKey ?? config?.apiKey ?? "",
      aggregatorType:
        overrides.aggregatorType ?? config?.aggregatorType ?? "NONE",
      aggregatorConfig: {
        ...(config?.aggregatorConfig || {}),
        ...(overrides.aggregatorConfig || {}),
      },
      webhookSecret: overrides.webhookSecret ?? config?.webhookSecret ?? null,
      volumetricDivisor: volumetric.divisor,
      volumetricFactor: volumetric.factor,
    };

    if (resolved.aggregatorType === "NONE") {
      throw Object.assign(
        new Error(
          `Channel "${channel.channelName}" has no usable credentials — link a credential account or set overrides`,
        ),
        { code: "CHANNEL_CREDENTIALS_MISSING", statusCode: 400 },
      );
    }

    return resolved;
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
          businessType: account.businessType ?? "BOTH",
          minWeight: account.minWeight ?? 0,
          maxWeight: account.maxWeight ?? null,
          minOrderAmount: account.minOrderAmount ?? null,
          maxOrderAmount: account.maxOrderAmount ?? null,
          paymentModes: account.paymentModes ?? [],
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

    await this._invalidateQuoteCache();
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

    await this._invalidateQuoteCache();
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

    await this._invalidateQuoteCache();
    return { success: true };
  }

  /**
   * Channel rules affect quote eligibility, so any CUD must flush the quote
   * cache or stale rates could show partners that can no longer serve a
   * shipment profile (and vice versa). Lazy require avoids a startup cycle.
   * @private
   */
  async _invalidateQuoteCache() {
    try {
      const { clearCache } = require("./quoteService");
      await clearCache();
    } catch (error) {
      logger.warn("Failed to invalidate quote cache after channel change", {
        error: error.message,
      });
    }
  }
}

module.exports = new CarrierAccountService();
module.exports.SELECTION_MODES = SELECTION_MODES;
