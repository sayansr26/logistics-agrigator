// Affiliate Controller - Affiliate registration and commission management for RBAC system
// Note: Commission tracking is currently disabled

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Register a new affiliate user (superadmin only)
 * Permission: user:create:all (affiliate module)
 */
async function registerAffiliate(req, res) {
  try {
    const {
      userId, // Reference to existing auth-service user
      commissionType = "PERCENTAGE",
      commissionRate,
      metadata,
    } = req.body;

    // Validate commission rate based on type
    if (
      commissionType === "PERCENTAGE" &&
      (commissionRate < 0 || commissionRate > 100)
    ) {
      throw new UserServiceError(
        "Commission rate for PERCENTAGE type must be between 0 and 100",
        "INVALID_COMMISSION_RATE",
        400,
      );
    }

    if (commissionType === "FLAT" && commissionRate < 0) {
      throw new UserServiceError(
        "Commission rate for FLAT type must be a positive number",
        "INVALID_COMMISSION_RATE",
        400,
      );
    }

    // Note: Actual user creation with role 'affiliate' happens in auth-service
    // This endpoint just validates and stores additional affiliate metadata

    // Create audit log for affiliate registration
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "REGISTER_AFFILIATE",
        resource: "Affiliate",
        resourceId: userId,
        changes: {
          created: {
            userId,
            commissionType,
            commissionRate,
            metadata,
          },
        },
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/admin/affiliates/register",
          registeredBy: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Affiliate registered successfully", {
      affiliateId: userId,
      commissionType,
      commissionRate,
      registeredBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        affiliate: {
          userId,
          commissionType,
          commissionRate,
          metadata,
        },
        message:
          "Affiliate registered successfully. User must be created in auth-service with role 'affiliate'.",
      }),
    );
  } catch (error) {
    logger.error("Register affiliate error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get affiliate profile with statistics
 * Permission: affiliate:read:own or affiliate:read:all (admin)
 */
async function getAffiliateProfile(req, res) {
  try {
    const { affiliateId } = req.params;

    // Check permission: affiliates can only view own profile, admins can view all
    if (
      req.user.role !== "superadmin" &&
      req.user.role !== "admin" &&
      req.user.id !== affiliateId
    ) {
      throw new UserServiceError(
        "Access denied. You can only view your own affiliate profile.",
        "AFFILIATE_ACCESS_DENIED",
        403,
      );
    }

    // Return basic affiliate profile (commission tracking removed)
    res.json(
      APIResponse.success({
        affiliate: {
          affiliateId,
          message: "Commission tracking is currently disabled",
        },
      }),
    );
  } catch (error) {
    logger.error("Get affiliate profile error", {
      error: error.message,
      affiliateId: req.params.affiliateId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update affiliate commission settings (superadmin only)
 * Permission: affiliate:update:all
 */
async function updateCommissionSettings(req, res) {
  try {
    const { affiliateId } = req.params;
    const { commissionType, commissionRate, metadata } = req.body;

    // Validate commission rate based on type
    if (
      commissionType === "PERCENTAGE" &&
      (commissionRate < 0 || commissionRate > 100)
    ) {
      throw new UserServiceError(
        "Commission rate for PERCENTAGE type must be between 0 and 100",
        "INVALID_COMMISSION_RATE",
        400,
      );
    }

    if (commissionType === "FLAT" && commissionRate < 0) {
      throw new UserServiceError(
        "Commission rate for FLAT type must be a positive number",
        "INVALID_COMMISSION_RATE",
        400,
      );
    }

    // Note: Actual update happens in auth-service User model
    // This is just a pass-through validation endpoint

    // Commission cache invalidation removed (commission tracking disabled)

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE_COMMISSION_SETTINGS",
        resource: "Affiliate",
        resourceId: affiliateId,
        changes: {
          updated: {
            commissionType,
            commissionRate,
            metadata,
          },
        },
        metadata: {
          source: "user-service",
          endpoint: `/api/v1/admin/affiliates/${affiliateId}/commission-settings`,
          updatedBy: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Affiliate commission settings updated", {
      affiliateId,
      commissionType,
      commissionRate,
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message:
          "Commission settings updated successfully. Changes must be applied in auth-service.",
        affiliate: {
          affiliateId,
          commissionType,
          commissionRate,
          metadata,
        },
      }),
    );
  } catch (error) {
    logger.error("Update commission settings error", {
      error: error.message,
      affiliateId: req.params.affiliateId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get affiliate dashboard with commission stats
 * Permission: affiliate:read:own
 * Note: Commission tracking is currently disabled
 */
async function getAffiliateDashboard(req, res) {
  try {
    const affiliateId = req.user.id; // Current user's ID

    // Verify user is affiliate
    if (req.user.role !== "affiliate") {
      throw new UserServiceError(
        "Access denied. Only affiliates can access this dashboard.",
        "AFFILIATE_ONLY",
        403,
      );
    }

    // Commission tracking is disabled - return empty dashboard
    res.json(
      APIResponse.success({
        dashboard: {
          affiliateId,
          stats: {
            totalCommission: 0,
            pendingCommission: 0,
            approvedCommission: 0,
            paidCommission: 0,
            totalReferrals: 0,
          },
          recentCommissions: [],
          referrals: [],
          message: "Commission tracking is currently disabled",
        },
      }),
    );
  } catch (error) {
    logger.error("Get affiliate dashboard error", {
      error: error.message,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List all commissions for an affiliate
 * Permission: affiliate:read:own or affiliate:read:all (admin)
 * Note: Commission tracking is currently disabled
 */
async function listCommissions(req, res) {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const affiliateId =
      req.user.role === "affiliate"
        ? req.user.id
        : req.params.affiliateId || req.query.affiliateId;

    if (!affiliateId) {
      throw new UserServiceError(
        "Affiliate ID is required",
        "AFFILIATE_ID_REQUIRED",
        400,
      );
    }

    // Check permission
    if (
      req.user.role !== "superadmin" &&
      req.user.role !== "admin" &&
      req.user.id !== affiliateId
    ) {
      throw new UserServiceError(
        "Access denied. You can only view your own commissions.",
        "COMMISSION_ACCESS_DENIED",
        403,
      );
    }

    // Commission tracking is disabled - return empty data
    res.json(
      APIResponse.success({
        commissions: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0,
          hasMore: false,
          hasPrevious: false,
        },
        filters: {
          status,
          startDate,
          endDate,
        },
        message: "Commission tracking is currently disabled",
      }),
    );
  } catch (error) {
    logger.error("List commissions error", {
      error: error.message,
      userId: req.user.id,
      query: req.query,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List referrals by affiliate
 * Permission: affiliate:read:own or affiliate:read:assigned (admin)
 * Note: Referral tracking is currently disabled
 */
async function listReferrals(req, res) {
  try {
    const affiliateId =
      req.user.role === "affiliate" ? req.user.id : req.params.affiliateId;

    if (!affiliateId) {
      throw new UserServiceError(
        "Affiliate ID is required",
        "AFFILIATE_ID_REQUIRED",
        400,
      );
    }

    // Check permission
    if (
      req.user.role !== "superadmin" &&
      req.user.role !== "admin" &&
      req.user.id !== affiliateId
    ) {
      throw new UserServiceError(
        "Access denied. You can only view your own referrals.",
        "ACCESS_DENIED",
        403,
      );
    }

    // Referral tracking is disabled - return empty array
    res.json(
      APIResponse.success({
        referrals: [],
        count: 0,
        message: "Referral tracking is currently disabled",
      }),
    );
  } catch (error) {
    logger.error("List referrals error", {
      error: error.message,
      affiliateId: req.params.affiliateId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  registerAffiliate,
  getAffiliateProfile,
  updateCommissionSettings,
  getAffiliateDashboard,
  listCommissions,
  listReferrals,
};
