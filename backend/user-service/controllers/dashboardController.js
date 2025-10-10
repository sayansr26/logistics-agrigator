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
    const [clientInfo, customerStats, userStats] = await Promise.all([
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

      // Customer statistics
      prisma.$transaction(async (tx) => {
        const [totalCustomers, activeCustomers, customersByModule] =
          await Promise.all([
            tx.customer.count({ where: { clientId } }),
            tx.customer.count({ where: { clientId, isActive: true } }),
            tx.customer.groupBy({
              by: ["enabledModules"],
              where: { clientId, isActive: true },
              _count: { id: true },
            }),
          ]);

        return {
          total: totalCustomers,
          active: activeCustomers,
          inactive: totalCustomers - activeCustomers,
          moduleDistribution: customersByModule,
        };
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
        customers: customerStats,
        users: userStats,
        summary: {
          totalCustomers: customerStats.total,
          activeCustomers: customerStats.active,
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
 * Get customer dashboard with metrics
 * Permission: analytics:read:own
 */
async function getCustomerDashboard(req, res) {
  try {
    // Get customer ID from authenticated user
    const customerId = req.user.customerId || req.user.id;

    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            customerUsers: true,
          },
        },
      },
    });

    if (!customer) {
      throw new UserServiceError(
        "Customer not found",
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Get team member stats
    const teamStats = await prisma.customerUser.groupBy({
      by: ["role"],
      where: { customerId, isActive: true },
      _count: { id: true },
    });

    // Calculate shipment usage (if applicable)
    let shipmentUsage = null;
    if (customer.monthlyShipmentLimit) {
      // This would require integration with shipment-service
      // For now, return placeholder
      shipmentUsage = {
        limit: customer.monthlyShipmentLimit,
        used: 0, // TODO: Get from shipment-service
        remaining: customer.monthlyShipmentLimit,
        percentage: 0,
      };
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        clientId: customer.clientId,
        action: "VIEW_CUSTOMER_DASHBOARD",
        resource: "Dashboard",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/dashboard/customer",
          requestingRole: req.user.role,
          customerId,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success({
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          enabledModules: customer.enabledModules,
          isActive: customer.isActive,
          client: customer.client,
        },
        team: {
          total: customer._count.customerUsers,
          roleDistribution: teamStats.reduce((acc, item) => {
            acc[item.role] = item._count.id;
            return acc;
          }, {}),
        },
        shipmentUsage,
        summary: {
          totalTeamMembers: customer._count.customerUsers,
          enabledModules: customer.enabledModules.length,
          monthlyShipmentLimit: customer.monthlyShipmentLimit,
        },
      }),
    );
  } catch (error) {
    logger.error("Get customer dashboard error", {
      error: error.message,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get team member dashboard with assigned customers
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

    // Get assigned customers
    const assignedCustomers = await prisma.customer.findMany({
      where: {
        id: { in: clientUser.assignedCustomerIds || [] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        enabledModules: true,
        monthlyShipmentLimit: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
          assignedCustomerCount: assignedCustomers.length,
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
        assignedCustomers: {
          customers: assignedCustomers,
          count: assignedCustomers.length,
        },
        summary: {
          role: clientUser.role,
          accessLevel: clientUser.accessLevel,
          assignedCustomerCount: assignedCustomers.length,
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
  getCustomerDashboard,
  getTeamDashboard,
};
