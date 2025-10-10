// Commission Service - Commission calculation and tracking logic
// Handles commission calculations, affiliate stats, and Redis caching

const { getPrismaClient } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");
const axios = require("axios");

/**
 * Calculate commission based on affiliate settings
 * @param {number} baseAmount - Shipment cost or base amount
 * @param {string} affiliateId - Affiliate user ID
 * @returns {Object} Commission calculation details
 */
async function calculateCommission(baseAmount, affiliateId) {
  try {
    // Get affiliate commission settings from cache or auth-service
    const affiliateSettings = await getAffiliateSettings(affiliateId);

    if (!affiliateSettings || !affiliateSettings.commissionRate) {
      return {
        commissionAmount: 0,
        commissionType: "FLAT",
        commissionRate: 0,
        baseAmount,
      };
    }

    let commissionAmount = 0;

    if (affiliateSettings.commissionType === "PERCENTAGE") {
      commissionAmount = (baseAmount * affiliateSettings.commissionRate) / 100;
    } else if (affiliateSettings.commissionType === "FLAT") {
      commissionAmount = affiliateSettings.commissionRate;
    }

    return {
      commissionAmount: parseFloat(commissionAmount.toFixed(2)),
      commissionType: affiliateSettings.commissionType,
      commissionRate: affiliateSettings.commissionRate,
      baseAmount,
    };
  } catch (error) {
    logger.error("Calculate commission error", {
      error: error.message,
      affiliateId,
      baseAmount,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Track commission when shipment is created
 * @param {string} shipmentId - Shipment ID
 * @param {string} customerId - Customer ID
 * @param {number} shipmentCost - Total shipment cost
 * @returns {Object} Created commission record
 */
async function trackCommission(shipmentId, customerId, shipmentCost) {
  try {
    // Find affiliate who referred this customer
    const prisma = getPrismaClient();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      logger.warn("Customer not found for commission tracking", {
        customerId,
        shipmentId,
        service: "user-service",
      });
      return null;
    }

    // Get affiliate ID from customer's commissions (find most recent)
    const existingCommission = await prisma.commission.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { affiliateId: true },
    });

    if (!existingCommission) {
      logger.info(
        "No affiliate found for customer, skipping commission tracking",
        {
          customerId,
          shipmentId,
          service: "user-service",
        },
      );
      return null;
    }

    const affiliateId = existingCommission.affiliateId;

    // Calculate commission
    const commissionCalc = await calculateCommission(shipmentCost, affiliateId);

    // Create commission record
    const commission = await prisma.commission.create({
      data: {
        affiliateId,
        customerId,
        shipmentId,
        commissionType: commissionCalc.commissionType,
        commissionRate: commissionCalc.commissionRate,
        baseAmount: commissionCalc.baseAmount,
        commissionAmount: commissionCalc.commissionAmount,
        status: "PENDING",
        metadata: {
          shipmentCost,
          calculatedAt: new Date().toISOString(),
        },
      },
    });

    // Invalidate affiliate stats cache
    await invalidateAffiliateCache(affiliateId);

    logger.info("Commission tracked successfully", {
      commissionId: commission.id,
      affiliateId,
      customerId,
      shipmentId,
      commissionAmount: commission.commissionAmount,
      service: "user-service",
    });

    return commission;
  } catch (error) {
    logger.error("Track commission error", {
      error: error.message,
      shipmentId,
      customerId,
      shipmentCost,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Track customer signup commission (initial referral bonus)
 * @param {string} affiliateId - Affiliate ID
 * @param {string} customerId - Customer ID
 * @returns {Object} Created commission record
 */
async function trackCustomerSignup(affiliateId, customerId) {
  try {
    // Get affiliate commission settings
    const affiliateSettings = await getAffiliateSettings(affiliateId);

    if (!affiliateSettings || !affiliateSettings.commissionRate) {
      throw new Error("Affiliate commission settings not found");
    }

    // For customer signup, use base amount of 0 if PERCENTAGE type
    const baseAmount =
      affiliateSettings.commissionType === "FLAT"
        ? affiliateSettings.commissionRate
        : 0;

    const commissionCalc = await calculateCommission(baseAmount, affiliateId);

    // Create commission record
    const prisma = getPrismaClient();
    const commission = await prisma.commission.create({
      data: {
        affiliateId,
        customerId,
        shipmentId: null, // No shipment for signup commission
        commissionType: commissionCalc.commissionType,
        commissionRate: commissionCalc.commissionRate,
        baseAmount: commissionCalc.baseAmount,
        commissionAmount: commissionCalc.commissionAmount,
        status: "PENDING",
        metadata: {
          type: "CUSTOMER_SIGNUP",
          signupDate: new Date().toISOString(),
        },
      },
    });

    // Invalidate affiliate stats cache
    await invalidateAffiliateCache(affiliateId);

    logger.info("Customer signup commission tracked", {
      commissionId: commission.id,
      affiliateId,
      customerId,
      commissionAmount: commission.commissionAmount,
      service: "user-service",
    });

    return commission;
  } catch (error) {
    logger.error("Track customer signup error", {
      error: error.message,
      affiliateId,
      customerId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get affiliate statistics
 * @param {string} affiliateId - Affiliate ID
 * @returns {Object} Affiliate statistics
 */
async function getAffiliateStats(affiliateId) {
  try {
    const redis = getRedisClient();
    const cacheKey = `affiliate:stats:${affiliateId}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get statistics from database
    const prisma = getPrismaClient();
    const [
      totalCommissions,
      pendingAmount,
      approvedAmount,
      paidAmount,
      linkedCustomersCount,
    ] = await Promise.all([
      prisma.commission.count({ where: { affiliateId } }),
      prisma.commission.aggregate({
        where: { affiliateId, status: "PENDING" },
        _sum: { commissionAmount: true },
      }),
      prisma.commission.aggregate({
        where: { affiliateId, status: "APPROVED" },
        _sum: { commissionAmount: true },
      }),
      prisma.commission.aggregate({
        where: { affiliateId, status: "PAID" },
        _sum: { commissionAmount: true },
      }),
      prisma.commission.groupBy({
        by: ["customerId"],
        where: { affiliateId },
      }),
    ]);

    const stats = {
      totalCommissions,
      pendingAmount: pendingAmount._sum.commissionAmount || 0,
      approvedAmount: approvedAmount._sum.commissionAmount || 0,
      paidAmount: paidAmount._sum.commissionAmount || 0,
      totalEarnings:
        (pendingAmount._sum.commissionAmount || 0) +
        (approvedAmount._sum.commissionAmount || 0) +
        (paidAmount._sum.commissionAmount || 0),
      linkedCustomers: linkedCustomersCount.length,
    };

    // Cache for 5 minutes
    await redis.setEx(cacheKey, 300, JSON.stringify(stats));

    return stats;
  } catch (error) {
    logger.error("Get affiliate stats error", {
      error: error.message,
      affiliateId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get recent commissions for an affiliate
 * @param {string} affiliateId - Affiliate ID
 * @param {number} limit - Number of recent commissions to fetch
 * @returns {Array} Recent commissions
 */
async function getRecentCommissions(affiliateId, limit = 10) {
  try {
    const prisma = getPrismaClient();
    const commissions = await prisma.commission.findMany({
      where: { affiliateId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return commissions;
  } catch (error) {
    logger.error("Get recent commissions error", {
      error: error.message,
      affiliateId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get customers linked to affiliate
 * @param {string} affiliateId - Affiliate ID
 * @returns {Array} Linked customers with commission stats
 */
async function getLinkedCustomers(affiliateId) {
  try {
    const prisma = getPrismaClient();
    const commissions = await prisma.commission.findMany({
      where: { affiliateId },
      distinct: ["customerId"],
      select: {
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    // Get commission stats for each customer
    const customersWithStats = await Promise.all(
      commissions.map(async (c) => {
        const [totalCommissions, totalAmount] = await Promise.all([
          prisma.commission.count({
            where: { affiliateId, customerId: c.customerId },
          }),
          prisma.commission.aggregate({
            where: { affiliateId, customerId: c.customerId },
            _sum: { commissionAmount: true },
          }),
        ]);

        return {
          ...c.customer,
          commissionStats: {
            totalCommissions,
            totalAmount: totalAmount._sum.commissionAmount || 0,
          },
        };
      }),
    );

    return customersWithStats;
  } catch (error) {
    logger.error("Get linked customers error", {
      error: error.message,
      affiliateId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get affiliate commission settings from auth-service (with caching)
 * @param {string} affiliateId - Affiliate user ID
 * @returns {Object} Affiliate commission settings
 */
async function getAffiliateSettings(affiliateId) {
  try {
    const redis = getRedisClient();
    const cacheKey = `affiliate:settings:${affiliateId}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from auth-service
    const authServiceUrl =
      process.env.AUTH_SERVICE_URL || "http://auth-service:3002";

    try {
      const response = await axios.get(
        `${authServiceUrl}/api/v1/users/${affiliateId}`,
        {
          headers: {
            "x-service-auth":
              process.env.SERVICE_AUTH_TOKEN || "internal-service-token",
          },
        },
      );

      const user = response.data.data.user;

      if (user.role !== "affiliate") {
        logger.warn("User is not an affiliate", {
          affiliateId,
          role: user.role,
          service: "user-service",
        });
        return null;
      }

      const settings = {
        commissionType: user.commissionType || "FLAT",
        commissionRate: user.commissionRate || 0,
      };

      // Cache for 5 minutes
      await redis.setEx(cacheKey, 300, JSON.stringify(settings));

      return settings;
    } catch (apiError) {
      logger.error("Failed to fetch affiliate settings from auth-service", {
        error: apiError.message,
        affiliateId,
        service: "user-service",
      });
      return null;
    }
  } catch (error) {
    logger.error("Get affiliate settings error", {
      error: error.message,
      affiliateId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Invalidate affiliate cache
 * @param {string} affiliateId - Affiliate ID
 */
async function invalidateAffiliateCache(affiliateId) {
  try {
    const redis = getRedisClient();
    await Promise.all([
      redis.del(`affiliate:stats:${affiliateId}`),
      redis.del(`affiliate:settings:${affiliateId}`),
    ]);

    logger.info("Affiliate cache invalidated", {
      affiliateId,
      service: "user-service",
    });
  } catch (error) {
    logger.error("Invalidate affiliate cache error", {
      error: error.message,
      affiliateId,
      service: "user-service",
    });
    // Don't throw - cache invalidation failure shouldn't break the flow
  }
}

module.exports = {
  calculateCommission,
  trackCommission,
  trackCustomerSignup,
  getAffiliateStats,
  getRecentCommissions,
  getLinkedCustomers,
  getAffiliateSettings,
  invalidateAffiliateCache,
};
