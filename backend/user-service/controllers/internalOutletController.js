// Internal Outlet Controller - Inter-service outlet lookups
// Handles internal requests from other microservices to resolve outlet data

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

const prisma = new PrismaClient();

/**
 * Get outlet details by userId
 * Called by internal services to resolve outlet badge tier and wallet phone
 * Requires X-Internal-Request header
 *
 * GET /api/v1/internal/outlets/by-user/:userId
 * Response: { found: boolean, outletId?: uuid, badge?: OutletBadge, phone?: string }
 */
async function getOutletByUser(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json(APIResponse.error("userId parameter is required", 400));
    }

    const outlet = await prisma.outlet.findUnique({
      where: { userId },
      select: {
        id: true,
        badge: true,
        name: true,
        phone: true,
        isActive: true,
        clientId: true,
        defaultMarkupType: true,
        defaultMarkupValue: true,
        maxMarkupFlat: true,
        maxMarkupPercent: true,
      },
    });

    if (!outlet) {
      logger.debug("No outlet found for userId", { userId });
      return res
        .status(200)
        .json(
          APIResponse.success(
            { found: false },
            "No outlet found for this user",
          ),
        );
    }

    logger.debug("Outlet badge resolved", {
      userId,
      outletId: outlet.id,
      badge: outlet.badge,
    });

    return res.status(200).json(
      APIResponse.success(
        {
          found: true,
          outletId: outlet.id,
          badge: outlet.badge,
          outletName: outlet.name,
          phone: outlet.phone,
          isActive: outlet.isActive,
          clientId: outlet.clientId,
          defaultMarkupType: outlet.defaultMarkupType,
          defaultMarkupValue: outlet.defaultMarkupValue,
          maxMarkupFlat: outlet.maxMarkupFlat,
          maxMarkupPercent: outlet.maxMarkupPercent,
        },
        "Outlet badge resolved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error resolving outlet by userId", {
      error: error.message,
      userId: req.params.userId,
    });
    return res
      .status(500)
      .json(APIResponse.error("Failed to resolve outlet badge", 500));
  }
}

/**
 * Get outlet details by outletId directly
 * Called by internal services when admin/superadmin creates shipment on behalf of an outlet
 * Requires X-Internal-Request header
 *
 * GET /api/v1/internal/outlets/:outletId/badge
 * Response: { found: boolean, outletId?: uuid, badge?: OutletBadge, phone?: string }
 */
async function getOutletBadgeById(req, res) {
  try {
    const { outletId } = req.params;

    if (!outletId) {
      return res
        .status(400)
        .json(APIResponse.error("outletId parameter is required", 400));
    }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true,
        badge: true,
        name: true,
        phone: true,
        isActive: true,
        clientId: true,
        defaultMarkupType: true,
        defaultMarkupValue: true,
        maxMarkupFlat: true,
        maxMarkupPercent: true,
      },
    });

    if (!outlet) {
      logger.debug("No outlet found for outletId", { outletId });
      return res
        .status(200)
        .json(
          APIResponse.success({ found: false }, "No outlet found for this ID"),
        );
    }

    logger.debug("Outlet badge resolved by ID", {
      outletId: outlet.id,
      badge: outlet.badge,
    });

    return res.status(200).json(
      APIResponse.success(
        {
          found: true,
          outletId: outlet.id,
          badge: outlet.badge,
          outletName: outlet.name,
          phone: outlet.phone,
          isActive: outlet.isActive,
          clientId: outlet.clientId,
          defaultMarkupType: outlet.defaultMarkupType,
          defaultMarkupValue: outlet.defaultMarkupValue,
          maxMarkupFlat: outlet.maxMarkupFlat,
          maxMarkupPercent: outlet.maxMarkupPercent,
        },
        "Outlet badge resolved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error resolving outlet by outletId", {
      error: error.message,
      outletId: req.params.outletId,
    });
    return res
      .status(500)
      .json(APIResponse.error("Failed to resolve outlet badge", 500));
  }
}

module.exports = {
  getOutletByUser,
  getOutletBadgeById,
};
