// Affiliate Controller - Affiliate registration and commission management for RBAC system
// Handles affiliate registration, commission tracking, and customer linking

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");
const commissionService = require("../services/commissionService");

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

    // Get affiliate statistics
    const stats = await commissionService.getAffiliateStats(affiliateId);

    res.json(
      APIResponse.success({
        affiliate: {
          affiliateId,
          ...stats,
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

    // Invalidate cache for affiliate commission settings
    await commissionService.invalidateAffiliateCache(affiliateId);

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
 * Link customer to affiliate for referral tracking
 * Permission: affiliate:manage:assigned or customer:update:assigned
 */
async function linkCustomer(req, res) {
  try {
    const { customerId } = req.params;
    const { affiliateId } = req.body;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new UserServiceError(
        `Customer with ID '${customerId}' not found`,
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Note: Affiliate linking can be tracked via assignedCustomerIds in auth-service User model
    // This endpoint creates a commission record for tracking purposes

    // Create initial commission record (pending) for customer signup
    const commission = await commissionService.trackCustomerSignup(
      affiliateId,
      customerId,
    );

    logger.info("Customer linked to affiliate", {
      customerId,
      affiliateId,
      commissionId: commission.id,
      linkedBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        message: "Customer linked to affiliate successfully",
        commission,
      }),
    );
  } catch (error) {
    logger.error("Link customer error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get affiliate dashboard with commission stats
 * Permission: affiliate:read:own
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

    // Get dashboard statistics
    const stats = await commissionService.getAffiliateStats(affiliateId);
    const recentCommissions = await commissionService.getRecentCommissions(
      affiliateId,
      10,
    );
    const linkedCustomers =
      await commissionService.getLinkedCustomers(affiliateId);

    res.json(
      APIResponse.success({
        dashboard: {
          affiliateId,
          stats,
          recentCommissions,
          linkedCustomers,
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
 */
async function listCommissions(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      startDate,
      endDate,
    } = req.query;

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

    const skip = (page - 1) * limit;

    // Build where clause
    const where = { affiliateId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.commission.count({ where }),
    ]);

    const hasMore = skip + commissions.length < total;
    const totalPages = Math.ceil(total / limit);

    res.json(
      APIResponse.success({
        commissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        filters: {
          status,
          startDate,
          endDate,
        },
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
 * List customers referred by affiliate
 * Permission: affiliate:read:own or affiliate:read:assigned (admin)
 */
async function listReferredCustomers(req, res) {
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
        "Access denied. You can only view your own referred customers.",
        "CUSTOMER_ACCESS_DENIED",
        403,
      );
    }

    const customers = await commissionService.getLinkedCustomers(affiliateId);

    res.json(
      APIResponse.success({
        customers,
        count: customers.length,
      }),
    );
  } catch (error) {
    logger.error("List referred customers error", {
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
  linkCustomer,
  getAffiliateDashboard,
  listCommissions,
  listReferredCustomers,
};
