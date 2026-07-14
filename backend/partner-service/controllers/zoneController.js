/**
 * Zone Controller
 *
 * Purpose: Handle partner zone management operations
 * Following auth-service patterns with function-based exports
 *
 * Supports both GEOLOGICAL (geographical-based) and DISTANCE (milestone-based) zones.
 *
 * AUTHENTICATED ENDPOINTS - Partner-scoped access (or admin/ops for DISTANCE zones)
 *
 * Endpoints:
 * 1.  POST   /api/v1/zones                  - Create new zone (unified for both types)
 * 2.  GET    /api/v1/zones                  - List zones with pagination
 * 3.  GET    /api/v1/zones/:id              - Get basic zone details
 * 4.  GET    /api/v1/zones/:id/complete     - Get complete zone with associations
 * 5.  PUT    /api/v1/zones/:id              - Update zone basic details
 * 6.  DELETE /api/v1/zones/:id              - Soft delete zone
 * 7.  GET    /api/v1/zones/:id/geography    - Get zone geographical associations
 * 8.  PUT    /api/v1/zones/:id/geography    - Update zone geography
 * 9.  GET    /api/v1/zones/:id/milestones   - Get zone milestones (DISTANCE only)
 * 10. PUT    /api/v1/zones/:id/milestones   - Update zone milestones (DISTANCE only)
 * 11. POST   /api/v1/zones/calculate-distance - Calculate distance between pincodes
 * 12. POST   /api/v1/zones/match            - Match zone by distance
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const zoneService = require("../services/zoneService");
const distanceZoneService = require("../services/distanceZoneService");

// Allowed roles for DISTANCE zone management
const DISTANCE_ZONE_ROLES = ["superadmin", "admin", "operations"];

/**
 * 1. Create new zone (unified endpoint for both GEOLOGICAL and DISTANCE)
 * @route POST /api/v1/zones
 * @access Authenticated
 *   - GEOLOGICAL: Partner-scoped (uses req.user.partnerId)
 *   - DISTANCE: Admin/Operations only (requires partnerIds in body)
 * @body {
 *   name: string (required),
 *   description: string,
 *   status: boolean,
 *   zoneType: "GEOLOGICAL" | "DISTANCE" (default: GEOLOGICAL),
 *   // For GEOLOGICAL zones:
 *   geographical: { states: [uuid], cities: [uuid], areas: [uuid], pincodes: [string] },
 *   // For DISTANCE zones:
 *   partnerIds: [string] (required for DISTANCE),
 *   milestones: [{ minKm: number, maxKm: number }] (required for DISTANCE)
 * }
 */
