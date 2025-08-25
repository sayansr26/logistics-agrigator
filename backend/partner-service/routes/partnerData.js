const express = require("express");
const router = express.Router();
const partnerDataController = require("../controllers/partnerDataController");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const Joi = require("joi");

// Validation schemas
const partnerIdSchema = Joi.object({
  partnerId: Joi.string().uuid().required().messages({
    "string.guid": "Partner ID must be a valid UUID",
    "any.required": "Partner ID is required",
  }),
});

const packageFiltersSchema = Joi.object({
  weightMin: Joi.number().min(0).optional(),
  weightMax: Joi.number().min(0).optional(),
  packageType: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});

const chargeFiltersSchema = Joi.object({
  chargeType: Joi.string().optional(),
  zoneId: Joi.string().uuid().optional(),
  isActive: Joi.boolean().optional(),
});

const discountFiltersSchema = Joi.object({
  activeOnly: Joi.boolean().optional(),
  discountType: Joi.string().valid("percentage", "flat", "tiered").optional(),
  includeExpired: Joi.boolean().optional(),
});

const serviceFiltersSchema = Joi.object({
  zoneId: Joi.string().uuid().optional(),
  serviceType: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});

const comprehensiveOptionsSchema = Joi.object({
  includePackages: Joi.boolean().optional().default(true),
  includeCharges: Joi.boolean().optional().default(true),
  includeDiscounts: Joi.boolean().optional().default(true),
  includeServices: Joi.boolean().optional().default(true),
  includeMetrics: Joi.boolean().optional().default(true),
  packageFilters: Joi.string().optional(), // JSON string
  chargeFilters: Joi.string().optional(), // JSON string
  discountFilters: Joi.string().optional(), // JSON string
  serviceFilters: Joi.string().optional(), // JSON string
});

const exportOptionsSchema = Joi.object({
  format: Joi.string().valid("json", "csv").optional().default("json"),
  dataTypes: Joi.string().optional().default("all"), // comma-separated or 'all'
});

