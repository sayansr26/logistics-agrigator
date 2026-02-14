/**
 * Partner Pincode Assignment Routes
 *
 * API routes for partner pincode assignment management.
 * Following existing pincodeTypes patterns
 *
 * Authentication: Required (JWT)
 * Authorization: Admin roles only (superadmin, admin)
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const partnerPincodeController = require("../controllers/partnerPincodeController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { uploadSingle } = require("../middleware/upload");
const {
  assignPartnerPincodeSchema,
  listPartnerPincodesSchema,
  getPartnerPincodeByIdSchema,
  updatePartnerPincodeSchema,
  deletePartnerPincodeSchema,
  searchPincodesSchema,
  importPincodesSchema,
  exportPincodesSchema,
} = require("../validation/partnerPincodeSchema");

const PINCODE_SEARCH_DEPRECATION_SUNSET = "2026-06-30T00:00:00.000Z";

function setDeprecatedPincodeSearchHeaders(_req, res, next) {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", PINCODE_SEARCH_DEPRECATION_SUNSET);
  res.setHeader(
    "Link",
    '</api/v1/geography/pincodes/search>; rel="successor-version"',
  );
  next();
}

// Apply authentication to all partner pincode routes
router.use(authMiddleware.authenticate);

// Authorization: Admin roles only
router.use(authMiddleware.requireRole(["superadmin", "admin"]));

// ==========================================
// PARTNER PINCODE ASSIGNMENT ROUTES
// ==========================================

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes:
 *   post:
 *     tags: [PartnerPincodes]
 *     summary: Assign pincode to partner
 *     description: Assigns a pincode to a partner with configurable type values (COD, SLA_MIN, etc.)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID (CUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pincodeId
 *             properties:
 *               pincodeId:
 *                 type: string
 *                 format: uuid
 *                 description: Pincode ID (UUID)
 *               pincodeTypeValues:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pincodeTypeId:
 *                       type: string
 *                       format: uuid
 *                     value:
 *                       type: string
 *     responses:
 *       201:
 *         description: Pincode assigned successfully
 *       404:
 *         description: Partner or pincode not found
 *       409:
 *         description: Pincode already assigned to this partner
 */
router.post(
  "/:partnerId/pincodes",
  validate(assignPartnerPincodeSchema),
  partnerPincodeController.assignPartnerPincode,
);

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes:
 *   get:
 *     tags: [PartnerPincodes]
 *     summary: List assigned pincodes for partner
 *     description: Retrieves a paginated list of assigned pincodes for a partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Search by pincode code
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [pincodeCode, city, state, createdAt, updatedAt]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of assigned pincodes
 */
router.get(
  "/:partnerId/pincodes",
  validate(listPartnerPincodesSchema),
  partnerPincodeController.getPartnerPincodes,
);

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes/{id}:
 *   get:
 *     tags: [PartnerPincodes]
 *     summary: Get specific pincode assignment
 *     description: Retrieves details of a specific pincode assignment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pincode assignment details
 *       404:
 *         description: Assignment not found
 */
router.get(
  "/:partnerId/pincodes/:id",
  validate(getPartnerPincodeByIdSchema),
  partnerPincodeController.getPartnerPincodeById,
);

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes/{id}:
 *   put:
 *     tags: [PartnerPincodes]
 *     summary: Update pincode assignment
 *     description: Updates pincode type values or status for an assignment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
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
 *               pincodeTypeValues:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pincodeTypeId:
 *                       type: string
 *                       format: uuid
 *                     value:
 *                       type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Assignment updated successfully
 *       404:
 *         description: Assignment not found
 */
router.put(
  "/:partnerId/pincodes/:id",
  validate(updatePartnerPincodeSchema),
  partnerPincodeController.updatePartnerPincode,
);

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes/{id}:
 *   delete:
 *     tags: [PartnerPincodes]
 *     summary: Delete pincode assignment
 *     description: Soft deletes a pincode assignment by setting isActive to false
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment deleted successfully
 *       404:
 *         description: Assignment not found
 */
router.delete(
  "/:partnerId/pincodes/:id",
  validate(deletePartnerPincodeSchema),
  partnerPincodeController.deletePartnerPincode,
);

// ==========================================
// IMPORT/EXPORT ROUTES
// ==========================================

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes/import:
 *   post:
 *     tags: [PartnerPincodes]
 *     summary: Bulk import pincodes from Excel
 *     description: Imports multiple pincode assignments from an Excel file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx or .xls)
 *     responses:
 *       200:
 *         description: Import completed with results
 *       400:
 *         description: Invalid file format or data
 */
router.post(
  "/:partnerId/pincodes/import",
  validate(importPincodesSchema),
  uploadSingle("file"),
  partnerPincodeController.importPartnerPincodes,
);

/**
 * @swagger
 * /api/partners/{partnerId}/pincodes/export:
 *   get:
 *     tags: [PartnerPincodes]
 *     summary: Export assigned pincodes to Excel
 *     description: Exports all assigned pincodes for a partner to an Excel file
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
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/:partnerId/pincodes/export",
  validate(exportPincodesSchema),
  partnerPincodeController.exportPartnerPincodes,
);

/**
 * @swagger
 * /api/partners/pincodes/template:
 *   get:
 *     tags: [PartnerPincodes]
 *     summary: Download Excel import template
 *     description: Downloads a template Excel file for bulk import
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel template file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/pincodes/template", partnerPincodeController.downloadTemplate);

// ==========================================
// PINCODE SEARCH ROUTE
// ==========================================

/**
 * @swagger
 * /api/pincodes/search:
 *   get:
 *     tags: [Pincodes]
 *     summary: Search pincodes for autocomplete
 *     description: DEPRECATED. Use /api/v1/geography/pincodes/search
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Pincode code to search for
 *       - in: query
 *         name: code
 *         required: false
 *         schema:
 *           type: string
 *         description: Pincode code to search for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: List of matching pincodes
 */
router.get(
  "/pincodes/search",
  setDeprecatedPincodeSearchHeaders,
  validate(searchPincodesSchema),
  partnerPincodeController.searchPincodes,
);

module.exports = router;
