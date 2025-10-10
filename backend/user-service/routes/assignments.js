// Assignment Routes - RBAC-006 Team Assignment APIs
// Routes for assigning customers to team members

const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const { authMiddleware } = require("../shared/lib/auth");
const {
  validateAssignCustomers,
  validateUnassignCustomers,
  validateBulkAssignment,
  validateUpdateAccessLevel,
} = require("../validation/customerSchemas");

/**
 * @swagger
 * tags:
 *   name: Assignments
 *   description: Team member customer assignment endpoints (RBAC-006)
 */

/**
 * @swagger
 * /api/v1/assignments/customers:
 *   post:
 *     summary: Assign customers to team member
 *     description: Assign one or more customers to accounts/sales/support team member (Permission - user:assign:parent)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - customerIds
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Team member user ID
 *               customerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of customer IDs to assign
 *               accessLevel:
 *                 type: string
 *                 enum: [FULL, RESTRICTED]
 *                 default: RESTRICTED
 *     responses:
 *       200:
 *         description: Customers assigned successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User or customers not found
 */
router.post(
  "/v1/assignments/customers",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "assign", "parent"),
  validateAssignCustomers,
  assignmentController.assignCustomers,
);

/**
 * @swagger
 * /api/v1/assignments/customers:
 *   delete:
 *     summary: Unassign customers from team member
 *     description: Remove customer assignments from team member (Permission - user:assign:parent)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - customerIds
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               customerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Customers unassigned successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.delete(
  "/v1/assignments/customers",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "assign", "parent"),
  validateUnassignCustomers,
  assignmentController.unassignCustomers,
);

/**
 * @swagger
 * /api/v1/assignments/bulk:
 *   post:
 *     summary: Bulk customer assignments
 *     description: Assign multiple customers to multiple team members in one operation (Permission - user:assign:parent)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignments
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - customerIds
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     customerIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *                     accessLevel:
 *                       type: string
 *                       enum: [FULL, RESTRICTED]
 *                       default: RESTRICTED
 *     responses:
 *       200:
 *         description: Bulk assignment completed
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  "/v1/assignments/bulk",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "assign", "parent"),
  validateBulkAssignment,
  assignmentController.bulkAssignment,
);

/**
 * @swagger
 * /api/v1/users/{userId}/access-level:
 *   put:
 *     summary: Update team member access level
 *     description: Switch team member between FULL and RESTRICTED access (Permission - user:update:parent)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessLevel
 *             properties:
 *               accessLevel:
 *                 type: string
 *                 enum: [FULL, RESTRICTED]
 *     responses:
 *       200:
 *         description: Access level updated successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.put(
  "/v1/users/:userId/access-level",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "parent"),
  validateUpdateAccessLevel,
  assignmentController.updateAccessLevel,
);

module.exports = router;
