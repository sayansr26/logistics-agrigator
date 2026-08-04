// Outlet Routes - Outlet and address management
// Handles outlet CRUD and address operations

const express = require("express");
const router = express.Router();

// Import middleware
const { authMiddleware } = require("../shared/lib/auth");
const { validate } = require("../middleware/validate");

// Import controller
const OutletController = require("../controllers/outletController");

// Import validation schemas
const {
  createOutletSchema,
  updateOutletSchema,
  updateBadgeSchema,
  updateMarkupSchema,
  updateMarkupLimitsSchema,
  createAddressSchema,
  updateAddressSchema,
  listOutletsQuerySchema,
} = require("../validation/outletSchemas");

/**
 * @swagger
 * /api/outlets:
 *   post:
 *     tags: [Outlets]
 *     summary: Create a new outlet
 *     description: Create an outlet/customer portal user with optional addresses (client/admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               companyName:
 *                 type: string
 *               category:
 *                 type: string
 *               tanPan:
 *                 type: string
 *               gst:
 *                 type: string
 *               companyAddress:
 *                 type: object
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Outlet created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Outlet already exists
 */
router.post(
  "/outlets",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "create", "parent"),
  validate(createOutletSchema),
  OutletController.createOutlet,
);

/**
 * @swagger
 * /api/outlets:
 *   get:
 *     tags: [Outlets]
 *     summary: List outlets
 *     description: List all outlets for a client (client/admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Outlets retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/outlets",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "read", "parent"),
  validate(listOutletsQuerySchema, "query"),
  OutletController.listOutlets,
);

/**
 * @swagger
 * /api/outlets/me:
 *   get:
 *     tags: [Outlets]
 *     summary: Get own outlet info
 *     description: Get outlet information for authenticated outlet user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Outlet info retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Outlet not found
 */
router.get(
  "/outlets/me",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  OutletController.getMyOutlet,
);

/**
 * @swagger
 * /api/outlets/{id}:
 *   get:
 *     tags: [Outlets]
 *     summary: Get outlet by ID
 *     description: Get outlet details (client/admin or outlet itself)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Outlet retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
/**
 * @swagger
 * /api/outlets/me/markup:
 *   put:
 *     tags: [Outlets]
 *     summary: Update own default markup/commission preference (outlet)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Markup preference updated
 *       400:
 *         description: Validation error or cap exceeded
 */
router.put(
  "/outlets/me/markup",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  validate(updateMarkupSchema),
  OutletController.updateMyMarkup,
);

/**
 * @swagger
 * /api/outlets/{id}/markup-limits:
 *   put:
 *     tags: [Outlets]
 *     summary: Update markup caps for an outlet (admin/client)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Markup limits updated
 */
router.put(
  "/outlets/:id/markup-limits",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "parent"),
  validate(updateMarkupLimitsSchema),
  OutletController.updateMarkupLimits,
);

router.get(
  "/outlets/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "read", "own"),
  OutletController.getOutlet,
);

/**
 * @swagger
 * /api/outlets/{id}:
 *   put:
 *     tags: [Outlets]
 *     summary: Update outlet
 *     description: Update outlet information (client/admin or outlet itself for limited fields)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *     responses:
 *       200:
 *         description: Outlet updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
router.put(
  "/outlets/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "own"),
  validate(updateOutletSchema),
  OutletController.updateOutlet,
);

/**
 * @swagger
 * /api/outlets/{id}:
 *   delete:
 *     tags: [Outlets]
 *     summary: Delete outlet
 *     description: Soft delete an outlet (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Outlet deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
router.delete(
  "/outlets/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "delete", "parent"),
  OutletController.deleteOutlet,
);

/**
 * @swagger
 * /api/outlets/{id}/status:
 *   patch:
 *     tags: [Outlets]
 *     summary: Toggle outlet status
 *     description: Activate or deactivate an outlet (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Outlet status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
router.patch(
  "/outlets/:id/status",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "parent"),
  OutletController.toggleOutletStatus,
);

/**
 * @swagger
 * /api/outlets/{id}/badge:
 *   patch:
 *     tags: [Outlets]
 *     summary: Update outlet badge
 *     description: Assign or change an outlet's badge tier (admin/client only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required: [badge]
 *             properties:
 *               badge:
 *                 type: string
 *                 enum: [BASIC, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND]
 *     responses:
 *       200:
 *         description: Badge updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
router.patch(
  "/outlets/:id/badge",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "parent"),
  validate(updateBadgeSchema),
  OutletController.updateBadge,
);

/**
 * @swagger
 * /api/outlets/{id}/reset-password:
 *   post:
 *     tags: [Outlets]
 *     summary: Reset outlet password
 *     description: Generate a new password for an outlet user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Outlet not found
 */
