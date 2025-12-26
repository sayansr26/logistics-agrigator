// Outlets Routes - API routes for outlet management (Customers with customerType=OUTLET)
// Provides a filtered view of Customer model for outlet-specific operations

const express = require("express");
const router = express.Router();

// Controllers
const outletController = require("../controllers/outletController");

// Middleware
const authMiddleware = require("../middleware/auth");
const {
  validateOutletCreate,
  validateOutletUpdate,
} = require("../validation/customerSchemas");

/**
 * @swagger
 * tags:
 *   name: Outlets
 *   description: Outlet management (B2B customers)
 */

/**
 * @swagger
 * /api/v1/outlets:
 *   post:
 *     summary: Create a new outlet
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - outletCode
 *               - outletName
 *               - contactPerson
 *               - address
 *               - city
 *               - state
 *               - pincode
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               outletCode:
 *                 type: string
 *               outletName:
 *                 type: string
 *               retailerName:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               outletStatus:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               outletType:
 *                 type: string
 *                 enum: [franchise, direct, retail, warehouse]
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               country:
 *                 type: string
 *               gstNumber:
 *                 type: string
 *               panNumber:
 *                 type: string
 *               businessHours:
 *                 type: string
 *               bankDetails:
 *                 type: object
 *               assignedCouriers:
 *                 type: array
 *                 items:
 *                   type: string
 *               serviceAreas:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Outlet created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Outlet with email or code already exists
 */
router.post(
  "/",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:create:parent"),
  validateOutletCreate,
  outletController.createOutlet,
);

/**
 * @swagger
 * /api/v1/outlets:
 *   get:
 *     summary: List all outlets with pagination and filtering
 *     tags: [Outlets]
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
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: outletStatus
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: outletType
 *         schema:
 *           type: string
 *           enum: [franchise, direct, retail, warehouse]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of outlets
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:read:assigned"),
  outletController.listOutlets,
);

/**
 * @swagger
 * /api/v1/outlets/code/{outletCode}:
 *   get:
 *     summary: Get an outlet by code
 *     tags: [Outlets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: outletCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Outlet details
 *       404:
 *         description: Outlet not found
 */
router.get(
  "/code/:outletCode",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:read:assigned"),
  outletController.getOutletByCode,
);

/**
 * @swagger
 * /api/v1/outlets/{outletId}:
 *   get:
 *     summary: Get an outlet by ID
 *     tags: [Outlets]
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
 *         description: Outlet details
 *       404:
 *         description: Outlet not found
 */
router.get(
  "/:outletId",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:read:assigned"),
  outletController.getOutlet,
);

/**
 * @swagger
 * /api/v1/outlets/{outletId}:
 *   put:
 *     summary: Update an outlet
 *     tags: [Outlets]
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
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               outletCode:
 *                 type: string
 *               outletName:
 *                 type: string
 *               retailerName:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               outletStatus:
 *                 type: string
 *               outletType:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Outlet updated successfully
 *       404:
 *         description: Outlet not found
 */
router.put(
  "/:outletId",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:update:assigned"),
  validateOutletUpdate,
  outletController.updateOutlet,
);

/**
 * @swagger
 * /api/v1/outlets/{outletId}:
 *   delete:
 *     summary: Deactivate an outlet (soft delete)
 *     tags: [Outlets]
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
 *         description: Outlet deactivated successfully
 *       404:
 *         description: Outlet not found
 */
router.delete(
  "/:outletId",
  authMiddleware.authenticate,
  authMiddleware.authorize("customer:delete:assigned"),
  outletController.deleteOutlet,
);

module.exports = router;
