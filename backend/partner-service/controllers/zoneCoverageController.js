/**
 * Zone Coverage Controller
 *
 * Purpose: Handle zone coverage validation and serviceability operations
 * Following auth-service patterns with function-based exports
 *
 * AUTHENTICATED ENDPOINTS - Partner-scoped access required
 *
 * Endpoints:
 * 1. POST   /api/v1/zones/coverage/check         - Check pincode serviceability
 * 2. GET    /api/v1/zones/coverage/pincode/:code - Get zones by pincode
 * 3. GET    /api/v1/zones/coverage/overlaps      - Detect zone overlaps
 * 4. GET    /api/v1/zones/coverage/gaps          - Find coverage gaps
 * 5. GET    /api/v1/zones/:id/coverage/validate  - Validate zone coverage
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const zoneCoverageService = require("../services/zoneCoverageValidationService");

/**
 * 1. Check if pincode is serviceable by partner
 * @route POST /api/v1/zones/coverage/check
 * @access Authenticated (Partner scoped)
 * @body { pincode: "110001" }
 * @returns {
 *   serviceable: boolean,
 *   pincode: string,
 *   pincodeDetails: object,
 *   coverage: { totalZones, zones },
 *   availableServices: [string]
 * }
 */
async function checkServiceability(req, res) {
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

    const { pincode } = req.body;

    // Validate pincode format
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      logger.warn("Invalid pincode format", {
        partnerId,
        pincode,
        userId: req.user?.id,
      });
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Valid 6-digit pincode is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    logger.info("Checking pincode serviceability", {
      partnerId,
      pincode,
      userId: req.user?.id,
    });

    const result = await zoneCoverageService.validatePincodeServiceability(
      partnerId,
      pincode,
    );

    // Check if validation was successful
    if (!result.success) {
      logger.warn("Pincode serviceability check failed", {
        partnerId,
        pincode,
        message: result.message,
      });
      return res
        .status(404)
        .json(
          APIResponse.error(result.message || "Pincode not found", "NOT_FOUND"),
        );
    }

    logger.info("Pincode serviceability checked", {
      partnerId,
      pincode,
      serviceable: result.serviceable,
      zonesFound: result.coverage?.totalZones || 0,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        pincode: result.pincode,
        isServiceable: result.serviceable,
        pincodeDetails: result.pincodeDetails,
        zones: result.coverage?.zones || [],
        availableServices: result.availableServices || [],
        statistics: {
          totalZones: result.coverage?.totalZones || 0,
          totalServices: result.availableServices?.length || 0,
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to check serviceability", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      pincode: req.body?.pincode,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error("Failed to check serviceability", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 2. Get all zones covering a specific pincode
 * @route GET /api/v1/zones/coverage/pincode/:code
 * @access Authenticated (Partner scoped)
 * @param {string} code - 6-digit pincode
 * @returns {
 *   pincode: string,
 *   totalZones: number,
 *   zones: [{ id, name, description, services, totalPincodes }]
 * }
 */
async function getZonesByPincode(req, res) {
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

    const { code } = req.params;

    // Validate pincode format
    if (!code || !/^\d{6}$/.test(code)) {
      logger.warn("Invalid pincode format", {
        partnerId,
        pincode: code,
        userId: req.user?.id,
      });
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Valid 6-digit pincode is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    logger.info("Getting zones by pincode", {
      partnerId,
      pincode: code,
      userId: req.user?.id,
    });

    const result = await zoneCoverageService.getZonesByPincode(partnerId, code);

    // Check if result was successful
    if (!result.success) {
      logger.warn("Failed to get zones by pincode", {
        partnerId,
        pincode: code,
        message: result.message,
      });
      return res
        .status(404)
        .json(
          APIResponse.error(result.message || "Pincode not found", "NOT_FOUND"),
        );
    }

    logger.info("Zones by pincode retrieved", {
      partnerId,
      pincode: code,
      totalZones: result.totalZones,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        pincode: result.pincode,
        totalZones: result.totalZones,
        zones: result.zones,
      }),
    );
  } catch (error) {
    logger.error("Failed to get zones by pincode", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      pincode: req.params.code,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve zones by pincode",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 3. Detect overlapping zones (same pincodes in multiple zones)
 * @route GET /api/v1/zones/coverage/overlaps
 * @access Authenticated (Partner scoped)
 * @returns {
 *   totalOverlaps: number,
 *   overlaps: [{ pincode, areaName, zones: [{ zoneId, zoneName }] }],
 *   statistics: { totalZones, totalPincodes, overlapPercentage, maxOverlapCount }
 * }
 */
async function detectOverlaps(req, res) {
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

    logger.info("Detecting zone overlaps", {
      partnerId,
      userId: req.user?.id,
    });

    const result = await zoneCoverageService.detectZoneOverlaps(partnerId);

    if (!result.success) {
      logger.warn("Failed to detect overlaps", {
        partnerId,
        error: result.error,
      });
      return res
        .status(500)
        .json(
          APIResponse.error("Failed to detect zone overlaps", "SERVICE_ERROR"),
        );
    }

    logger.info("Zone overlaps detected", {
      partnerId,
      totalOverlaps: result.totalOverlaps,
      totalZones: result.statistics?.totalZones,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        totalOverlaps: result.totalOverlaps,
        overlaps: result.overlaps,
        statistics: result.statistics,
      }),
    );
  } catch (error) {
    logger.error("Failed to detect overlaps", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error("Failed to detect zone overlaps", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 4. Find coverage gaps (pincodes not covered by any zone)
 * @route GET /api/v1/zones/coverage/gaps?stateId=uuid&limit=100
 * @access Authenticated (Partner scoped)
 * @query {string} stateId - Optional state filter
 * @query {number} limit - Optional limit (default: 100)
 * @returns {
 *   totalUncovered: number,
 *   totalPincodes: number,
 *   coveragePercentage: string,
 *   gaps: [{ pincode, areaName, district, city, state, odaApplicable, hillApplicable }],
 *   metadata: { limitApplied, hasMore, stateFilter }
 * }
 */
async function findCoverageGaps(req, res) {
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

    const { stateId, limit } = req.query;

    // Validate stateId if provided (UUID format)
    if (
      stateId &&
      !stateId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return res
        .status(400)
        .json(APIResponse.error("Invalid state ID format", "VALIDATION_ERROR"));
    }

    // Validate limit if provided
    const limitValue = limit ? parseInt(limit) : 100;
    if (isNaN(limitValue) || limitValue < 1 || limitValue > 1000) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Limit must be between 1 and 1000",
            "VALIDATION_ERROR",
          ),
        );
    }

    logger.info("Finding coverage gaps", {
      partnerId,
      stateId,
      limit: limitValue,
      userId: req.user?.id,
    });

    const options = {
      stateId: stateId || null,
      limit: limitValue,
    };

    const result = await zoneCoverageService.getCoverageGaps(
      partnerId,
      options,
    );

    if (!result.success) {
      logger.warn("Failed to find coverage gaps", {
        partnerId,
        options,
        error: result.error,
      });
      return res
        .status(500)
        .json(
          APIResponse.error("Failed to find coverage gaps", "SERVICE_ERROR"),
        );
    }

    logger.info("Coverage gaps identified", {
      partnerId,
      totalUncovered: result.totalUncovered,
      coveragePercentage: result.coveragePercentage,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        totalUncovered: result.totalUncovered,
        totalPincodes: result.totalPincodes,
        coveragePercentage: result.coveragePercentage,
        gaps: result.gaps,
        metadata: result.metadata,
      }),
    );
  } catch (error) {
    logger.error("Failed to find coverage gaps", {
      error: error.message,
      stack: error.stack,
      partnerId: req.user?.partnerId,
      stateId: req.query.stateId,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error("Failed to find coverage gaps", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 5. Validate complete zone coverage (check for gaps, overlaps, configuration issues)
 * @route GET /api/v1/zones/:id/coverage/validate
 * @access Authenticated (Partner scoped)
 * @param {string} id - Zone UUID
 * @returns {
 *   zoneId: string,
 *   zoneName: string,
 *   isValid: boolean,
 *   coverage: { states, cities, areas, pincodes },
 *   services: [string],
 *   validationIssues: [{ type, severity, message, details }],
 *   summary: { totalIssues, errors, warnings }
 * }
 */
async function validateZone(req, res) {
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

    logger.info("Validating zone coverage", {
      partnerId,
      zoneId: id,
      userId: req.user?.id,
    });

    const result = await zoneCoverageService.validateZoneCoverage(
      id,
      partnerId,
    );

    // Check if zone was found
    if (!result.success) {
      logger.warn("Zone not found for validation", {
        partnerId,
        zoneId: id,
        message: result.message,
      });
      return res
        .status(404)
        .json(
          APIResponse.error(result.message || "Zone not found", "NOT_FOUND"),
        );
    }

    logger.info("Zone coverage validated", {
      partnerId,
      zoneId: id,
      zoneName: result.zoneName,
      isValid: result.isValid,
      totalIssues: result.summary?.totalIssues || 0,
      errors: result.summary?.errors || 0,
      warnings: result.summary?.warnings || 0,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        zoneId: result.zoneId,
        zoneName: result.zoneName,
        isValid: result.isValid,
        coverage: result.coverage,
        services: result.services,
        validationIssues: result.validationIssues,
        summary: result.summary,
      }),
    );
  } catch (error) {
    logger.error("Failed to validate zone coverage", {
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
        APIResponse.error("Failed to validate zone coverage", "INTERNAL_ERROR"),
      );
  }
}

/**
 * Export all controller functions
 * Following auth-service pattern with function-based exports
 */
module.exports = {
  checkServiceability,
  getZonesByPincode,
  detectOverlaps,
  findCoverageGaps,
  validateZone,
};