router.post(
  "/outlets/:id/reset-password",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "parent"),
  OutletController.resetOutletPassword,
);

/**
 * @swagger
 * /api/outlets/me/addresses:
 *   get:
 *     tags: [Outlet Addresses]
 *     summary: Get own addresses
 *     description: Get addresses for authenticated outlet user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Outlet not found
 */
router.get(
  "/outlets/me/addresses",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  OutletController.getAddresses,
);

/**
 * @swagger
 * /api/outlets/me/addresses:
 *   post:
 *     tags: [Outlet Addresses]
 *     summary: Create address
 *     description: Create a new address for authenticated outlet user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Address created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/outlets/me/addresses",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  validate(createAddressSchema),
  OutletController.createAddress,
);

/**
 * @swagger
 * /api/outlets/{outletId}/addresses:
 *   get:
 *     tags: [Outlet Addresses]
 *     summary: Get addresses for outlet
 *     description: Get all addresses for a specific outlet (client/admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: outletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/outlets/:outletId/addresses",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "read", "all"),
  OutletController.getAddresses,
);

/**
 * @swagger
 * /api/outlets/{outletId}/addresses:
 *   post:
 *     tags: [Outlet Addresses]
 *     summary: Create address for outlet
 *     description: Create a new address for a specific outlet (client/admin or outlet itself)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: outletId
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
 *     responses:
 *       201:
 *         description: Address created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/outlets/:outletId/addresses",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "create", "all"),
  validate(createAddressSchema),
  OutletController.createAddress,
);

/**
 * @swagger
 * /api/outlets/me/addresses/{addressId}:
 *   put:
 *     tags: [Outlet Addresses]
 *     summary: Update own address
 *     description: Update an address for authenticated outlet user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
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
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found
 */
router.put(
  "/outlets/me/addresses/:addressId",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  validate(updateAddressSchema),
  OutletController.updateAddress,
);

/**
 * @swagger
 * /api/outlets/{outletId}/addresses/{addressId}:
 *   put:
 *     tags: [Outlet Addresses]
 *     summary: Update address
 *     description: Update an address for a specific outlet (client/admin or outlet itself)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: outletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: addressId
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
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Address not found
 */
router.put(
  "/outlets/:outletId/addresses/:addressId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "update", "all"),
  validate(updateAddressSchema),
  OutletController.updateAddress,
);

/**
 * @swagger
 * /api/outlets/me/addresses/{addressId}:
 *   delete:
 *     tags: [Outlet Addresses]
 *     summary: Delete own address
 *     description: Delete an address for authenticated outlet user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found
 */
router.delete(
  "/outlets/me/addresses/:addressId",
  authMiddleware.authenticate,
  authMiddleware.requireRole("outlet"),
  OutletController.deleteAddress,
);

/**
 * @swagger
 * /api/outlets/{outletId}/addresses/{addressId}:
 *   delete:
 *     tags: [Outlet Addresses]
 *     summary: Delete address
 *     description: Delete an address for a specific outlet (client/admin or outlet itself)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: outletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Address not found
 */
router.delete(
  "/outlets/:outletId/addresses/:addressId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("user", "delete", "all"),
  OutletController.deleteAddress,
);

module.exports = router;
