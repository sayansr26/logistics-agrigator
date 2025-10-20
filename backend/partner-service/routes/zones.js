/**
 * Zone Management Routes
 *
 * Handles HTTP routing for zone management and service type configuration
 * Includes comprehensive Swagger documentation for all endpoints
 *
 * Routes:
 * - GET /api/zones - Get all zones with filtering
 * - POST /api/zones - Create new zone
 * - GET /api/service-types - Get all service types
 * - POST /api/service-types - Create new service type
 * - GET /api/partner-zones/:partnerId - Get partner-specific zones
 * - GET /api/partners/comprehensive-data/:partnerId - Get comprehensive partner data
 * - POST /api/zones/coverage/validate - Validate zone coverage
 */

const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zoneController");
const { authMiddleware } = require("../shared/lib/auth");
const { zoneManagementLimiter } = require("../middleware/rateLimiter");

/**
 * @swagger
 * components:
 *   schemas:
 *     Zone:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - partnerId
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique zone identifier
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           description: Zone name
 *           example: "Mumbai Central Zone"
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 500
 *           description: Zone description
 *           example: "Central Mumbai business district"
 *         partnerId:
 *           type: string
 *           description: Partner identifier
 *           example: "partner_001"
 *         status:
 *           type: boolean
 *           description: Zone active status
 *           default: true
 *         geographical:
 *           type: object
 *           properties:
 *             states:
 *               type: array
 *               items:
 *                 type: integer
 *               description: State IDs covered by zone
 *             cities:
 *               type: array
 *               items:
 *                 type: integer
 *               description: City IDs covered by zone
 *             areas:
 *               type: array
 *               items:
 *                 type: integer
 *               description: Area IDs covered by zone
 *             pincodes:
 *               type: array
 *               items:
 *                 type: integer
 *               description: Pincodes covered by zone
 *         services:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               serviceTypeId:
 *                 type: integer
 *                 description: Service type ID
 *               isAvailable:
 *                 type: boolean
 *                 description: Service availability in zone
 *               baseCharge:
 *                 type: number
 *                 description: Base charge for service
 *               customCharges:
 *                 type: object
 *                 description: Custom charges for service
 *               additionalInfo:
 *                 type: object
 *                 description: Additional service information
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Zone creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Zone last update timestamp
 *
 *     ServiceType:
 *       type: object
 *       required:
 *         - name
 *         - displayName
 *         - category
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique service type identifier
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: Service type name (uppercase)
 *           example: "PICKUP"
 *         displayName:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           description: Human-readable service name
 *           example: "Pickup Service"
 *         category:
 *           type: string
 *           enum: [LOGISTICS, PAYMENT, LOCATION, SPECIAL]
 *           description: Service category
 *           example: "LOGISTICS"
 *         description:
 *           type: string
 *           description: Service description
 *         isAvailable:
 *           type: boolean
 *           description: Service availability
 *           default: true
 *         baseCharge:
 *           type: string
 *           description: Base charge for service
 *           default: "0"
 *         sortOrder:
 *           type: integer
 *           description: Display sort order
 *           default: 100
 *         additionalInfo:
 *           type: object
 *           description: Additional service information
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Service type creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Service type last update timestamp
 *
 *     ZoneCoverageValidation:
 *       type: object
 *       required:
 *         - pincodes
 *       properties:
 *         pincodes:
 *           type: array
 *           items:
 *             type: string
 *             pattern: '^\\d{6}$'
 *           maxItems: 1000
 *           description: Array of 6-digit pincodes to validate
 *           example: ["400001", "400002", "110001"]
 *         partnerId:
 *           type: string
 *           description: Optional partner ID for partner-specific validation
 *           example: "partner_001"
 *
 *     ZoneCoverageResult:
 *       type: object
 *       properties:
 *         totalPincodes:
 *           type: integer
 *           description: Total number of pincodes checked
 *         coveredPincodes:
 *           type: array
 *           items:
 *             type: string
 *           description: Pincodes covered by zones
 *         uncoveredPincodes:
 *           type: array
 *           items:
 *             type: string
 *           description: Pincodes not covered by any zone
 *         coveragePercentage:
 *           type: number
 *           description: Coverage percentage (0-100)
 *         coverageByZone:
 *           type: object
 *           description: Coverage breakdown by zone
 *
 *     ComprehensivePartnerData:
 *       type: object
 *       properties:
 *         zones:
 *           type: object
 *           description: Partner zones data
 *         packages:
 *           type: object
 *           description: Package charges data
 *         services:
 *           type: object
 *           description: Service types data
 *         charges:
 *           type: object
 *           description: Customer charges data
 *         discounts:
 *           type: object
 *           description: Discounts data
 *
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/zones:
 *   get:
 *     summary: Get all zones with filtering and pagination
 *     description: Retrieve zones with optional filtering by status, search term, and pagination
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of zones per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by zone status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for zone name or description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, status]
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Zones retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Zones retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Zone'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalZones:
 *                           type: integer
 *                         totalPartners:
 *                           type: integer
 *                         activeZones:
 *                           type: integer
 *                         inactiveZones:
 *                           type: integer
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/zones",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.getAllZones,
);

/**
 * @swagger
 * /api/zones:
 *   post:
 *     summary: Create a new zone
 *     description: Create a new zone with geographical coverage and service configuration
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - partnerId
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "Mumbai Central Zone"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 example: "Central Mumbai business district covering key commercial areas"
 *               partnerId:
 *                 type: string
 *                 example: "partner_001"
 *               status:
 *                 type: boolean
 *                 default: true
 *               geographical:
 *                 type: object
 *                 properties:
 *                   states:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [1]
 *                   cities:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [1, 2]
 *                   areas:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [101, 102]
 *                   pincodes:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [400001, 400002, 400003]
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     serviceTypeId:
 *                       type: integer
 *                       example: 1
 *                     isAvailable:
 *                       type: boolean
 *                       example: true
 *                     baseCharge:
 *                       type: number
 *                       example: 60.0
 *                     customCharges:
 *                       type: object
 *                       example:
 *                         expressDelivery: 25.0
 *                         codCharge: 15.0
 *                     additionalInfo:
 *                       type: object
 *                       example:
 *                         cutoffTime: "18:00"
 *                         deliveryWindow: "24-48 hours"
 *     responses:
 *       201:
 *         description: Zone created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Zone created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Zone'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/zones",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  zoneManagementLimiter,
  zoneController.createZone,
);

/**
 * @swagger
 * /api/service-types:
 *   get:
 *     summary: Get all service types with filtering and pagination
 *     description: Retrieve service types with optional filtering by status, category, and pagination
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of service types per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ALL]
 *           default: ACTIVE
 *         description: Filter by service type status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [LOGISTICS, PAYMENT, LOCATION, SPECIAL]
 *         description: Filter by service category
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: sortOrder
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Service types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service types retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServiceType'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                     filters:
 *                       type: object
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/service-types",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.getServiceTypes,
);

/**
 * @swagger
 * /api/service-types:
 *   post:
 *     summary: Create a new service type
 *     description: Create a new service type for zone configuration
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "EXPRESS_DELIVERY"
 *               displayName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "Express Delivery Service"
 *               category:
 *                 type: string
 *                 enum: [LOGISTICS, PAYMENT, LOCATION, SPECIAL]
 *                 example: "LOGISTICS"
 *               description:
 *                 type: string
 *                 example: "Fast delivery service with guaranteed time slots"
 *               isAvailable:
 *                 type: boolean
 *                 default: true
 *               baseCharge:
 *                 type: string
 *                 default: "0"
 *                 example: "25.00"
 *               sortOrder:
 *                 type: integer
 *                 default: 100
 *                 example: 10
 *               additionalInfo:
 *                 type: object
 *                 example:
 *                   deliveryTime: "Same day"
 *                   cutoffTime: "14:00"
 *     responses:
 *       201:
 *         description: Service type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service type created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ServiceType'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/service-types",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  zoneManagementLimiter,
  zoneController.createServiceType,
);

/**
 * @swagger
 * /api/service-types/{id}:
 *   get:
 *     summary: Get service type by ID
 *     description: Retrieve a specific service type by its ID
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service type UUID
 *     responses:
 *       200:
 *         description: Service type retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service type retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ServiceType'
 *       404:
 *         description: Service type not found
 *       401:
 *         description: Unauthorized access
 *   put:
 *     summary: Update a service type
 *     description: Update an existing service type
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service type UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "Express Delivery Service"
 *               category:
 *                 type: string
 *                 enum: [LOGISTICS, PAYMENT, LOCATION, SPECIAL]
 *                 example: "LOGISTICS"
 *               description:
 *                 type: string
 *                 example: "Fast delivery service with guaranteed time slots"
 *               isAvailable:
 *                 type: boolean
 *                 example: true
 *               baseCharge:
 *                 type: string
 *                 example: "25.00"
 *               sortOrder:
 *                 type: integer
 *                 example: 10
 *               additionalInfo:
 *                 type: object
 *                 example:
 *                   deliveryTime: "Same day"
 *                   cutoffTime: "14:00"
 *     responses:
 *       200:
 *         description: Service type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service type updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ServiceType'
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Service type not found
 *       401:
 *         description: Unauthorized access
 *   delete:
 *     summary: Delete a service type
 *     description: Soft delete a service type (mark as unavailable)
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service type UUID
 *     responses:
 *       200:
 *         description: Service type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service type deleted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ServiceType'
 *       404:
 *         description: Service type not found
 *       401:
 *         description: Unauthorized access
 */
