/**
 * Charges Type Management Routes
 *
 * API routes for partner-specific charges type configuration.
 * Each partner can define their own charge types (e.g., COD, Freight, RTO).
 *
 * Authentication: Required (JWT)
 * Authorization: Admin + Operations roles only
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const chargesTypeController = require("../controllers/chargesTypeController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { pincodeTypeManagementLimiter } = require("../middleware/rateLimiter");
const {
  createChargesTypeSchema,
  listChargesTypesSchema,
  getChargesTypeByIdSchema,
  updateChargesTypeSchema,
  deleteChargesTypeSchema,
} = require("../validation/chargesTypeSchemas");

// Apply authentication to all charges type routes
router.use(authMiddleware.authenticate);

// Authorization: Admin + Operations roles only
router.use(authMiddleware.requireRole(["superadmin", "admin", "operations"]));

// Apply rate limiting
router.use(pincodeTypeManagementLimiter);

// ==========================================
// CHARGES TYPE CRUD ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/charges-types:
 *   post:
 *     tags: [ChargesTypes]
 *     summary: Create a new charges type for a partner
 *     description: Creates a new charges type with partner ID and name
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - name
 *             properties:
 *               partnerId:
 *                 type: string
 *                 example: ck1234567890abcdefghijklmnopqrst
 *                 description: Partner CUID
 *               name:
 *                 type: string
 *                 example: COD Charge
 *                 description: Name of the charge type
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the type is active
 *     responses:
 *       201:
 *         description: Charges type created successfully
 *       409:
 *         description: Charges type with same name already exists for this partner
 *       404:
 *         description: Partner not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient role
 */
router.post(
  "/",
  validate(createChargesTypeSchema),
  chargesTypeController.createChargesType,
);

/**
 * @swagger
 * /api/v1/charges-types:
 *   get:
 *     tags: [ChargesTypes]
 *     summary: List charges types with pagination
 *     description: Retrieves a paginated list of charges types with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by partner ID (CUID)
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
 *         name: search
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
 *           enum: [name, partnerId, isActive, createdAt, updatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of charges types
 */
router.get(
  "/",
  validate(listChargesTypesSchema),
  chargesTypeController.listChargesTypes,
);

/**
 * @swagger
 * /api/v1/charges-types/{id}:
 *   get:
 *     tags: [ChargesTypes]
 *     summary: Get charges type by ID
 *     description: Retrieves a specific charges type with partner details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Charges type UUID
 *     responses:
 *       200:
 *         description: Charges type details
 *       404:
 *         description: Charges type not found
 */
router.get(
  "/:id",
  validate(getChargesTypeByIdSchema),
  chargesTypeController.getChargesTypeById,
);

/**
 * @swagger
 * /api/v1/charges-types/{id}:
 *   put:
 *     tags: [ChargesTypes]
 *     summary: Update charges type
 *     description: Updates an existing charges type
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
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Charges type updated
 *       404:
 *         description: Charges type not found
 *       409:
 *         description: Name conflict for this partner
 */
router.put(
  "/:id",
  validate(updateChargesTypeSchema),
  chargesTypeController.updateChargesType,
);

/**
 * @swagger
 * /api/v1/charges-types/{id}:
 *   delete:
 *     tags: [ChargesTypes]
 *     summary: Soft delete charges type
 *     description: Soft deletes a charges type by setting isActive to false
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Charges type UUID
 *     responses:
 *       200:
 *         description: Charges type deleted (soft)
 *       404:
 *         description: Charges type not found
 */
router.delete(
  "/:id",
  validate(deleteChargesTypeSchema),
  chargesTypeController.deleteChargesType,
);

module.exports = router;
