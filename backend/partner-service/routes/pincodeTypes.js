/**
 * Pincode Type Management Routes
 *
 * API routes for global/admin-managed pincode type configuration:
 * - CRUD operations for pincode types
 * - Bulk pincode assignment/unassignment
 * - Query pincodes by type and types by pincode
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
  assignPincodesSchema,
  unassignPincodesSchema,
  getAssignedPincodesSchema,
  getTypesByPincodeSchema,
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
 *     description: Creates a new pincode type with name, charge, and optional description
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePincodeTypeRequest'
 *     responses:
 *       201:
 *         description: Pincode type created successfully
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
 *     description: Retrieves a paginated list of pincode types with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, charge, createdAt, updatedAt]
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
 *                     pincodeTypes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PincodeType'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
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
 *         description: Pincode type UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               charge:
 *                 type: number
 *               description:
 *                 type: string
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

// ==========================================
// PINCODE ASSIGNMENT ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/pincode-types/{id}/assign:
 *   post:
 *     tags: [PincodeTypes]
 *     summary: Bulk assign pincodes to type
 *     description: Assigns multiple pincodes to a pincode type in a single operation
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkAssignPincodesRequest'
 *     responses:
 *       200:
 *         description: Pincodes assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/BulkAssignmentResult'
 *       404:
 *         description: Pincode type not found
 *       400:
 *         description: Invalid pincodes or type is inactive
 */
router.post(
  "/:id/assign",
  validate(assignPincodesSchema),
  pincodeTypeController.assignPincodes,
);

/**
 * @swagger
 * /api/v1/pincode-types/{id}/unassign:
 *   delete:
 *     tags: [PincodeTypes]
 *     summary: Bulk unassign pincodes from type
 *     description: Removes multiple pincodes from a pincode type in a single operation
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkAssignPincodesRequest'
 *     responses:
 *       200:
 *         description: Pincodes unassigned successfully
 *       404:
 *         description: Pincode type not found
 */
router.delete(
  "/:id/unassign",
  validate(unassignPincodesSchema),
  pincodeTypeController.unassignPincodes,
);

/**
 * @swagger
 * /api/v1/pincode-types/{id}/pincodes:
 *   get:
 *     tags: [PincodeTypes]
 *     summary: Get pincodes assigned to type
 *     description: Retrieves all pincodes assigned to a specific pincode type with pagination
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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by pincode code
 *     responses:
 *       200:
 *         description: List of assigned pincodes
 *       404:
 *         description: Pincode type not found
 */
router.get(
  "/:id/pincodes",
  validate(getAssignedPincodesSchema),
  pincodeTypeController.getAssignedPincodes,
);

module.exports = router;
