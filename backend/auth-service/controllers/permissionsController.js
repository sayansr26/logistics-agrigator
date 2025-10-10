const { prisma } = require("../config/database");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Get effective permissions for a user
 * Merges role-based permissions with user-specific overrides
 *
 * @route GET /api/v1/permissions/user/:userId
 * @access Internal/Authenticated
 */
async function getUserPermissions(req, res) {
  try {
    const { userId } = req.params;

    logger.info(`Fetching permissions for user: ${userId}`);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      logger.warn(`Permission request for non-existent user: ${userId}`);
      return res
        .status(404)
        .json(APIResponse.error("User not found", "USER_NOT_FOUND", null, 404));
    }

    if (!user.isActive) {
      logger.warn(`Permission request for inactive user: ${userId}`);
      return res
        .status(403)
        .json(
          APIResponse.error("User is inactive", "USER_INACTIVE", null, 403),
        );
    }

    // Get role-based permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      include: {
        permission: {
          select: {
            id: true,
            module: true,
            action: true,
            scope: true,
            description: true,
            isActive: true,
          },
        },
      },
    });

    // Get user-specific permission overrides
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId: user.id },
      include: {
        permission: {
          select: {
            id: true,
            module: true,
            action: true,
            scope: true,
            description: true,
            isActive: true,
          },
        },
      },
    });

    // Merge permissions (user overrides take precedence)
    const permMap = new Map();

    // Add role permissions (only active ones)
    rolePermissions.forEach((rp) => {
      if (rp.permission && rp.permission.isActive) {
        const key = `${rp.permission.module}:${rp.permission.action}:${rp.permission.scope}`;
        // Remove isActive from the stored permission object
        const { isActive, ...permissionData } = rp.permission;
        permMap.set(key, permissionData);
      }
    });

    // Apply user overrides (isGranted=true adds, isGranted=false removes, only active)
    userPermissions.forEach((up) => {
      if (up.permission && up.permission.isActive) {
        const key = `${up.permission.module}:${up.permission.action}:${up.permission.scope}`;
        if (up.isGranted) {
          const { isActive, ...permissionData } = up.permission;
          permMap.set(key, permissionData);
        } else {
          permMap.delete(key); // User explicitly denied this permission
        }
      }
    });

    const effectivePermissions = Array.from(permMap.values());

    logger.info(
      `Retrieved ${effectivePermissions.length} effective permissions for user ${userId} (role: ${user.role})`,
    );

    // Create audit log for permission retrieval
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        action: "GET_USER_PERMISSIONS",
        resource: "Permission",
        resourceId: userId,
        changes: {
          targetUserId: userId,
          targetUserRole: user.role,
          permissionCount: effectivePermissions.length,
          requestedBy: req.user?.userId || "internal",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    return res.json(
      APIResponse.success({
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: effectivePermissions,
        stats: {
          rolePermissions: rolePermissions.length,
          userOverrides: userPermissions.length,
          effective: effectivePermissions.length,
        },
      }),
    );
  } catch (error) {
    logger.error("Get user permissions error:", error);
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve permissions",
          "PERMISSION_FETCH_ERROR",
          null,
          500,
        ),
      );
  }
}

/**
 * Get all available permissions in the system
 *
 * @route GET /api/v1/permissions
 * @access Admin
 */
async function getAllPermissions(req, res) {
  try {
    const { module, isActive } = req.query;

    const where = {};
    if (module) where.module = module;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const permissions = await prisma.permission.findMany({
      where,
      orderBy: [{ module: "asc" }, { action: "asc" }, { scope: "asc" }],
    });

    logger.info(
      `Retrieved ${permissions.length} permissions (filters: ${JSON.stringify(where)})`,
    );

    return res.json(
      APIResponse.success({
        permissions,
        count: permissions.length,
      }),
    );
  } catch (error) {
    logger.error("Get all permissions error:", error);
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve permissions",
          "PERMISSION_LIST_ERROR",
          null,
          500,
        ),
      );
  }
}

/**
 * Get role permissions
 *
 * @route GET /api/v1/permissions/role/:role
 * @access Admin
 */
async function getRolePermissions(req, res) {
  try {
    const { role } = req.params;

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role },
      include: {
        permission: {
          select: {
            id: true,
            module: true,
            action: true,
            scope: true,
            description: true,
            isActive: true,
          },
        },
      },
    });

    const permissions = rolePermissions
      .filter((rp) => rp.permission && rp.permission.isActive)
      .map((rp) => {
        const { isActive, ...permissionData } = rp.permission;
        return permissionData;
      });

    logger.info(
      `Retrieved ${permissions.length} permissions for role: ${role}`,
    );

    return res.json(
      APIResponse.success({
        role,
        permissions,
        count: permissions.length,
      }),
    );
  } catch (error) {
    logger.error("Get role permissions error:", error);
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve role permissions",
          "ROLE_PERMISSION_ERROR",
          null,
          500,
        ),
      );
  }
}

module.exports = {
  getUserPermissions,
  getAllPermissions,
  getRolePermissions,
};
