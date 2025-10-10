const express = require("express");
const router = express.Router();
const permissionsController = require("../controllers/permissionsController");
const { authenticate } = require("../middleware/auth");
const { authMiddleware: sharedAuthMiddleware } = require("../shared/lib/auth");

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Permission management and retrieval endpoints
 */

/**
 * @swagger
 * /api/v1/permissions/user/{userId}:
 *   get:
 *     tags: [Permissions]
 *     summary: Get effective permissions for a user
 *     description: Returns role-based permissions merged with user-specific overrides. This endpoint is used internally by other services to check user permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *         example: 123e4567-e89b-12d3-a456-426614174000
 *       - in: header
 *         name: X-Internal-Request
 *         schema:
 *           type: string
 *         description: Internal service request marker (optional)
 *         example: "true"
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     role:
 *                       type: string
 *                       enum: [superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, affiliate]
 *                       example: client
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           module:
 *                             type: string
 *                             example: shipment
 *                           action:
 *                             type: string
 *                             example: create
 *                           scope:
 *                             type: string
 *                             example: parent
 *                           description:
 *                             type: string
 *                             example: Create shipments for parent client
 *                     stats:
 *                       type: object
 *                       properties:
 *                         rolePermissions:
 *                           type: number
 *                           example: 15
 *                         userOverrides:
 *                           type: number
 *                           example: 2
 *                         effective:
 *                           type: number
 *                           example: 17
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *             example:
 *               status: success
 *               data:
 *                 userId: 123e4567-e89b-12d3-a456-426614174000
 *                 email: client@example.com
 *                 role: client
 *                 permissions:
 *                   - id: perm-001
 *                     module: shipment
 *                     action: create
 *                     scope: parent
 *                     description: Create shipments for parent client
 *                   - id: perm-002
 *                     module: customer
 *                     action: read
 *                     scope: assigned
 *                     description: Read assigned customer data
 *                 stats:
 *                   rolePermissions: 15
 *                   userOverrides: 2
 *                   effective: 17
 *               meta:
 *                 timestamp: '2024-01-01T00:00:00.000Z'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: USER_NOT_FOUND
 *                     message:
 *                       type: string
 *                       example: User not found
 *       403:
 *         description: User is inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: USER_INACTIVE
 *                     message:
 *                       type: string
 *                       example: User is inactive
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: PERMISSION_FETCH_ERROR
 *                     message:
 *                       type: string
 *                       example: Failed to retrieve permissions
 */
router.get(
  "/user/:userId",
  authenticate,
  permissionsController.getUserPermissions,
);

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: Get all available permissions
 *     description: Returns all permissions in the system with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         description: Filter by module
 *         example: shipment
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get(
  "/",
  authenticate,
  sharedAuthMiddleware.requirePermission("permission", "read", "all"),
  permissionsController.getAllPermissions,
);

/**
 * @swagger
 * /api/v1/permissions/role/{role}:
 *   get:
 *     tags: [Permissions]
 *     summary: Get permissions for a specific role
 *     description: Returns all permissions assigned to a role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, affiliate]
 *         description: Role name
 *         example: client
 *     responses:
 *       200:
 *         description: Role permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       example: client
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get(
  "/role/:role",
  authenticate,
  sharedAuthMiddleware.requirePermission("permission", "read", "all"),
  permissionsController.getRolePermissions,
);

module.exports = router;