const cacheOptionsSchema = Joi.object({
  dataType: Joi.string()
    .valid("packages", "charges", "discounts", "services", "comprehensive")
    .optional(),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     PartnerPackagesResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         source:
 *           type: string
 *           enum: [aggregated]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         local:
 *           type: object
 *           properties:
 *             source:
 *               type: string
 *             packages:
 *               type: array
 *               items:
 *                 type: object
 *         external:
 *           type: object
 *           properties:
 *             source:
 *               type: string
 *             packages:
 *               type: array
 *               items:
 *                 type: object
 *         metadata:
 *           type: object
 *           properties:
 *             localCount:
 *               type: integer
 *             externalCount:
 *               type: integer
 *             filters:
 *               type: object
 *
 *     PartnerChargesResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         source:
 *           type: string
 *           enum: [aggregated]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         packageCharges:
 *           type: object
 *         customerCharges:
 *           type: object
 *         externalCharges:
 *           type: object
 *         metadata:
 *           type: object
 *           properties:
 *             packageChargeCount:
 *               type: integer
 *             customerChargeCount:
 *               type: integer
 *             externalChargeCount:
 *               type: integer
 *
 *     PartnerDiscountsResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         source:
 *           type: string
 *           enum: [database]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         discounts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Discount'
 *         activeDiscounts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Discount'
 *         metadata:
 *           type: object
 *           properties:
 *             totalCount:
 *               type: integer
 *             activeCount:
 *               type: integer
 *             expiredCount:
 *               type: integer
 *             discountTypes:
 *               type: array
 *               items:
 *                 type: string
 *
 *     PartnerServicesResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         partnerName:
 *           type: string
 *         partnerCode:
 *           type: string
 *         source:
 *           type: string
 *           enum: [database]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         serviceTypes:
 *           type: array
 *           items:
 *             type: string
 *         zones:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               zoneId:
 *                 type: string
 *                 format: uuid
 *               zoneName:
 *                 type: string
 *               zoneCode:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               serviceTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *         capabilities:
 *           type: object
 *           properties:
 *             cod:
 *               type: boolean
 *             prepaid:
 *               type: boolean
 *             express:
 *               type: boolean
 *             standard:
 *               type: boolean
 *             fragile:
 *               type: boolean
 *             oversized:
 *               type: boolean
 *         metadata:
 *           type: object
 *           properties:
 *             totalZones:
 *               type: integer
 *             activeZones:
 *               type: integer
 *             totalServiceTypes:
 *               type: integer
 *             isActive:
 *               type: boolean
 *
 *     ComprehensivePartnerDataResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         source:
 *           type: string
 *           enum: [comprehensive_aggregation]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             packages:
 *               $ref: '#/components/schemas/PartnerPackagesResponse'
 *             charges:
 *               $ref: '#/components/schemas/PartnerChargesResponse'
 *             discounts:
 *               $ref: '#/components/schemas/PartnerDiscountsResponse'
 *             services:
 *               $ref: '#/components/schemas/PartnerServicesResponse'
 *             metrics:
 *               $ref: '#/components/schemas/PartnerMetricsResponse'
 *         metadata:
 *           type: object
 *           properties:
 *             requestedInclusions:
 *               type: object
 *             dataAvailability:
 *               type: object
 *             aggregationTime:
 *               type: integer
 *
 *     PartnerMetricsResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         partnerName:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         coverage:
 *           type: object
 *           properties:
 *             totalZones:
 *               type: integer
 *             activeZones:
 *               type: integer
 *             coveragePercentage:
 *               type: number
 *               format: float
 *         services:
 *           type: object
 *           properties:
 *             serviceTypeCount:
 *               type: integer
 *             isActive:
 *               type: boolean
 *         discounts:
 *           type: object
 *           properties:
 *             totalDiscounts:
 *               type: integer
 *             averageDiscountValue:
 *               type: number
 *               format: float
 *         performance:
 *           type: object
 *           properties:
 *             onTimeDeliveryRate:
 *               type: number
 *               format: float
 *             customerSatisfactionScore:
 *               type: number
 *               format: float
 *             averageDeliveryTime:
 *               type: number
 *               format: float
 *             costEfficiencyScore:
 *               type: number
 *               format: float
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *
 *     PartnerDataHealthResponse:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           format: uuid
 *         timestamp:
 *           type: string
 *           format: date-time
 *         dataHealth:
 *           type: object
 *           properties:
 *             packages:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                 cacheHit:
 *                   type: boolean
 *             charges:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                 cacheHit:
 *                   type: boolean
 *             discounts:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                 cacheHit:
 *                   type: boolean
 *             services:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                 cacheHit:
 *                   type: boolean
 *         overallHealth:
 *           type: string
 *           enum: [healthy, partial, unhealthy, unknown]
 */

/**
 * @swagger
 * /api/partner-packages/{partnerId}:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner packages
 *     description: Retrieve comprehensive package data for a specific partner from both local and external sources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: weightMin
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum weight filter
 *       - in: query
 *         name: weightMax
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum weight filter
 *       - in: query
 *         name: packageType
 *         schema:
 *           type: string
 *         description: Package type filter
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Partner packages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner packages retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 source: aggregated
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 local:
 *                   source: local_database
 *                   packages: []
 *                 external:
 *                   source: external_api
 *                   packages: []
 *                 metadata:
 *                   localCount: 0
 *                   externalCount: 5
 *                   filters: {}
 *       404:
 *         description: Partner not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/partner-packages/:partnerId",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(packageFiltersSchema, "query"),
  partnerDataController.getPartnerPackages,
);

/**
 * @swagger
 * /api/partner-charges/{partnerId}:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner charges
 *     description: Retrieve comprehensive charge data for a specific partner including package charges, customer charges, and external charges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: chargeType
 *         schema:
 *           type: string
 *         description: Charge type filter
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Zone ID filter
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Partner charges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner charges retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 source: aggregated
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 packageCharges:
 *                   charges: []
 *                 customerCharges:
 *                   charges: []
 *                 externalCharges:
 *                   charges: []
 *                 metadata:
 *                   packageChargeCount: 10
 *                   customerChargeCount: 5
 *                   externalChargeCount: 8
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-charges/:partnerId",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(chargeFiltersSchema, "query"),
  partnerDataController.getPartnerCharges,
);

/**
 * @swagger
 * /api/partner-discounts/{partnerId}:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner discounts
 *     description: Retrieve discount data for a specific partner with time-based filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *         description: Return only active discounts
 *       - in: query
 *         name: discountType
 *         schema:
 *           type: string
 *           enum: [percentage, flat, tiered]
 *         description: Filter by discount type
 *       - in: query
 *         name: includeExpired
 *         schema:
 *           type: boolean
 *         description: Include expired discounts
 *     responses:
 *       200:
 *         description: Partner discounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner discounts retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 source: database
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 discounts: []
 *                 activeDiscounts: []
 *                 metadata:
 *                   totalCount: 5
 *                   activeCount: 3
 *                   expiredCount: 2
 *                   discountTypes: ["percentage", "flat"]
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-discounts/:partnerId",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(discountFiltersSchema, "query"),
  partnerDataController.getPartnerDiscounts,
);

/**
 * @swagger
 * /api/partner-services/{partnerId}:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner services and capabilities
 *     description: Retrieve service capabilities, zones, and service types for a specific partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by zone ID
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *         description: Filter by service type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Partner services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner services retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 partnerName: "Partner Name"
 *                 partnerCode: "PART001"
 *                 source: database
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 serviceTypes: ["COD", "PREPAID", "EXPRESS"]
 *                 zones: []
 *                 capabilities:
 *                   cod: true
 *                   prepaid: true
 *                   express: true
 *                   standard: true
 *                   fragile: false
 *                   oversized: false
 *                 metadata:
 *                   totalZones: 5
 *                   activeZones: 4
 *                   totalServiceTypes: 3
 *                   isActive: true
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-services/:partnerId",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(serviceFiltersSchema, "query"),
  partnerDataController.getPartnerServices,
);

/**
 * @swagger
 * /api/partners/comprehensive-data/{partnerId}:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get comprehensive partner data
 *     description: Retrieve all partner data types in a single aggregated response with configurable inclusions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: includePackages
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include packages data
 *       - in: query
 *         name: includeCharges
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include charges data
 *       - in: query
 *         name: includeDiscounts
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include discounts data
 *       - in: query
 *         name: includeServices
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include services data
 *       - in: query
 *         name: includeMetrics
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include metrics data
 *       - in: query
 *         name: packageFilters
 *         schema:
 *           type: string
 *         description: JSON string of package filters
 *       - in: query
 *         name: chargeFilters
 *         schema:
 *           type: string
 *         description: JSON string of charge filters
 *       - in: query
 *         name: discountFilters
 *         schema:
 *           type: string
 *         description: JSON string of discount filters
 *       - in: query
 *         name: serviceFilters
 *         schema:
 *           type: string
 *         description: JSON string of service filters
 *     responses:
 *       200:
 *         description: Comprehensive partner data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Comprehensive partner data retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 source: comprehensive_aggregation
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 data:
 *                   packages: {}
 *                   charges: {}
 *                   discounts: {}
 *                   services: {}
 *                   metrics: {}
 *                 metadata:
 *                   requestedInclusions: {}
 *                   dataAvailability: {}
 *                   aggregationTime: 150
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partners/comprehensive-data/:partnerId",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(comprehensiveOptionsSchema, "query"),
  partnerDataController.getComprehensivePartnerData,
);

/**
 * @swagger
 * /api/partners/{partnerId}/metrics:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner performance metrics
 *     description: Retrieve performance metrics and analytics for a specific partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner metrics retrieved successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 partnerName: "Partner Name"
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 coverage:
 *                   totalZones: 10
 *                   activeZones: 8
 *                   coveragePercentage: 80.0
 *                 services:
 *                   serviceTypeCount: 5
 *                   isActive: true
 *                 discounts:
 *                   totalDiscounts: 3
 *                   averageDiscountValue: 15.5
 *                 performance:
 *                   onTimeDeliveryRate: 95.5
 *                   customerSatisfactionScore: 4.2
 *                   averageDeliveryTime: 2.5
 *                   costEfficiencyScore: 87.3
 *                 lastUpdated: "2024-01-01T00:00:00.000Z"
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partners/:partnerId/metrics",
  authenticate,
  validate(partnerIdSchema, "params"),
  partnerDataController.getPartnerMetrics,
);

/**
 * @swagger
 * /api/partners/{partnerId}/export:
 *   get:
 *     tags: [Partner Data]
 *     summary: Export partner data
 *     description: Export comprehensive partner data in various formats (JSON, CSV)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: dataTypes
 *         schema:
 *           type: string
 *           default: all
 *         description: Comma-separated data types to include or 'all'
 *     responses:
 *       200:
 *         description: Partner data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Exported partner data with export metadata
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted partner data
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partners/:partnerId/export",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(exportOptionsSchema, "query"),
  partnerDataController.exportPartnerData,
);

/**
 * @swagger
 * /api/partners/{partnerId}/cache:
 *   delete:
 *     tags: [Partner Data]
 *     summary: Clear partner data cache
 *     description: Clear cached data for a specific partner, optionally for specific data types
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *       - in: query
 *         name: dataType
 *         schema:
 *           type: string
 *           enum: [packages, charges, discounts, services, comprehensive]
 *         description: Specific data type to clear (optional, clears all if not specified)
 *     responses:
 *       200:
 *         description: Partner cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Partner cache cleared successfully
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 clearedDataType: "all"
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/partners/:partnerId/cache",
  authenticate,
  validate(partnerIdSchema, "params"),
  validate(cacheOptionsSchema, "query"),
  partnerDataController.clearPartnerCache,
);

/**
 * @swagger
 * /api/partners/{partnerId}/health:
 *   get:
 *     tags: [Partner Data]
 *     summary: Get partner data health check
 *     description: Check the health and availability of partner data services
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner data is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: "Partner data health: healthy"
 *               data:
 *                 partnerId: "123e4567-e89b-12d3-a456-426614174000"
 *                 timestamp: "2024-01-01T00:00:00.000Z"
 *                 dataHealth:
 *                   packages:
 *                     available: true
 *                     lastUpdated: "2024-01-01T00:00:00.000Z"
 *                     cacheHit: true
 *                   charges:
 *                     available: true
 *                     lastUpdated: "2024-01-01T00:00:00.000Z"
 *                     cacheHit: false
 *                   discounts:
 *                     available: true
 *                     lastUpdated: "2024-01-01T00:00:00.000Z"
 *                     cacheHit: true
 *                   services:
 *                     available: true
 *                     lastUpdated: "2024-01-01T00:00:00.000Z"
 *                     cacheHit: false
 *                 overallHealth: healthy
 *       503:
 *         description: Partner data is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partners/:partnerId/health",
  authenticate,
  validate(partnerIdSchema, "params"),
  partnerDataController.getPartnerDataHealth,
);

module.exports = router;
