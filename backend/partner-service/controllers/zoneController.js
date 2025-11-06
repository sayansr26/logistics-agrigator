/**
 * Zone Controller
 *
 * Purpose: Handle partner zone management operations
 * Following auth-service patterns with function-based exports
 *
 * AUTHENTICATED ENDPOINTS - Partner-scoped access required
 *
 * Endpoints:
 * 1.  POST   /api/v1/zones                  - Create new zone
 * 2.  GET    /api/v1/zones                  - List zones with pagination
 * 3.  GET    /api/v1/zones/:id              - Get basic zone details
 * 4.  GET    /api/v1/zones/:id/complete     - Get complete zone with associations
 * 5.  PUT    /api/v1/zones/:id              - Update zone basic details
 * 6.  DELETE /api/v1/zones/:id              - Soft delete zone
 * 7.  GET    /api/v1/zones/:id/services     - Get zone service configuration
 * 8.  PUT    /api/v1/zones/:id/services     - Update zone services
 * 9.  GET    /api/v1/zones/:id/geography    - Get zone geographical associations
 * 10. PUT    /api/v1/zones/:id/geography    - Update zone geography
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const zoneService = require("../services/zoneService");

/**
 * 1. Create new zone with geographical associations and service configuration
 * @route POST /api/v1/zones
 * @access Authenticated (Partner scoped)
 * @body {
 *   name: string (required),
 *   description: string,
 *   status: boolean,
 *   geographical: {
 *     states: [uuid],
 *     cities: [uuid],
 *     areas: [uuid],
 *     pincodes: [string]
 *   },
 *   services: {
 *     PICKUP: boolean,
 *     PICKUP_charges: number,
 *     DELIVERY: boolean,
 *     DELIVERY_charges: number,
 *     COD: boolean,
 *     COD_charges: number,
 *     PREPAID: boolean,
 *     PREPAID_charges: number,
 *     ODA: boolean,
 *     ODA_charges: number,
 *     HILL: boolean,
 *     HILL_charges: number
 *   }
 * }
 */
async function createZone(req, res) {
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

    const zoneData = req.body;

    logger.info("Creating zone", {
      partnerId,
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

    // Create zone with service (handles transactions and audit logging)
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
      error.message.includes("required")
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
 * @route GET /api/v1/zones?page=1&limit=20&status=true&search=name
 * @access Authenticated (Partner scoped)
 */
async function listZones(req, res) {
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

    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      status:
        req.query.status !== undefined
          ? req.query.status === "true"
          : undefined,
      search: req.query.search,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Listing zones", {
      partnerId,
      filters,
      userId: req.user?.id,
    });

    const result = await zoneService.listZones(partnerId, filters);

    logger.info("Zones listed successfully", {
      partnerId,
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

    logger.info("Getting zone basic details", {
      partnerId,
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

/**
 * 7. Get zone service configuration
 * @route GET /api/v1/zones/:id/services
 * @access Authenticated (Partner scoped)
 */
async function getZoneServices(req, res) {
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

    logger.info("Getting zone services", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const result = await zoneService.getZoneServices(id, partnerId);

    logger.info("Zone services retrieved successfully", {
      partnerId,
      zoneId: id,
      summary: result.summary,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get zone services", {
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
        APIResponse.error("Failed to retrieve zone services", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 8. Update zone service configuration
 * @route PUT /api/v1/zones/:id/services
 * @access Authenticated (Partner scoped)
 * @body {
 *   PICKUP: boolean,
 *   PICKUP_charges: number,
 *   PICKUP_remarks: string,
 *   DELIVERY: boolean,
 *   DELIVERY_charges: number,
 *   DELIVERY_remarks: string,
 *   COD: boolean,
 *   COD_charges: number,
 *   COD_remarks: string,
 *   PREPAID: boolean,
 *   PREPAID_charges: number,
 *   PREPAID_remarks: string,
 *   ODA: boolean,
 *   ODA_charges: number,
 *   ODA_remarks: string,
 *   HILL: boolean,
 *   HILL_charges: number,
 *   HILL_remarks: string
 * }
 */
async function updateZoneServices(req, res) {
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
    const services = req.body;

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

    // Validate services data exists
    if (
      !services ||
      typeof services !== "object" ||
      Object.keys(services).length === 0
    ) {
      return res
        .status(400)
        .json(
          APIResponse.error("Services data is required", "VALIDATION_ERROR"),
        );
    }

    logger.info("Updating zone services", {
      partnerId,
      zoneId: id,
      serviceCount: Object.keys(services).length,
      userId: req.user?.id,
    });

    const result = await zoneService.updateZoneServices(
      id,
      partnerId,
      services,
    );

    logger.info("Zone services updated successfully", {
      partnerId,
      zoneId: id,
      servicesCount: result.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result, "Zone services updated successfully"));
  } catch (error) {
    logger.error("Failed to update zone services", {
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

    if (error.message.includes("required")) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to update zone services", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 9. Get zone geographical associations
 * @route GET /api/v1/zones/:id/geography
 * @access Authenticated (Partner scoped)
 */
async function getZoneGeography(req, res) {
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
 * 10. Update zone geographical associations
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

/**
 * Export all controller functions
 * Following auth-service pattern with function-based exports
 */
module.exports = {
  createZone,
  listZones,
  getZone,
  getZoneComplete,
  updateZone,
  deleteZone,
  getZoneServices,
  updateZoneServices,
  getZoneGeography,
  updateZoneGeography,
};
