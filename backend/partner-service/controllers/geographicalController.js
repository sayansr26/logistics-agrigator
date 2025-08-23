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

      // Validate required parameters
      if (!pincode && !city && !state && !district) {
        throw new ValidationError(
          "At least one search parameter (pincode, city, state, or district) is required",
        );
      }

      const geographicalService = getGeographicalService();

      const params = {
        pincode,
        city,
        state,
        district,
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
      throw error;
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
      });

      res.json(APIResponse.success(result, "Cities retrieved successfully"));
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
      });

      res.json(APIResponse.success(result, "Areas retrieved successfully"));
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
}

module.exports = GeographicalController;
