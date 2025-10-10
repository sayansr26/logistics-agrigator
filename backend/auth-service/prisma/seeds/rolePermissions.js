/**
 * Role-Permission Mapping Seed Data
 *
 * This file maps permissions to roles based on the DEFAULT_ROLE_PERMISSIONS
 * from shared/constants/permissions.js
 *
 * @module seeds/rolePermissions
 */

const {
  DEFAULT_ROLE_PERMISSIONS,
} = require("../../shared/constants/permissions");

/**
 * Seed role-permission mappings
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Array} permissions - Array of created permissions with IDs
 * @returns {Promise<Object>} Statistics about created role permissions
 */
async function seedRolePermissions(prisma, permissions) {
  console.log("\n📋 Seeding role-permission mappings...");

  // Create a permission lookup map for quick access
  const permissionMap = new Map();
  permissions.forEach((perm) => {
    const key = `${perm.module}:${perm.action}:${perm.scope}`;
    permissionMap.set(key, perm.id);
  });

  const stats = {
    total: 0,
    byRole: {},
  };

  // Process each role
  for (const [role, permissionPatterns] of Object.entries(
    DEFAULT_ROLE_PERMISSIONS,
  )) {
    console.log(`\n  Processing role: ${role}`);
    const rolePerms = [];

    for (const pattern of permissionPatterns) {
      // Expand wildcard patterns
      const matchingPerms = expandWildcardPattern(
        pattern,
        permissions,
        permissionMap,
      );

      if (matchingPerms.length === 0) {
        console.warn(
          `    Warning: No permissions found for pattern "${pattern}"`,
        );
        continue;
      }

      rolePerms.push(...matchingPerms);
    }

    // Remove duplicates
    const uniquePerms = [...new Set(rolePerms)];

    // Create role-permission entries
    let createdCount = 0;
    for (const permissionId of uniquePerms) {
      try {
        await prisma.rolePermission.upsert({
          where: {
            role_permissionId: {
              role,
              permissionId,
            },
          },
          update: {},
          create: {
            role,
            permissionId,
          },
        });
        createdCount++;
      } catch (error) {
        console.error(`    Error creating role permission: ${error.message}`);
      }
    }

    stats.byRole[role] = createdCount;
    stats.total += createdCount;
    console.log(`    ✓ Created ${createdCount} permissions for ${role}`);
  }

  console.log(`\n✅ Total role-permission mappings created: ${stats.total}`);
  return stats;
}

/**
 * Expand wildcard patterns to matching permission IDs
 * @param {string} pattern - Permission pattern (e.g., 'shipment:*:own')
 * @param {Array} permissions - All permissions
 * @param {Map} permissionMap - Permission lookup map
 * @returns {Array<string>} Array of matching permission IDs
 */
function expandWildcardPattern(pattern, permissions, permissionMap) {
  const [modulePattern, actionPattern, scopePattern] = pattern.split(":");

  // If no wildcards, do direct lookup
  if (!pattern.includes("*")) {
    const permId = permissionMap.get(pattern);
    return permId ? [permId] : [];
  }

  // Find all matching permissions
  return permissions
    .filter((perm) => {
      const moduleMatch =
        modulePattern === "*" || perm.module === modulePattern;
      const actionMatch =
        actionPattern === "*" || perm.action === actionPattern;
      const scopeMatch = scopePattern === "*" || perm.scope === scopePattern;
      return moduleMatch && actionMatch && scopeMatch;
    })
    .map((perm) => perm.id);
}

/**
 * Get role permission summary for logging/verification
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Promise<Object>} Summary of permissions by role
 */
async function getRolePermissionSummary(prisma) {
  const roles = [
    "superadmin",
    "admin",
    "client",
    "accounts",
    "sales",
    "support",
    "customer",
    "customer_account",
    "customer_sales",
    "customer_support",
    "affiliate",
  ];

  const summary = {};

  for (const role of roles) {
    const count = await prisma.rolePermission.count({
      where: { role },
    });

    const permissions = await prisma.rolePermission.findMany({
      where: { role },
      include: {
        permission: {
          select: {
            module: true,
            action: true,
            scope: true,
          },
        },
      },
      take: 5, // Only show first 5 as examples
    });

    summary[role] = {
      count,
      examples: permissions.map(
        (rp) =>
          `${rp.permission.module}:${rp.permission.action}:${rp.permission.scope}`,
      ),
    };
  }

  return summary;
}

module.exports = {
  seedRolePermissions,
  getRolePermissionSummary,
};
