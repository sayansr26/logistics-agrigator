// Internal Outlet Controller - Inter-service outlet lookups
// Handles internal requests from other microservices to resolve outlet data

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

const prisma = new PrismaClient();

/**
 * Get outlet badge by userId
 * Called by partner-service to resolve outlet badge tier for discount packages
 * Requires X-Internal-Request header
 *
 * GET /api/v1/internal/outlets/by-user/:userId
 * Response: { found: boolean, outletId?: uuid, badge?: OutletBadge }
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
        isActive: true,
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
          isActive: outlet.isActive,
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

module.exports = {
  getOutletByUser,
};