async function createZone(req, res) {
  try {
    const zoneData = req.body;
    const zoneType = zoneData.zoneType || "GEOLOGICAL";

    logger.info("Creating zone", {
      zoneType,
      zoneName: zoneData.name,
      userId: req.user?.id,
    });

    // Validate required fields
    if (
      !zoneData.name ||
      typeof zoneData.name !== "string" ||
      !zoneData.name.trim()
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Zone name is required", "VALIDATION_ERROR"));
    }

    // Handle DISTANCE zone creation
    if (zoneType === "DISTANCE") {
      // Check authorization for DISTANCE zones
      const userRole = req.user?.role;
      if (!DISTANCE_ZONE_ROLES.includes(userRole)) {
        logger.warn("Unauthorized DISTANCE zone creation attempt", {
          userId: req.user?.id,
          userRole,
          ip: req.ip,
        });
        return res
          .status(403)
          .json(
            APIResponse.error(
              "Forbidden: DISTANCE zones require admin/operations role",
              "FORBIDDEN",
            ),
          );
      }

      // Create distance zone(s) for multiple partners
      const result = await distanceZoneService.createDistanceZone(zoneData, {
        user: req.user,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      logger.info("Distance zone(s) created successfully", {
        zonesCreated: result.summary.zonesCreated,
        partnersAffected: result.summary.partnersAffected,
        userId: req.user?.id,
      });

      return res
        .status(201)
        .json(
          APIResponse.success(result, "Distance zone(s) created successfully"),
        );
    }

    // Handle GEOLOGICAL zone creation (default).
    // Determine the target partner. Only privileged roles may create a zone
    // for an arbitrary partner; regular partner users are locked to their own
    // token partner. A regular user attempting to specify a different partner
    // is rejected (prevents cross-tenant IDOR).
    const userRole = req.user?.role;
    const canAssignAnyPartner = DISTANCE_ZONE_ROLES.includes(userRole);

    let partnerId;
    if (canAssignAnyPartner) {
      partnerId = zoneData.partnerId || req.user?.partnerId;
    } else {
      if (zoneData.partnerId && zoneData.partnerId !== req.user?.partnerId) {
        logger.warn("Cross-partner GEOLOGICAL zone creation blocked", {
          userId: req.user?.id,
          userRole,
          requestedPartnerId: zoneData.partnerId,
          userPartnerId: req.user?.partnerId,
          ip: req.ip,
        });
        return res
          .status(403)
          .json(
            APIResponse.error(
              "Forbidden: not authorized to create zones for another partner",
              "FORBIDDEN",
            ),
          );
      }
      partnerId = req.user?.partnerId;
    }

    if (!partnerId) {
      logger.warn("Partner ID missing from request for GEOLOGICAL zone", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required for GEOLOGICAL zones",
            "UNAUTHORIZED",
          ),
        );
    }

    // Create geological zone with service (handles transactions and audit logging)
    const zone = await zoneService.createZone(partnerId, zoneData);

    logger.info("Zone created successfully", {
      partnerId,
      zoneId: zone.id,
      zoneName: zone.name,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(APIResponse.success(zone, "Zone created successfully"));
  } catch (error) {
    logger.error("Failed to create zone", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneName: req.body?.name,
      zoneType: req.body?.zoneType,
      userId: req.user?.id,
    });

    // Handle specific error types
    if (error.message.includes("already exists")) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

    if (
      error.message.includes("not found") ||
      error.message.includes("does not exist")
    ) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("required") ||
      error.message.includes("must be") ||
      error.message.includes("gap detected") ||
      error.message.includes("overlapping")
    ) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to create zone", "INTERNAL_ERROR"));
  }
}

/**
 * 2. List zones with pagination and filters
 * @route GET /api/v1/zones?page=1&limit=20&status=true&search=name&zoneType=GEOLOGICAL
 * @access Authenticated (Admin/superadmin see all zones, partners see own zones)
 */
async function listZones(req, res) {
  try {
    const userRole = req.user?.role;
    const isAdminOrSuperadmin = ["admin", "superadmin", "operations"].includes(
      userRole,
    );

    // For admin/superadmin, allow filtering by partnerId from query params
    // For non-admin users, use partnerId from authenticated user context
    const partnerId = isAdminOrSuperadmin
      ? req.query.partnerId || req.user?.partnerId
      : req.user?.partnerId;

    // Non-admin users must have a partnerId
    if (!isAdminOrSuperadmin && !partnerId) {
      logger.warn("Partner ID missing from request for non-admin user", {
        userId: req.user?.id,
        role: userRole,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      status:
        req.query.status !== undefined
          ? req.query.status === "true"
          : undefined,
      zoneType: req.query.zoneType, // Optional filter: DISTANCE or GEOLOGICAL
      search: req.query.search,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Listing zones", {
      partnerId: partnerId || "ALL (admin)",
      filters,
      userId: req.user?.id,
      role: userRole,
    });

    // Use distanceZoneService for DISTANCE type filter, otherwise zoneService
    // For admin/superadmin without partnerId, pass null to get all zones
    let result;
    if (filters.zoneType === "DISTANCE") {
      result = await distanceZoneService.listDistanceZones(partnerId, filters);
    } else {
      result = await zoneService.listZones(partnerId, filters);
    }

    logger.info("Zones listed successfully", {
      partnerId: partnerId || "ALL (admin)",
      count: result.zones.length,
      total: result.pagination.total,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to list zones", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      filters: req.query,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve zones", "INTERNAL_ERROR"));
  }
}

/**
 * 3. Get basic zone details
 * @route GET /api/v1/zones/:id
 * @access Authenticated (Partner scoped)
 */
async function getZone(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;
    const userRole = req.user?.role;

    // Allow admin/superadmin/operations to view any zone without partnerId
    if (
      !partnerId &&
      !["superadmin", "admin", "operations"].includes(userRole)
    ) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        userRole,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Getting zone basic details", {
      partnerId,
      userRole,
      zoneId: id,
      userId: req.user?.id,
    });

    const zone = await zoneService.getZone(id, partnerId);

    logger.info("Zone retrieved successfully", {
      partnerId,
      zoneId: id,
      zoneName: zone.name,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(zone));
  } catch (error) {
    logger.error("Failed to get zone", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve zone", "INTERNAL_ERROR"));
  }
}

/**
 * 4. Get complete zone with all associations
 * @route GET /api/v1/zones/:id/complete
 * @access Authenticated (Partner scoped)
 */
async function getZoneComplete(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;
    const userRole = req.user?.role;

    // Allow admin/superadmin/operations to view any zone without partnerId
    if (
      !partnerId &&
      !["superadmin", "admin", "operations"].includes(userRole)
    ) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        userRole,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Getting complete zone details", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const zone = await zoneService.getZoneComplete(id, partnerId);

    logger.info("Complete zone retrieved successfully", {
      partnerId,
      zoneId: id,
      zoneName: zone.name,
      summary: zone.summary,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(zone));
  } catch (error) {
    logger.error("Failed to get complete zone", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to retrieve complete zone", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 5. Update zone basic details (name, description, status)
 * @route PUT /api/v1/zones/:id
 * @access Authenticated (Partner scoped)
 * @body {
 *   name: string,
 *   description: string,
 *   status: boolean
 * }
 */
async function updateZone(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;

    if (!partnerId) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;
    const zoneData = req.body;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    // Validate update data exists
    if (!zoneData || Object.keys(zoneData).length === 0) {
      return res
        .status(400)
        .json(APIResponse.error("Update data is required", "VALIDATION_ERROR"));
    }

    logger.info("Updating zone", {
      partnerId,
      zoneId: id,
      changes: Object.keys(zoneData),
      userId: req.user?.id,
    });

    const zone = await zoneService.updateZone(id, partnerId, zoneData);

    logger.info("Zone updated successfully", {
      partnerId,
      zoneId: id,
      zoneName: zone.name,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(zone, "Zone updated successfully"));
  } catch (error) {
    logger.error("Failed to update zone", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    if (error.message.includes("already exists")) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

    if (error.message.includes("required")) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to update zone", "INTERNAL_ERROR"));
  }
}

/**
 * 6. Soft delete zone (set status to false)
 * @route DELETE /api/v1/zones/:id
 * @access Authenticated (Partner scoped)
 */
async function deleteZone(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;

    if (!partnerId) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Deleting zone", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const zone = await zoneService.deleteZone(id, partnerId);

    logger.info("Zone deleted successfully", {
      partnerId,
      zoneId: id,
      zoneName: zone.name,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(zone, "Zone deleted successfully"));
  } catch (error) {
    logger.error("Failed to delete zone", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to delete zone", "INTERNAL_ERROR"));
  }
}

// NOTE: Zone services endpoints (getZoneServices, updateZoneServices) have been
// removed in Zone System v2. Use Pincode Types for service-based configuration.

/**
 * 7. Get zone geographical associations (GEOLOGICAL zones only)
 * @route GET /api/v1/zones/:id/geography
 * @access Authenticated (Partner scoped)
 */
async function getZoneGeography(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;
    const userRole = req.user?.role;

    // Allow admin/superadmin/operations to view any zone's geography without
    // a partnerId; partner-scoped users must have one.
    if (
      !partnerId &&
      !["superadmin", "admin", "operations"].includes(userRole)
    ) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        userRole,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Getting zone geography", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const result = await zoneService.getZoneGeography(id, partnerId);

    logger.info("Zone geography retrieved successfully", {
      partnerId,
      zoneId: id,
      summary: result.summary,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get zone geography", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve zone geography",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 8. Update zone geographical associations (GEOLOGICAL zones only)
 * @route PUT /api/v1/zones/:id/geography
 * @access Authenticated (Partner scoped)
 * @body {
 *   states: [uuid],
 *   cities: [uuid],
 *   areas: [uuid],
 *   pincodes: [string] // 6-digit pincode codes
 * }
 */
async function updateZoneGeography(req, res) {
  try {
    // Extract partnerId from authenticated user
    const partnerId = req.user?.partnerId;

    if (!partnerId) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;
    const geographical = req.body;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    // Validate geographical data exists
    if (!geographical || typeof geographical !== "object") {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Geographical data is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    // Validate at least one geographical entity provided
    const hasData =
      (geographical.states && geographical.states.length > 0) ||
      (geographical.cities && geographical.cities.length > 0) ||
      (geographical.areas && geographical.areas.length > 0) ||
      (geographical.pincodes && geographical.pincodes.length > 0);

    if (!hasData) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "At least one geographical entity (states, cities, areas, or pincodes) is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    logger.info("Updating zone geography", {
      partnerId,
      zoneId: id,
      statesCount: geographical.states?.length || 0,
      citiesCount: geographical.cities?.length || 0,
      areasCount: geographical.areas?.length || 0,
      pincodesCount: geographical.pincodes?.length || 0,
      userId: req.user?.id,
    });

    const result = await zoneService.updateZoneGeography(
      id,
      partnerId,
      geographical,
    );

    logger.info("Zone geography updated successfully", {
      partnerId,
      zoneId: id,
      summary: result.summary,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Zone geography updated successfully"),
    );
  } catch (error) {
    logger.error("Failed to update zone geography", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Zone not found", "NOT_FOUND"));
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("inactive")
    ) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    if (error.message.includes("overlap detected")) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to update zone geography", "INTERNAL_ERROR"),
      );
  }
}

// ==========================================
// DISTANCE ZONE ENDPOINTS (9-12)
// ==========================================

/**
 * 9. Get zone milestones (DISTANCE zones only)
 * @route GET /api/v1/zones/:id/milestones
 * @access Authenticated (Partner scoped)
 */
async function getMilestones(req, res) {
  try {
    const partnerId = req.user?.partnerId;
    const { id } = req.params;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Getting zone milestones", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const result = await distanceZoneService.getMilestones(id, partnerId);

    logger.info("Zone milestones retrieved successfully", {
      partnerId,
      zoneId: id,
      count: result.milestones.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get zone milestones", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Distance zone not found", "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve zone milestones",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 10. Update zone milestones (DISTANCE zones only)
 * @route PUT /api/v1/zones/:id/milestones
 * @access Authenticated (Partner scoped)
 * @body { milestones: [{ minKm: number, maxKm: number }] }
 */
async function updateMilestones(req, res) {
  try {
    const partnerId = req.user?.partnerId;

    if (!partnerId) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Unauthorized: Partner ID required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { id } = req.params;
    const { milestones } = req.body;

    // Validate UUID format
    if (
      !id ||
      !id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid zone ID format", "VALIDATION_ERROR"));
    }

    logger.info("Updating zone milestones", {
      partnerId,
      zoneId: id,
      milestonesCount: milestones?.length,
      userId: req.user?.id,
    });

    const result = await distanceZoneService.replaceMilestones(
      id,
      partnerId,
      milestones,
      {
        user: req.user,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
    );

    logger.info("Zone milestones updated successfully", {
      partnerId,
      zoneId: id,
      count: result.milestones.length,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Zone milestones updated successfully"),
    );
  } catch (error) {
    logger.error("Failed to update zone milestones", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      zoneId: req.params.id,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("access denied")
    ) {
      return res
        .status(404)
        .json(APIResponse.error("Distance zone not found", "NOT_FOUND"));
    }

    if (
      error.message.includes("required") ||
      error.message.includes("must be") ||
      error.message.includes("gap detected") ||
      error.message.includes("overlapping")
    ) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to update zone milestones", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 11. Calculate distance between pincodes
 * @route POST /api/v1/zones/calculate-distance
 * @access Authenticated
 * @body { fromPincode: string, toPincode: string }
 */
async function calculateDistance(req, res) {
  try {
    const { fromPincode, toPincode } = req.body;

    logger.info("Calculating distance", {
      fromPincode,
      toPincode,
      userId: req.user?.id,
    });

    const result = await distanceZoneService.calculateShipmentDistance(
      fromPincode,
      toPincode,
    );

    logger.info("Distance calculated successfully", {
      fromPincode,
      toPincode,
      distanceKm: result.distanceKm,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to calculate distance", {
      error: error.message,
      stack: error.stack,
      fromPincode: req.body?.fromPincode,
      toPincode: req.body?.toPincode,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("not available")
    ) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    if (error.message.includes("Invalid")) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to calculate distance", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 12. Match zone by distance
 * @route POST /api/v1/zones/match
 * @access Authenticated
 * @body { fromPincode: string, toPincode: string, partnerId?: string }
 */
async function matchZone(req, res) {
  try {
    const { fromPincode, toPincode, partnerId: bodyPartnerId } = req.body;

    // Use partnerId from body if provided (admin/ops), otherwise from user
    const partnerId = bodyPartnerId || req.user?.partnerId;

    if (!partnerId) {
      logger.warn("Partner ID missing from request", {
        userId: req.user?.id,
        ip: req.ip,
      });
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Partner ID required (either from auth or request body)",
            "UNAUTHORIZED",
          ),
        );
    }

    logger.info("Matching zone", {
      partnerId,
      fromPincode,
      toPincode,
      userId: req.user?.id,
    });

    const result = await distanceZoneService.getZoneForShipment(
      partnerId,
      fromPincode,
      toPincode,
      {
        user: req.user,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
    );

    logger.info("Zone matching completed", {
      partnerId,
      fromPincode,
      toPincode,
      matched: result.matched,
      zoneSuffix: result.zoneSuffix,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to match zone", {
      error: error.message,
      stack: error.stack,
      fromPincode: req.body?.fromPincode,
      toPincode: req.body?.toPincode,
      partnerId: req.body?.partnerId || req.user?.partnerId,
      userId: req.user?.id,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("not available")
    ) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    if (error.message.includes("Invalid")) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to match zone", "INTERNAL_ERROR"));
  }
}

/**
 * Export all controller functions
 * Following auth-service pattern with function-based exports
 */
module.exports = {
  // Zone CRUD (unified for both types)
  createZone,
  listZones,
  getZone,
  getZoneComplete,
  updateZone,
  deleteZone,
  // Geography (GEOLOGICAL zones)
  getZoneGeography,
  updateZoneGeography,
  // Distance zone endpoints
  getMilestones,
  updateMilestones,
  calculateDistance,
  matchZone,
};
