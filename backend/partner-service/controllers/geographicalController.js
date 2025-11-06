/**
 * Geographical Controller
 *
 * Purpose: Handle geographical hierarchy operations (states, cities, areas, pincodes)
 * Following auth-service patterns with function-based exports
 *
 * PUBLIC ENDPOINTS - No authentication required (geographical data is public)
 *
 * Endpoints:
 * 1. GET  /api/v1/geography/states - Get all states
 * 2. GET  /api/v1/geography/cities?stateId=uuid - Get cities by state
 * 3. GET  /api/v1/geography/areas?cityId=uuid - Get areas by city
 * 4. GET  /api/v1/geography/pincodes?areaId=uuid - Get pincodes by area/city/state
 * 5. GET  /api/v1/geography/pincodes/search - Search pincodes
 * 6. GET  /api/v1/geography/pincodes/:code - Get pincode details
 * 7. POST /api/v1/geography/cities/by-states - Batch get cities
 * 8. POST /api/v1/geography/areas/by-cities - Batch get areas
 * 9. POST /api/v1/geography/pincodes/by-areas - Batch get pincodes
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { getGeographicalService } = require("../services/geographicalService");

/**
 * 1. Get all active Indian states
 * @route GET /api/v1/geography/states
 * @access Public
 */
async function getStates(req, res) {
  try {
    logger.info("Getting all active states", {
      userId: req.user?.id,
      ip: req.ip,
    });

    const geographicalService = getGeographicalService();
    const states = await geographicalService.getStates();

    logger.info("States retrieved successfully", {
      count: states.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(states));
  } catch (error) {
    logger.error("Failed to get states", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve states", "INTERNAL_ERROR"));
  }
}

/**
 * 2. Get cities by state ID
 * @route GET /api/v1/geography/cities?stateId=uuid
 * @access Public
 */
async function getCitiesByState(req, res) {
  try {
    const { stateId } = req.query;

    logger.info("Getting cities by state", {
      stateId,
      userId: req.user?.id,
    });

    // Validation
    if (!stateId) {
      return res
        .status(400)
        .json(APIResponse.error("State ID is required", "VALIDATION_ERROR"));
    }

    const geographicalService = getGeographicalService();
    const cities = await geographicalService.getCitiesByState(stateId);

    logger.info("Cities retrieved successfully", {
      stateId,
      count: cities.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(cities));
  } catch (error) {
    logger.error("Failed to get cities", {
      error: error.message,
      stateId: req.query.stateId,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve cities", "INTERNAL_ERROR"));
  }
}

/**
 * 3. Get areas by city ID
 * @route GET /api/v1/geography/areas?cityId=uuid
 * @access Public
 */
async function getAreasByCity(req, res) {
  try {
    const { cityId } = req.query;

    logger.info("Getting areas by city", {
      cityId,
      userId: req.user?.id,
    });

    // Validation
    if (!cityId) {
      return res
        .status(400)
        .json(APIResponse.error("City ID is required", "VALIDATION_ERROR"));
    }

    const geographicalService = getGeographicalService();
    const areas = await geographicalService.getAreasByCity(cityId);

    logger.info("Areas retrieved successfully", {
      cityId,
      count: areas.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(areas));
  } catch (error) {
    logger.error("Failed to get areas", {
      error: error.message,
      cityId: req.query.cityId,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve areas", "INTERNAL_ERROR"));
  }
}

/**
 * 4. Get pincodes by area/city/state
 * @route GET /api/v1/geography/pincodes?areaId=uuid&cityId=uuid&stateId=uuid
 * @access Public
 */
async function getPincodesByArea(req, res) {
  try {
    const { areaId, cityId, stateId, limit, page } = req.query;

    logger.info("Getting pincodes by area/city/state", {
      areaId,
      cityId,
      stateId,
      limit,
      page,
      userId: req.user?.id,
    });

    const geographicalService = getGeographicalService();
    const params = {
      areaId,
      cityId,
      stateId,
      limit: limit ? parseInt(limit) : 100,
      page: page ? parseInt(page) : 1,
    };

    const result = await geographicalService.getPincodesByArea(params);

    if (!result.success) {
      logger.warn("Pincodes retrieval failed", {
        params,
        error: result.error,
      });
      return res
        .status(500)
        .json(
          APIResponse.error(
            result.error || "Failed to retrieve pincodes",
            "SERVICE_ERROR",
          ),
        );
    }

    const total = result.total || 0;
    const totalPages = Math.ceil(total / params.limit);

    logger.info("Pincodes retrieved successfully", {
      params,
      count: result.data?.length || 0,
      total,
      totalPages,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      cached: result.cached,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result.data, {
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages,
        },
        activeCount: result.activeCount,
        inactiveCount: result.inactiveCount,
      }),
    );
  } catch (error) {
    logger.error("Failed to get pincodes", {
      error: error.message,
      query: req.query,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 5. Search pincodes with comprehensive filtering
 * @route GET /api/v1/geography/pincodes/search?code=123456&city=name&state=name&district=name
 * @access Public
 */
async function searchPincodes(req, res) {
  try {
    const { code, city, state, district, page, limit, sortBy } = req.query;

    logger.info("Searching pincodes", {
      code,
      city,
      state,
      district,
      page,
      limit,
      userId: req.user?.id,
    });

    // Validation - at least one search parameter required
    if (!code && !city && !state && !district) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "At least one search parameter (code, city, state, or district) is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    const geographicalService = getGeographicalService();
    const params = {
      pincode: code, // Service expects 'pincode' parameter
      city,
      state,
      district,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      sortBy: sortBy || "code",
    };

    const result = await geographicalService.searchPincodes(params);

    if (!result.success) {
      logger.warn("Pincode search failed", {
        params,
        error: result.error,
      });
      return res
        .status(500)
        .json(
          APIResponse.error(
            result.error || "Pincode search failed",
            "SERVICE_ERROR",
          ),
        );
    }

    logger.info("Pincodes search completed", {
      params,
      count: result.data?.length || 0,
      total: result.pagination?.total || 0,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        pincodes: result.data,
        pagination: result.pagination,
      }),
    );
  } catch (error) {
    logger.error("Pincode search error", {
      error: error.message,
      query: req.query,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(APIResponse.error("Pincode search failed", "INTERNAL_ERROR"));
  }
}

/**
 * 6. Get complete pincode details with hierarchy
 * @route GET /api/v1/geography/pincodes/:code
 * @access Public
 */
async function getPincodeDetails(req, res) {
  try {
    const { code } = req.params;

    logger.info("Getting pincode details", {
      code,
      userId: req.user?.id,
    });

    // Validation - 6-digit pincode
    if (!code || !/^\d{6}$/.test(code)) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Valid 6-digit pincode is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    const geographicalService = getGeographicalService();
    const result = await geographicalService.getPincodeDetails(code);

    if (!result.success || !result.data) {
      logger.warn("Pincode not found", { code });
      return res
        .status(404)
        .json(APIResponse.error(`Pincode ${code} not found`, "NOT_FOUND"));
    }

    logger.info("Pincode details retrieved", {
      code,
      areaName: result.data?.areaName,
      district: result.data?.district,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result.data));
  } catch (error) {
    logger.error("Failed to get pincode details", {
      error: error.message,
      code: req.params.code,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve pincode details",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 7. Batch get cities for multiple states
 * @route POST /api/v1/geography/cities/by-states
 * @body { stateIds: [uuid1, uuid2, ...] }
 * @access Public
 */
async function getCitiesByStates(req, res) {
  try {
    const { stateIds } = req.body;

    logger.info("Batch getting cities by states", {
      stateCount: stateIds?.length,
      userId: req.user?.id,
    });

    // Validation
    if (!stateIds || !Array.isArray(stateIds) || stateIds.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "stateIds array is required and must not be empty",
            "VALIDATION_ERROR",
          ),
        );
    }

    if (stateIds.length > 50) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Maximum 50 states can be queried at once",
            "VALIDATION_ERROR",
          ),
        );
    }

    const geographicalService = getGeographicalService();
    const result = await geographicalService.getCitiesByStates(stateIds);

    logger.info("Batch cities retrieved successfully", {
      stateCount: stateIds.length,
      totalCities: result.summary?.totalCities || 0,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Batch get cities failed", {
      error: error.message,
      stateCount: req.body.stateIds?.length,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve cities for states",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 8. Batch get areas for multiple cities
 * @route POST /api/v1/geography/areas/by-cities
 * @body { cityIds: [uuid1, uuid2, ...] }
 * @access Public
 */
async function getAreasByCities(req, res) {
  try {
    const { cityIds } = req.body;

    logger.info("Batch getting areas by cities", {
      cityCount: cityIds?.length,
      userId: req.user?.id,
    });

    // Validation
    if (!cityIds || !Array.isArray(cityIds) || cityIds.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "cityIds array is required and must not be empty",
            "VALIDATION_ERROR",
          ),
        );
    }

    if (cityIds.length > 100) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Maximum 100 cities can be queried at once",
            "VALIDATION_ERROR",
          ),
        );
    }

    const geographicalService = getGeographicalService();
    const result = await geographicalService.getAreasByCities(cityIds);

    logger.info("Batch areas retrieved successfully", {
      cityCount: cityIds.length,
      totalAreas: result.summary?.totalAreas || 0,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Batch get areas failed", {
      error: error.message,
      cityCount: req.body.cityIds?.length,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve areas for cities",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 9. Batch get pincodes for multiple areas
 * @route POST /api/v1/geography/pincodes/by-areas
 * @body { areaIds: [uuid1, uuid2, ...] }
 * @access Public
 */
async function getPincodesByAreas(req, res) {
  try {
    const { areaIds } = req.body;

    logger.info("Batch getting pincodes by areas", {
      areaCount: areaIds?.length,
      userId: req.user?.id,
    });

    // Validation
    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "areaIds array is required and must not be empty",
            "VALIDATION_ERROR",
          ),
        );
    }

    if (areaIds.length > 100) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Maximum 100 areas can be queried at once",
            "VALIDATION_ERROR",
          ),
        );
    }

    const geographicalService = getGeographicalService();
    const result = await geographicalService.getPincodesByAreas(areaIds);

    logger.info("Batch pincodes retrieved successfully", {
      areaCount: areaIds.length,
      totalPincodes: result.summary?.totalPincodes || 0,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Batch get pincodes failed", {
      error: error.message,
      areaCount: req.body.areaIds?.length,
      stack: error.stack,
      userId: req.user?.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve pincodes for areas",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * Export all controller functions
 * Following auth-service pattern with function-based exports
 */
/**
 * Search states by name or code
 * GET /api/v1/geography/states/search?name=text&code=text&page=1&limit=20
 */
async function searchStates(req, res) {
  try {
    const { name, code, page = 1, limit = 50 } = req.query;

    logger.info("Searching states", { name, code, page, limit });

    const geographicalService = getGeographicalService();

    // Get all states first
    const allStates = await geographicalService.getStates();

    // Filter by name or code if provided
    let filteredStates = allStates;

    if (name) {
      const searchTerm = name.toLowerCase();
      filteredStates = filteredStates.filter((state) =>
        state.name.toLowerCase().includes(searchTerm),
      );
    }

    if (code) {
      filteredStates = filteredStates.filter((state) => state.code === code);
    }

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedStates = filteredStates.slice(startIndex, endIndex);

    logger.info("States search completed", {
      total: filteredStates.length,
      returned: paginatedStates.length,
    });

    return res.json(
      APIResponse.success(paginatedStates, {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredStates.length,
          pages: Math.ceil(filteredStates.length / parseInt(limit)),
        },
      }),
    );
  } catch (error) {
    logger.error("States search failed", { error: error.message });
    return res
      .status(500)
      .json(APIResponse.error("Failed to search states", "INTERNAL_ERROR"));
  }
}

/**
 * Get cities with comprehensive filtering
 * GET /api/v1/geography/cities?stateId=uuid&stateIds=uuid1,uuid2&page=1&limit=50
 */
async function getCities(req, res) {
  try {
    const { stateId, stateIds, page = 1, limit = 50 } = req.query;

    logger.info("Getting cities with filters", {
      stateId,
      stateIds,
      page,
      limit,
    });

    const geographicalService = getGeographicalService();

    // Build params - combine stateId and stateIds
    let combinedStateIds = null;
    if (stateId) {
      combinedStateIds = stateId;
    }
    if (stateIds) {
      combinedStateIds = combinedStateIds
        ? `${combinedStateIds},${stateIds}`
        : stateIds;
    }

    const params = {
      stateIds: combinedStateIds,
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const result = await geographicalService.getCities(params);

    if (!result.success) {
      return res
        .status(500)
        .json(
          APIResponse.error(
            result.error || "Failed to retrieve cities",
            "SERVICE_ERROR",
          ),
        );
    }

    const total = result.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    logger.info("Cities retrieved successfully", {
      count: result.data.length,
      total,
      totalPages,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
    });

    return res.json(
      APIResponse.success(result.data, {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
        activeCount: result.activeCount,
        inactiveCount: result.inactiveCount,
      }),
    );
  } catch (error) {
    logger.error("Failed to get cities", { error: error.message });
    return res
      .status(500)
      .json(APIResponse.error("Failed to retrieve cities", "INTERNAL_ERROR"));
  }
}

/**
 * Get areas with comprehensive filtering
 * GET /api/v1/geography/areas?cityId=uuid&cityIds=uuid1,uuid2&stateIds=uuid1,uuid2&page=1&limit=50
 */
async function getAreas(req, res) {
  try {
    const { cityId, cityIds, stateIds, page = 1, limit = 50 } = req.query;

    logger.info("Getting areas with filters", {
      cityId,
      cityIds,
      stateIds,
      page,
      limit,
    });

    const geographicalService = getGeographicalService();

    // Build params - combine cityId and cityIds
    let combinedCityIds = null;
    if (cityId) {
      combinedCityIds = cityId;
    }
    if (cityIds) {
      combinedCityIds = combinedCityIds
        ? `${combinedCityIds},${cityIds}`
        : cityIds;
    }

    const params = {
      cityIds: combinedCityIds,
      stateIds,
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const result = await geographicalService.getAreas(params);

    if (!result.success) {
      return res
        .status(500)
        .json(
          APIResponse.error(
            result.error || "Failed to retrieve areas",
            "SERVICE_ERROR",
          ),
        );
    }

    const total = result.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    logger.info("Areas retrieved successfully", {
      count: result.data.length,
      total,
      totalPages,
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
    });

    return res.json(
      APIResponse.success(result.data, {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
        activeCount: result.activeCount,
        inactiveCount: result.inactiveCount,
      }),
    );
  } catch (error) {
    logger.error("Failed to get areas", { error: error.message });
    return res
      .status(500)
      .json(APIResponse.error("Failed to retrieve areas", "INTERNAL_ERROR"));
  }
}

/**
 * 10. Toggle state status (active/inactive)
 * @route PATCH /api/v1/geography/states/:id/toggle-status
 * @access Public
 */
async function toggleStateStatus(req, res) {
  try {
    const { id } = req.params;

    logger.info("Toggling state status", { id, userId: req.user?.id });

    const geographicalService = getGeographicalService();
    const result = await geographicalService.toggleStateStatus(id);

    if (!result.success) {
      return res
        .status(404)
        .json(
          APIResponse.error(result.error || "State not found", "NOT_FOUND"),
        );
    }

    logger.info("State status toggled successfully", {
      id,
      newStatus: result.data.status,
    });
    res.json(
      APIResponse.success(result.data, {
        message: "State status updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Failed to toggle state status", {
      error: error.message,
      id: req.params.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error("Failed to update state status", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 11. Toggle city status (active/inactive)
 * @route PATCH /api/v1/geography/cities/:id/toggle-status
 * @access Public
 */
async function toggleCityStatus(req, res) {
  try {
    const { id } = req.params;

    logger.info("Toggling city status", { id, userId: req.user?.id });

    const geographicalService = getGeographicalService();
    const result = await geographicalService.toggleCityStatus(id);

    if (!result.success) {
      return res
        .status(404)
        .json(APIResponse.error(result.error || "City not found", "NOT_FOUND"));
    }

    logger.info("City status toggled successfully", {
      id,
      newStatus: result.data.status,
    });
    res.json(
      APIResponse.success(result.data, {
        message: "City status updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Failed to toggle city status", {
      error: error.message,
      id: req.params.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error("Failed to update city status", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 12. Toggle area status (active/inactive)
 * @route PATCH /api/v1/geography/areas/:id/toggle-status
 * @access Public
 */
async function toggleAreaStatus(req, res) {
  try {
    const { id } = req.params;

    logger.info("Toggling area status", { id, userId: req.user?.id });

    const geographicalService = getGeographicalService();
    const result = await geographicalService.toggleAreaStatus(id);

    if (!result.success) {
      return res
        .status(404)
        .json(APIResponse.error(result.error || "Area not found", "NOT_FOUND"));
    }

    logger.info("Area status toggled successfully", {
      id,
      newStatus: result.data.status,
    });
    res.json(
      APIResponse.success(result.data, {
        message: "Area status updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Failed to toggle area status", {
      error: error.message,
      id: req.params.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error("Failed to update area status", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 13. Toggle pincode status (active/inactive)
 * @route PATCH /api/v1/geography/pincodes/:id/toggle-status
 * @access Public
 */
async function togglePincodeStatus(req, res) {
  try {
    const { id } = req.params;

    logger.info("Toggling pincode status", { id, userId: req.user?.id });

    const geographicalService = getGeographicalService();
    const result = await geographicalService.togglePincodeStatus(id);

    if (!result.success) {
      return res
        .status(404)
        .json(
          APIResponse.error(result.error || "Pincode not found", "NOT_FOUND"),
        );
    }

    logger.info("Pincode status toggled successfully", {
      id,
      newStatus: result.data.status,
    });
    res.json(
      APIResponse.success(result.data, {
        message: "Pincode status updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Failed to toggle pincode status", {
      error: error.message,
      id: req.params.id,
    });
    res
      .status(500)
      .json(
        APIResponse.error("Failed to update pincode status", "INTERNAL_ERROR"),
      );
  }
}

module.exports = {
  getStates,
  searchStates,
  getCitiesByState,
  getCities,
  getAreasByCity,
  getAreas,
  getPincodesByArea,
  searchPincodes,
  getPincodeDetails,
  getCitiesByStates,
  getAreasByCities,
  getPincodesByAreas,
  toggleStateStatus,
  toggleCityStatus,
  toggleAreaStatus,
  togglePincodeStatus,
};
