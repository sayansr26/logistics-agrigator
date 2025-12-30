// Dashboard Controller - Role-based dashboard endpoints for RBAC system
// Provides dashboard metrics and stats based on user role

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Get client dashboard with metrics
 * Permission: analytics:read:parent
 */
async function getClientDashboard(req, res) {
  try {
    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Get client info and stats
    const [clientInfo, userStats] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          slug: true,
          licenseStatus: true,
          licenseValidUntil: true,
          isActive: true,
          createdAt: true,
        },
      }),

      // User statistics
      prisma.$transaction(async (tx) => {
        const [totalUsers, activeUsers, usersByRole] = await Promise.all([
          tx.clientUser.count({ where: { clientId } }),
          tx.clientUser.count({ where: { clientId, isActive: true } }),
          tx.clientUser.groupBy({
            by: ["role"],
            where: { clientId, isActive: true },
            _count: { id: true },
          }),
        ]);

        return {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          roleDistribution: usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count.id;
            return acc;
          }, {}),
        };
      }),
    ]);

    // Calculate license days remaining
    let licenseDaysRemaining = null;
    if (clientInfo.licenseValidUntil) {
      const now = new Date();
      const validUntil = new Date(clientInfo.licenseValidUntil);
      licenseDaysRemaining = Math.ceil(
        (validUntil - now) / (1000 * 60 * 60 * 24),
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        clientId,
        action: "VIEW_CLIENT_DASHBOARD",
        resource: "Dashboard",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/dashboard/client",
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success({
        client: {
          ...clientInfo,
          licenseDaysRemaining,
        },
        users: userStats,
        summary: {
          totalUsers: userStats.total,
          activeUsers: userStats.active,
          licenseStatus: clientInfo.licenseStatus,
          licenseDaysRemaining,
        },
      }),
    );
  } catch (error) {
    logger.error("Get client dashboard error", {
      error: error.message,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get team member dashboard
 * Permission: analytics:read:assigned
 */
async function getTeamDashboard(req, res) {
  try {
    const userId = req.user.id;
    const clientId = req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only team members can access this dashboard.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Get client user info
    const clientUser = await prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!clientUser) {
      throw new UserServiceError(
        "User is not associated with this client",
        "USER_NOT_FOUND",
        404,
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        clientId,
        action: "VIEW_TEAM_DASHBOARD",
        resource: "Dashboard",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/dashboard/team",
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success({
        user: {
          id: userId,
          role: clientUser.role,
          accessLevel: clientUser.accessLevel,
          client: clientUser.client,
        },
        summary: {
          role: clientUser.role,
          accessLevel: clientUser.accessLevel,
          clientName: clientUser.client.name,
        },
      }),
    );
  } catch (error) {
    logger.error("Get team dashboard error", {
      error: error.message,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  getClientDashboard,
  getTeamDashboard,
};
