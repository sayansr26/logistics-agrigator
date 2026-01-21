/**
 * Pincode Type Service Charge Management Routes
 *
 * API routes for managing service charges for pincode type x partner combinations:
 * - Create charges (supports bulk: multiple types x multiple partners)
 * - List, update, and delete charges
 * - Query charges by pincode type or partner
 *
 * Authentication: Required (JWT)
 * Authorization: Admin + Operations roles only
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const pincodeTypeServiceChargeController = require("../controllers/pincodeTypeServiceChargeController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { pincodeTypeManagementLimiter } = require("../middleware/rateLimiter");
const {
  createChargeSchema,
  listChargesSchema,
  getChargeByIdSchema,
  updateChargeSchema,
  deleteChargeSchema,
  getChargesByPincodeTypeSchema,
  getChargesByPartnerSchema,
} = require("../validation/pincodeTypeServiceChargeSchemas");

// Apply authentication to all charge routes
router.use(authMiddleware.authenticate);

// Authorization: Admin + Operations roles only
router.use(authMiddleware.requireRole(["superadmin", "admin", "operations"]));

// Apply rate limiting
router.use(pincodeTypeManagementLimiter);

// ==========================================
// SERVICE CHARGE CRUD ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/pincode-type-service-charges:
 *   post:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Create service charge(s)
 *     description: Creates service charges for pincode type x partner combinations. Supports bulk creation.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pincodeTypeIds, partnerIds, baseCharge]
 *             properties:
 *               pincodeTypeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of pincode type UUIDs
 *                 example: ["type-uuid-1", "type-uuid-2"]
 *               partnerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of partner CUIDs
 *                 example: ["partner-cuid-1", "partner-cuid-2"]
 *               baseCharge:
 *                 type: number
 *                 format: decimal
 *                 description: Base charge amount
 *                 example: 50.00
 *               isActive:
 *                 type: boolean
 *                 description: Active status
 *                 default: true
 *     responses:
 *       201:
 *         description: Service charges created successfully
 *       409:
 *         description: All combinations already exist
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient role
 */
router.post(
  "/",
  validate(createChargeSchema),
  pincodeTypeServiceChargeController.createCharge,
);

/**
 * @swagger
 * /api/v1/pincode-type-service-charges:
 *   get:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: List service charges with pagination
 *     description: Retrieves a paginated list of service charges with optional filtering
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
 *           maximum: 100
 *       - in: query
 *         name: pincodeTypeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [baseCharge, createdAt, updatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of service charges
 */
router.get(
  "/",
  validate(listChargesSchema),
  pincodeTypeServiceChargeController.listCharges,
);

/**
 * @swagger
 * /api/v1/pincode-type-service-charges/{id}:
 *   get:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Get service charge by ID
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
 *         description: Service charge details
 *       404:
 *         description: Service charge not found
 */
router.get(
  "/:id",
  validate(getChargeByIdSchema),
  pincodeTypeServiceChargeController.getChargeById,
);

/**
 * @swagger
 * /api/v1/pincode-type-service-charges/{id}:
 *   put:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Update service charge
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
 *             properties:
 *               baseCharge:
 *                 type: number
 *                 format: decimal
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Service charge updated
 *       404:
 *         description: Service charge not found
 */
router.put(
  "/:id",
  validate(updateChargeSchema),
  pincodeTypeServiceChargeController.updateCharge,
);

/**
 * @swagger
 * /api/v1/pincode-type-service-charges/{id}:
 *   delete:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Soft delete service charge
 *     description: Soft deletes a service charge by setting isActive to false
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
 *         description: Service charge deleted (soft)
 *       404:
 *         description: Service charge not found
 */
router.delete(
  "/:id",
  validate(deleteChargeSchema),
  pincodeTypeServiceChargeController.deleteCharge,
);

// ==========================================
// QUERY ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/pincode-type-service-charges/type/{pincodeTypeId}:
 *   get:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Get charges by pincode type
 *     description: Retrieves all service charges for a specific pincode type
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pincodeTypeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of charges for the pincode type
 *       404:
 *         description: Pincode type not found
 */
router.get(
  "/type/:pincodeTypeId",
  validate(getChargesByPincodeTypeSchema),
  pincodeTypeServiceChargeController.getChargesByPincodeType,
);

/**
 * @swagger
 * /api/v1/pincode-type-service-charges/partner/{partnerId}:
 *   get:
 *     tags: [PincodeTypeServiceCharges]
 *     summary: Get charges by partner
 *     description: Retrieves all service charges for a specific partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of charges for the partner
 *       404:
 *         description: Partner not found
 */
router.get(
  "/partner/:partnerId",
  validate(getChargesByPartnerSchema),
  pincodeTypeServiceChargeController.getChargesByPartner,
);

module.exports = router;