router.get(
  "/service-types/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.getServiceTypeById,
);

router.put(
  "/service-types/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  zoneManagementLimiter,
  zoneController.updateServiceType,
);

router.delete(
  "/service-types/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  zoneManagementLimiter,
  zoneController.deleteServiceType,
);

/**
 * @swagger
 * /api/partner-zones/{partnerId}:
 *   get:
 *     summary: Get partner-specific zones
 *     description: Retrieve zones associated with a specific partner
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_001"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of zones per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by zone status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for zone name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Partner zones retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Partner zones retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     zones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Zone'
 *                     pagination:
 *                       type: object
 *                     filters:
 *                       type: object
 *                     metadata:
 *                       type: object
 *       400:
 *         description: Invalid partner ID or parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-zones/:partnerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.getPartnerZones,
);

/**
 * @swagger
 * /api/partners/comprehensive-data/{partnerId}:
 *   get:
 *     summary: Get comprehensive partner data
 *     description: Retrieve complete partner data including zones, packages, services, charges, and discounts
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_001"
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive records in response
 *       - in: query
 *         name: modules
 *         schema:
 *           type: string
 *         description: Comma-separated list of modules to include (zones,packages,services,charges,discounts)
 *         example: "zones,services"
 *     responses:
 *       200:
 *         description: Comprehensive partner data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comprehensive partner data retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ComprehensivePartnerData'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                     metadata:
 *                       type: object
 *                     executionTime:
 *                       type: integer
 *       400:
 *         description: Invalid partner ID or parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partners/comprehensive-data/:partnerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.getComprehensivePartnerData,
);

/**
 * @swagger
 * /api/zones/coverage/validate:
 *   post:
 *     summary: Validate zone coverage for pincodes
 *     description: Check which pincodes are covered by existing zones and calculate coverage percentage
 *     tags: [Zone Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ZoneCoverageValidation'
 *           example:
 *             pincodes: ["400001", "400002", "110001", "560001"]
 *             partnerId: "partner_001"
 *     responses:
 *       200:
 *         description: Zone coverage validation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Zone coverage validation completed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ZoneCoverageResult'
 *       400:
 *         description: Invalid request data or pincode format
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/zones/coverage/validate",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  zoneManagementLimiter,
  zoneController.validateZoneCoverage,
);

module.exports = router;
