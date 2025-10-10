// Assignment Controller - Team member assignment management for RBAC system
// Handles customer assignment to accounts/sales/support team members

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { authUtils } = require("../shared/lib/auth");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Assign customers to team member
 * Permission: user:assign:parent
 */
async function assignCustomers(req, res) {
  try {
    const { userId, customerIds, accessLevel = "RESTRICTED" } = req.body;

    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only client role can assign customers.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Verify user belongs to this client
    const clientUser = await prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
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

    // Verify all customers belong to this client
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        clientId,
      },
    });

    if (customers.length !== customerIds.length) {
      throw new UserServiceError(
        "Some customers do not belong to this client",
        "INVALID_CUSTOMERS",
        400,
      );
    }

    // Update client user with assigned customers
    const result = await prisma.$transaction(async (tx) => {
      // Get current assignments
      const currentClientUser = await tx.clientUser.findUnique({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
      });

      // Merge with existing assignments (avoid duplicates)
      const existingIds = currentClientUser.assignedCustomerIds || [];
      const newAssignedIds = [...new Set([...existingIds, ...customerIds])];

      const updatedClientUser = await tx.clientUser.update({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
        data: {
          assignedCustomerIds: newAssignedIds,
          accessLevel,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId,
          action: "ASSIGN_CUSTOMERS",
          resource: "ClientUser",
          resourceId: updatedClientUser.id,
          changes: {
            assigned: {
              userId,
              customerIds,
              accessLevel,
              previousCount: existingIds.length,
              newCount: newAssignedIds.length,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/assignments/customers",
            assignedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Invalidate permission cache for user
      await authUtils.invalidatePermissionCache(userId);

      return updatedClientUser;
    });

    logger.info("Customers assigned successfully", {
      userId,
      customerIds,
      accessLevel,
      assignedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        clientUser: result,
        message: `${customerIds.length} customer(s) assigned successfully`,
        assignedCount: customerIds.length,
      }),
    );
  } catch (error) {
    logger.error("Assign customers error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Unassign customers from team member
 * Permission: user:assign:parent
 */
async function unassignCustomers(req, res) {
  try {
    const { userId, customerIds } = req.body;

    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only client role can unassign customers.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Get current client user
    const currentClientUser = await prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
    });

    if (!currentClientUser) {
      throw new UserServiceError(
        "User is not associated with this client",
        "USER_NOT_FOUND",
        404,
      );
    }

    // Remove specified customer IDs
    const result = await prisma.$transaction(async (tx) => {
      const existingIds = currentClientUser.assignedCustomerIds || [];
      const remainingIds = existingIds.filter(
        (id) => !customerIds.includes(id),
      );

      const updatedClientUser = await tx.clientUser.update({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
        data: {
          assignedCustomerIds: remainingIds,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId,
          action: "UNASSIGN_CUSTOMERS",
          resource: "ClientUser",
          resourceId: updatedClientUser.id,
          changes: {
            unassigned: {
              userId,
              customerIds,
              previousCount: existingIds.length,
              newCount: remainingIds.length,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/assignments/customers",
            unassignedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Invalidate permission cache for user
      await authUtils.invalidatePermissionCache(userId);

      return updatedClientUser;
    });

    logger.info("Customers unassigned successfully", {
      userId,
      customerIds,
      unassignedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        clientUser: result,
        message: `${customerIds.length} customer(s) unassigned successfully`,
        unassignedCount: customerIds.length,
      }),
    );
  } catch (error) {
    logger.error("Unassign customers error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Bulk assignment operation
 * Permission: user:assign:parent
 */
async function bulkAssignment(req, res) {
  try {
    const { assignments } = req.body;

    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only client role can perform bulk assignments.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    const results = await prisma.$transaction(async (tx) => {
      const updatedUsers = [];

      for (const assignment of assignments) {
        const { userId, customerIds, accessLevel = "RESTRICTED" } = assignment;

        // Verify user belongs to client
        const clientUser = await tx.clientUser.findUnique({
          where: {
            clientId_userId: {
              clientId,
              userId,
            },
          },
        });

        if (!clientUser) {
          logger.warn(
            `Skipping assignment for user ${userId} - not found in client`,
            {
              clientId,
              userId,
            },
          );
          continue;
        }

        // Verify customers belong to client
        const customers = await tx.customer.findMany({
          where: {
            id: { in: customerIds },
            clientId,
          },
        });

        if (customers.length !== customerIds.length) {
          logger.warn(
            `Skipping assignment for user ${userId} - invalid customers`,
            {
              clientId,
              userId,
              requestedCount: customerIds.length,
              validCount: customers.length,
            },
          );
          continue;
        }

        // Update assignments
        const existingIds = clientUser.assignedCustomerIds || [];
        const newAssignedIds = [...new Set([...existingIds, ...customerIds])];

        const updated = await tx.clientUser.update({
          where: {
            clientId_userId: {
              clientId,
              userId,
            },
          },
          data: {
            assignedCustomerIds: newAssignedIds,
            accessLevel,
          },
        });

        updatedUsers.push(updated);

        // Invalidate permission cache for user
        await authUtils.invalidatePermissionCache(userId);
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId,
          action: "BULK_ASSIGN_CUSTOMERS",
          resource: "ClientUser",
          changes: {
            bulkAssignment: {
              totalAssignments: assignments.length,
              successfulAssignments: updatedUsers.length,
              failedAssignments: assignments.length - updatedUsers.length,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/assignments/bulk",
            assignedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedUsers;
    });

    logger.info("Bulk assignment completed", {
      totalRequested: assignments.length,
      successful: results.length,
      assignedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "Bulk assignment completed",
        totalRequested: assignments.length,
        successful: results.length,
        failed: assignments.length - results.length,
        updatedUsers: results,
      }),
    );
  } catch (error) {
    logger.error("Bulk assignment error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update access level for team member
 * Permission: user:update:parent
 */
async function updateAccessLevel(req, res) {
  try {
    const { userId } = req.params;
    const { accessLevel } = req.body;

    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only client role can update access levels.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Get current client user
    const currentClientUser = await prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
    });

    if (!currentClientUser) {
      throw new UserServiceError(
        "User is not associated with this client",
        "USER_NOT_FOUND",
        404,
      );
    }

    // Update access level
    const result = await prisma.$transaction(async (tx) => {
      const updatedClientUser = await tx.clientUser.update({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
        data: {
          accessLevel,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId,
          action: "UPDATE_ACCESS_LEVEL",
          resource: "ClientUser",
          resourceId: updatedClientUser.id,
          changes: {
            accessLevel: {
              before: currentClientUser.accessLevel,
              after: accessLevel,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/users/${userId}/access-level`,
            updatedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Invalidate permission cache for user
      await authUtils.invalidatePermissionCache(userId);

      return updatedClientUser;
    });

    logger.info("Access level updated successfully", {
      userId,
      previousAccessLevel: currentClientUser.accessLevel,
      newAccessLevel: accessLevel,
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        clientUser: result,
        message: "Access level updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Update access level error", {
      error: error.message,
      userId: req.params.userId,
      requestingUser: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  assignCustomers,
  unassignCustomers,
  bulkAssignment,
  updateAccessLevel,
};
