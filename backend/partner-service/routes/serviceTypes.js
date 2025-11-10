/**
 * Service Type Management Routes
 *
 * API routes for logistics service type management (COD, PREPAID, EXPRESS, etc.):
 * - Create, read, update, delete service types
 * - Query with filtering and pagination
 * - Get statistics
 *
 * Authentication: Required (JWT)
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const ServiceTypeController = require("../controllers/serviceTypeController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { zoneManagementLimiter } = require("../middleware/rateLimiter");
const {
  createServiceTypeSchema,
  updateServiceTypeSchema,
  queryServiceTypesSchema,
  serviceTypeIdParamSchema,
} = require("../validation/serviceTypeSchemas");

// Apply authentication and rate limiting to all service type routes
router.use(authMiddleware.authenticate);
router.use(zoneManagementLimiter);

/**
 * GET /api/v1/service-types
 * List all service types with filtering and pagination
 * Query params: page, limit, search, category, status, sortBy, sortOrder
 * Auth: Required
 */
router.get(
  "/",
  validate(queryServiceTypesSchema),
  ServiceTypeController.getAllServiceTypes,
);

/**
 * POST /api/v1/service-types
 * Create a new service type
 * Body: { name, displayName, category, description?, isAvailable?, baseCharge?, sortOrder?, additionalInfo? }
 * Auth: Required
 */
router.post(
  "/",
  validate(createServiceTypeSchema),
  ServiceTypeController.createServiceType,
);

/**
 * GET /api/v1/service-types/stats
 * Get service type usage statistics
 * Auth: Required
 */
router.get("/stats", ServiceTypeController.getServiceTypeStats);

/**
 * GET /api/v1/service-types/:id
 * Get service type by ID
 * Path params: id (service type ID)
 * Auth: Required
 */
router.get(
  "/:id",
  validate(serviceTypeIdParamSchema),
  ServiceTypeController.getServiceTypeById,
);

/**
 * PUT /api/v1/service-types/:id
 * Update an existing service type
 * Path params: id (service type ID)
 * Body: { displayName?, category?, description?, isAvailable?, baseCharge?, sortOrder?, additionalInfo? }
 * Auth: Required
 */
router.put(
  "/:id",
  validate(updateServiceTypeSchema),
  ServiceTypeController.updateServiceType,
);

/**
 * DELETE /api/v1/service-types/:id
 * Soft delete a service type (marks as unavailable)
 * Path params: id (service type ID)
 * Auth: Required
 */
router.delete(
  "/:id",
  validate(serviceTypeIdParamSchema, "params"),
  ServiceTypeController.deleteServiceType,
);

module.exports = router;
