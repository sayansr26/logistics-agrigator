const distanceService = require("../services/geographicalDistanceService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Geographical Distance Calculation Controller
 * Handles API endpoints for distance calculations
 */

/**
 * Calculate distance between two pincodes
 */
async function calculatePincodeDistance(req, res) {
  try {
    const { fromPincode, toPincode } = req.body;

    const result = await distanceService.calculatePincodeDistance(
      fromPincode,
      toPincode,
    );

    res.json(APIResponse.success(result, "Distance calculated successfully"));
  } catch (error) {
    logger.error("Error in calculatePincodeDistance:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Calculate distance between two cities
 */
async function calculateCityDistance(req, res) {
  try {
    const { fromCityId, toCityId } = req.body;

    const result = await distanceService.calculateCityDistance(
      fromCityId,
      toCityId,
    );

    res.json(APIResponse.success(result, "Distance calculated successfully"));
  } catch (error) {
    logger.error("Error in calculateCityDistance:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Calculate distance between two states
 */
async function calculateStateDistance(req, res) {
  try {
    const { fromStateId, toStateId } = req.body;

    const result = await distanceService.calculateStateDistance(
      fromStateId,
      toStateId,
    );

    res.json(APIResponse.success(result, "Distance calculated successfully"));
  } catch (error) {
    logger.error("Error in calculateStateDistance:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Calculate distance between two areas
 */
async function calculateAreaDistance(req, res) {
  try {
    const { fromAreaId, toAreaId } = req.body;

    const result = await distanceService.calculateAreaDistance(
      fromAreaId,
      toAreaId,
    );

    res.json(APIResponse.success(result, "Distance calculated successfully"));
  } catch (error) {
    logger.error("Error in calculateAreaDistance:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Calculate distance between two coordinates
 */
async function calculateCoordinateDistance(req, res) {
  try {
    const { from, to } = req.body;

    const result = await distanceService.calculateCoordinateDistance(from, to);

    res.json(APIResponse.success(result, "Distance calculated successfully"));
  } catch (error) {
    logger.error("Error in calculateCoordinateDistance:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Calculate multiple distances in batch
 */
async function batchCalculateDistances(req, res) {
  try {
    const { calculations } = req.body;

    if (!Array.isArray(calculations) || calculations.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error("Calculations array is required", "INVALID_INPUT"),
        );
    }

    if (calculations.length > 100) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Maximum 100 calculations allowed per batch",
            "LIMIT_EXCEEDED",
          ),
        );
    }

    const results = await distanceService.batchCalculateDistances(calculations);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    res.json(
      APIResponse.success(
        {
          totalRequests: calculations.length,
          successCount,
          failureCount,
          results,
        },
        "Batch distance calculation completed",
      ),
    );
  } catch (error) {
    logger.error("Error in batchCalculateDistances:", error);
    res.status(400).json(APIResponse.error(error.message, "CALCULATION_ERROR"));
  }
}

/**
 * Clear distance cache (admin only)
 */
async function clearDistanceCache(req, res) {
  try {
    // Check if user has admin role
    if (!req.user || !["superadmin", "admin"].includes(req.user.role)) {
      return res
        .status(403)
        .json(
          APIResponse.error(
            "Unauthorized: Admin access required",
            "UNAUTHORIZED",
          ),
        );
    }

    const { pattern } = req.body;
    const result = await distanceService.clearDistanceCache(pattern);

    res.json(
      APIResponse.success(result, "Distance cache cleared successfully"),
    );
  } catch (error) {
    logger.error("Error in clearDistanceCache:", error);
    res.status(400).json(APIResponse.error(error.message, "CACHE_ERROR"));
  }
}

/**
 * Health check for distance service
 */
async function healthCheck(req, res) {
  try {
    // Test a simple distance calculation
    const testDistance = distanceService.calculateHaversineDistance(
      28.6139,
      77.209, // Delhi
      18.9387,
      72.8354, // Mumbai
    );

    res.json(
      APIResponse.success(
        {
          status: "healthy",
          service: "geographical-distance",
          testCalculation: {
            delhi_to_mumbai_km: testDistance,
            formula: "haversine",
          },
        },
        "Distance service is healthy",
      ),
    );
  } catch (error) {
    logger.error("Error in healthCheck:", error);
    res
      .status(500)
      .json(APIResponse.error("Distance service unhealthy", "SERVICE_ERROR"));
  }
}

module.exports = {
  calculatePincodeDistance,
  calculateCityDistance,
  calculateStateDistance,
  calculateAreaDistance,
  calculateCoordinateDistance,
  batchCalculateDistances,
  clearDistanceCache,
  healthCheck,
};
