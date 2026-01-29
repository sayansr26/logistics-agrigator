/**
 * Pincode Type Management Routes
 *
 * API routes for global/admin-managed pincode type configuration.
 * Simplified: CRUD operations only (no assignments or service charges).
 *
 * Authentication: Required (JWT)
 * Authorization: Admin + Operations roles only
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const pincodeTypeController = require("../controllers/pincodeTypeController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { pincodeTypeManagementLimiter } = require("../middleware/rateLimiter");
const {
  createPincodeTypeSchema,
  listPincodeTypesSchema,
  getPincodeTypeByIdSchema,
  updatePincodeTypeSchema,
  deletePincodeTypeSchema,
} = require("../validation/pincodeTypeSchemas");

// Apply authentication to all pincode type routes
router.use(authMiddleware.authenticate);

// Authorization: Admin + Operations roles only
router.use(authMiddleware.requireRole(["superadmin", "admin", "operations"]));

// Apply rate limiting
router.use(pincodeTypeManagementLimiter);

// ==========================================
// PINCODE TYPE CRUD ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/pincode-types:
 *   post:
 *     tags: [PincodeTypes]
 *     summary: Create a new pincode type
 *     description: Creates a new pincode type with name and type (yes_no or number)
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: COD
 *                 description: Unique name for the pincode type
 *               type:
 *                 type: string
 *                 enum: [yes_no, number]
 *                 example: yes_no
 *                 description: Type of pincode type (yes_no for boolean, number for numeric)
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the type is active
 *     responses:
 *       201:
 *         description: Pincode type created successfully
 *       409:
 *         description: Pincode type with same name already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient role
 */
router.post(
  "/",
  validate(createPincodeTypeSchema),
  pincodeTypeController.createPincodeType,
);

/**
 * @swagger
 * /api/v1/pincode-types:
 *   get:
 *     tags: [PincodeTypes]
 *     summary: List pincode types with pagination
 *     description: Retrieves a paginated list of pincode types
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
 *           enum: [name, type, createdAt, updatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of pincode types
 */
router.get(
  "/",
  validate(listPincodeTypesSchema),
  pincodeTypeController.listPincodeTypes,
);

/**
 * @swagger
 * /api/v1/pincode-types/{id}:
 *   get:
 *     tags: [PincodeTypes]
 *     summary: Get pincode type by ID
 *     description: Retrieves a specific pincode type with its statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Pincode type UUID
 *     responses:
 *       200:
 *         description: Pincode type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PincodeType'
 *       404:
 *         description: Pincode type not found
 */
router.get(
  "/:id",
  validate(getPincodeTypeByIdSchema),
  pincodeTypeController.getPincodeTypeById,
);

/**
 * @swagger
 * /api/v1/pincode-types/{id}:
 *   put:
 *     tags: [PincodeTypes]
 *     summary: Update pincode type
 *     description: Updates an existing pincode type
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
 *               type:
 *                 type: string
 *                 enum: [yes_no, number]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pincode type updated
 *       404:
 *         description: Pincode type not found
 *       409:
 *         description: Name conflict
 */
router.put(
  "/:id",
  validate(updatePincodeTypeSchema),
  pincodeTypeController.updatePincodeType,
);

/**
 * @swagger
 * /api/v1/pincode-types/{id}:
 *   delete:
 *     tags: [PincodeTypes]
 *     summary: Soft delete pincode type
 *     description: Soft deletes a pincode type by setting isActive to false
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Pincode type UUID
 *     responses:
 *       200:
 *         description: Pincode type deleted (soft)
 *       404:
 *         description: Pincode type not found
 */
router.delete(
  "/:id",
  validate(deletePincodeTypeSchema),
  pincodeTypeController.deletePincodeType,
);

module.exports = router;
