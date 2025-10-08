/**
 * Geographical Controller
 *
 * Handles geographical data operations including pincode search,
 * city/state data retrieval, and geographical hierarchy management
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { getGeographicalService } = require("../services/geographicalService");

class GeographicalController {
  /**
   * Search pincodes with comprehensive filtering
   */
  static async searchPincodes(req, res) {
    try {
      const {
        q, // Generic search query
        pincode,
        city,
        state,
        district,
        type,
        latitude,
        longitude,
        radius,
        page,
        limit,
        sortBy,
        searchMode,
        includeHierarchy,
        includeCoordinates,
        includeMetadata,
      } = req.query;

      // Handle generic search query 'q' parameter
      const searchParams = {
        pincode,
        city,
        state,
        district,
      };

      // If 'q' parameter is provided, try to determine what type of search it is
      if (q) {
        const query = q.trim();

        // Check if it's a pincode (6 digits)
        if (/^\d{6}$/.test(query)) {
          searchParams.pincode = query;
        } else {
          // For other queries, search in city, state, and district
          searchParams.city = query;
          searchParams.state = query;
          searchParams.district = query;
        }
      }

      // Validate required parameters
      if (
        !searchParams.pincode &&
        !searchParams.city &&
        !searchParams.state &&
        !searchParams.district
      ) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "At least one search parameter (q, pincode, city, state, or district) is required",
              "VALIDATION_ERROR",
            ),
          );
      }

      const geographicalService = getGeographicalService();

      const params = {
        pincode: searchParams.pincode,
        city: searchParams.city,
        state: searchParams.state,
        district: searchParams.district,
        type,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        radius: radius ? parseInt(radius) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        sortBy,
        searchMode,
        includeHierarchy: includeHierarchy === "true",
        includeCoordinates: includeCoordinates === "true",
        includeMetadata: includeMetadata === "true",
      };

      const result = await geographicalService.searchPincodes(params);

      // Log successful operation
      logger.info("Pincode search completed", {
        userId: req.user?.id,
        searchParams: params,
        resultCount: result.data?.length || 0,
      });

      res.json(
        APIResponse.success(result, "Pincode search completed successfully"),
      );
    } catch (error) {
      logger.error("Pincode search failed", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
      });

      // Handle different types of errors
      if (error.name === "ValidationError") {
        return res
          .status(400)
          .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
      }

      if (error.name === "NotFoundError") {
        return res
          .status(404)
          .json(APIResponse.error(error.message, "NOT_FOUND"));
      }

      // Generic error handling
      return res
        .status(500)
        .json(
          APIResponse.error(
            "Internal server error during pincode search",
            "INTERNAL_ERROR",
          ),
        );
    }
  }

  /**
   * Get specific pincode details
   */
  static async getPincodeDetails(req, res) {
    try {
      const { pincode } = req.params;

      // Validate pincode format
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        throw new ValidationError("Valid 6-digit pincode is required");
      }

      const geographicalService = getGeographicalService();
      const result = await geographicalService.getPincodeDetails(pincode);

      if (!result.success || !result.data) {
        throw new NotFoundError(`Pincode ${pincode} not found`);
      }

      // Log successful operation
      logger.info("Pincode details retrieved", {
        userId: req.user?.id,
        pincode,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Pincode details retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Get pincode details failed", {
        error: error.message,
        userId: req.user?.id,
        pincode: req.params.pincode,
      });
      throw error;
    }
  }

  /**
   * Get geographical hierarchy for pincode
   */
  static async getPincodeHierarchy(req, res) {
    try {
      const { pincode } = req.params;

      // Validate pincode format
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        throw new ValidationError("Valid 6-digit pincode is required");
      }

      const geographicalService = getGeographicalService();
      const result = await geographicalService.getPincodeHierarchy(pincode);

      if (!result.success || !result.data) {
        throw new NotFoundError(`Hierarchy for pincode ${pincode} not found`);
      }

      // Log successful operation
      logger.info("Pincode hierarchy retrieved", {
        userId: req.user?.id,
        pincode,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Pincode hierarchy retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Get pincode hierarchy failed", {
        error: error.message,
        userId: req.user?.id,
        pincode: req.params.pincode,
      });
      throw error;
    }
  }

  /**
   * Get pincodes by area ID
   */
  static async getPincodesByArea(req, res) {
    try {
      const {
        areaId,
        page = 1,
        limit = 20,
        sortBy = "pincode",
        sortOrder = "asc",
        includeCoordinates = false,
        includeHierarchy = false,
        includeMetadata = false,
        forceRefresh = false,
      } = req.query;

      // Validate areaId
      if (!areaId) {
        throw new ValidationError("Area ID is required");
      }

      const params = {
        areaId: parseInt(areaId),
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        includeCoordinates: includeCoordinates === "true",
        includeHierarchy: includeHierarchy === "true",
        includeMetadata: includeMetadata === "true",
        forceRefresh: forceRefresh === "true",
      };

      const geographicalService = getGeographicalService();
      const result = await geographicalService.getPincodesByArea(params);

      // Log successful operation
      logger.info("Pincodes by area retrieved", {
        userId: req.user?.id,
        areaId,
        resultCount: result.data?.length || 0,
        success: result.success,
        cached: result.cached,
      });

      // Handle both success and error responses gracefully
      if (result.success) {
        res.json(
          APIResponse.success(result.data, "Pincodes retrieved successfully"),
        );
      } else {
        // Return error response but don't crash the service
        res
          .status(503)
          .json(
            APIResponse.error(
              result.error || "External service temporarily unavailable",
              "SERVICE_UNAVAILABLE",
              { cached: result.cached, warning: result.warning },
            ),
          );
      }
    } catch (error) {
      logger.error("Get pincodes by area failed", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
      });
      throw error;
    }
  }

  /**
   * Get all states with pincode counts
   */
  static async getStatesWithPincodeCounts(req, res) {
    try {
      const geographicalService = getGeographicalService();
      const result = await geographicalService.getStatesWithPincodeCounts();

      if (!result.success || !result.data) {
        throw new NotFoundError("States data not available");
      }

      // Log successful operation
      logger.info("States with pincode counts retrieved", {
        userId: req.user?.id,
        stateCount: result.data?.length || 0,
      });

      res.json(
        APIResponse.success(
          result.data,
          "States with pincode counts retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Get states with pincode counts failed", {
        error: error.message,
        userId: req.user?.id,
      });
      throw error;
    }
  }

  /**
   * Get cities with comprehensive filtering
   */
  static async getCities(req, res) {
    try {
      const {
        stateIds,
        states,
        search,
        name,
        searchMode,
        isMetro,
        minPopulation,
        maxPopulation,
        latitude,
        longitude,
        radius,
        page,
        limit,
        sortBy,
        sortOrder,
        includeAreaCount,
        includeState,
        includeCoordinates,
        includeMetadata,
        fields,
        forceRefresh,
      } = req.query;

      const geographicalService = getGeographicalService();

      const params = {
        stateIds,
        states,
        search,
        name,
        searchMode,
        isMetro: isMetro === "true",
        minPopulation: minPopulation ? parseInt(minPopulation) : undefined,
        maxPopulation: maxPopulation ? parseInt(maxPopulation) : undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        radius: radius ? parseInt(radius) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        sortBy,
        sortOrder,
        includeAreaCount: includeAreaCount === "true",
        includeState: includeState === "true",
        includeCoordinates: includeCoordinates === "true",
        includeMetadata: includeMetadata === "true",
        fields,
        forceRefresh: forceRefresh === "true",
      };

      const result = await geographicalService.getCities(params);

      // Log successful operation
      logger.info("Cities retrieved", {
        userId: req.user?.id,
        searchParams: params,
        resultCount: result.data?.length || 0,
        success: result.success,
        cached: result.cached,
      });

      // Handle both success and error responses gracefully
      if (result.success) {
        res.json(
          APIResponse.success(result.data, "Cities retrieved successfully"),
        );
      } else {
        // Return error response but don't crash the service
        res
          .status(503)
          .json(
            APIResponse.error(
              result.error || "External service temporarily unavailable",
              "SERVICE_UNAVAILABLE",
              { cached: result.cached, warning: result.warning },
            ),
          );
      }
    } catch (error) {
      logger.error("Get cities failed", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
      });
      throw error;
    }
  }

  /**
   * Get areas with comprehensive filtering
   */
  static async getAreas(req, res) {
    try {
      const {
        cityIds,
        stateIds,
        states,
        search,
        name,
        searchMode,
        type,
        zone,
        minPincodeCount,
        maxPincodeCount,
        latitude,
        longitude,
        radius,
        page,
        limit,
        sortBy,
        sortOrder,
        includePincodeCount,
        includeCity,
        includeState,
        includeCoordinates,
        includeMetadata,
        includePincodes,
        fields,
        forceRefresh,
      } = req.query;

      const geographicalService = getGeographicalService();

      const params = {
        cityIds,
        stateIds,
        states,
        search,
        name,
        searchMode,
        type,
        zone,
        minPincodeCount: minPincodeCount
          ? parseInt(minPincodeCount)
          : undefined,
        maxPincodeCount: maxPincodeCount
          ? parseInt(maxPincodeCount)
          : undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        radius: radius ? parseInt(radius) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        sortBy,
        sortOrder,
        includePincodeCount: includePincodeCount === "true",
        includeCity: includeCity === "true",
        includeState: includeState === "true",
        includeCoordinates: includeCoordinates === "true",
        includeMetadata: includeMetadata === "true",
        includePincodes: includePincodes === "true",
        fields,
        forceRefresh: forceRefresh === "true",
      };

      const result = await geographicalService.getAreas(params);

      // Log successful operation
      logger.info("Areas retrieved", {
        userId: req.user?.id,
        searchParams: params,
        resultCount: result.data?.length || 0,
        success: result.success,
        cached: result.cached,
      });

      // Handle both success and error responses gracefully
      if (result.success) {
        res.json(
          APIResponse.success(result.data, "Areas retrieved successfully"),
        );
      } else {
        // Return error response but don't crash the service
        res
          .status(503)
          .json(
            APIResponse.error(
              result.error || "External service temporarily unavailable",
              "SERVICE_UNAVAILABLE",
              { cached: result.cached, warning: result.warning },
            ),
          );
      }
    } catch (error) {
      logger.error("Get areas failed", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
      });
      throw error;
    }
  }

  /**
   * Get geographical service statistics
   */
  static async getGeographicalStats(req, res) {
    try {
      const geographicalService = getGeographicalService();
      const stats = geographicalService.getStats();

      // Log successful operation
      logger.info("Geographical service stats retrieved", {
        userId: req.user?.id,
      });

      res.json(
        APIResponse.success(
          stats,
          "Geographical service statistics retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Get geographical stats failed", {
        error: error.message,
        userId: req.user?.id,
      });
      throw error;
    }
  }

  /**
   * Test endpoint for cities data (for development/testing)
   */
  static async getTestCities(req, res) {
    try {
      const { stateIds } = req.query;

      // Sample cities data for testing
      const testCities = {
        1: [
          // Andhra Pradesh
          {
            id: 1,
            name: "Hyderabad",
            stateId: 1,
            stateName: "Andhra Pradesh",
            isActive: true,
          },
          {
            id: 2,
            name: "Visakhapatnam",
            stateId: 1,
            stateName: "Andhra Pradesh",
            isActive: true,
          },
          {
            id: 3,
            name: "Vijayawada",
            stateId: 1,
            stateName: "Andhra Pradesh",
            isActive: true,
          },
          {
            id: 4,
            name: "Guntur",
            stateId: 1,
            stateName: "Andhra Pradesh",
            isActive: true,
          },
          {
            id: 5,
            name: "Tirupati",
            stateId: 1,
            stateName: "Andhra Pradesh",
            isActive: true,
          },
        ],
        20: [
          // Maharashtra
          {
            id: 101,
            name: "Mumbai",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 102,
            name: "Pune",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 103,
            name: "Nagpur",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 104,
            name: "Nashik",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 105,
            name: "Aurangabad",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 106,
            name: "Solapur",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 107,
            name: "Amravati",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
          {
            id: 108,
            name: "Kolhapur",
            stateId: 20,
            stateName: "Maharashtra",
            isActive: true,
          },
        ],
        9: [
          // Delhi
          {
            id: 201,
            name: "New Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
          {
            id: 202,
            name: "Central Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
          {
            id: 203,
            name: "East Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
          {
            id: 204,
            name: "North Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
          {
            id: 205,
            name: "South Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
          {
            id: 206,
            name: "West Delhi",
            stateId: 9,
            stateName: "Delhi",
            isActive: true,
          },
        ],
        7: [
          // Gujarat
          {
            id: 301,
            name: "Ahmedabad",
            stateId: 7,
            stateName: "Gujarat",
            isActive: true,
          },
          {
            id: 302,
            name: "Surat",
            stateId: 7,
            stateName: "Gujarat",
            isActive: true,
          },
          {
            id: 303,
            name: "Vadodara",
            stateId: 7,
            stateName: "Gujarat",
            isActive: true,
          },
          {
            id: 304,
            name: "Rajkot",
            stateId: 7,
            stateName: "Gujarat",
            isActive: true,
          },
          {
            id: 305,
            name: "Bhavnagar",
            stateId: 7,
            stateName: "Gujarat",
            isActive: true,
          },
        ],
        21: [
          // Karnataka
          {
            id: 401,
            name: "Bangalore",
            stateId: 21,
            stateName: "Karnataka",
            isActive: true,
          },
          {
            id: 402,
            name: "Mysore",
            stateId: 21,
            stateName: "Karnataka",
            isActive: true,
          },
          {
            id: 403,
            name: "Hubli",
            stateId: 21,
            stateName: "Karnataka",
            isActive: true,
          },
          {
            id: 404,
            name: "Mangalore",
            stateId: 21,
            stateName: "Karnataka",
            isActive: true,
          },
          {
            id: 405,
            name: "Belgaum",
            stateId: 21,
            stateName: "Karnataka",
            isActive: true,
          },
        ],
      };

      let cities = [];
      if (stateIds) {
        const stateIdArray = stateIds
          .split(",")
          .map((id) => parseInt(id.trim()));
        stateIdArray.forEach((stateId) => {
          if (testCities[stateId]) {
            cities.push(...testCities[stateId]);
          }
        });
      } else {
        cities = Object.values(testCities).flat();
      }

      logger.info("Test cities data returned", {
        stateIds,
        cityCount: cities.length,
        userId: req.user?.id,
      });

      res.json(
        APIResponse.success(cities, "Test cities data retrieved successfully"),
      );
    } catch (error) {
      logger.error("Get test cities failed", {
        error: error.message,
        userId: req.user?.id,
      });
      throw error;
    }
  }
}

module.exports = GeographicalController;
