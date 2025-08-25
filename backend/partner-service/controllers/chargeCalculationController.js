const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { ValidationError, APIError } = require("../shared/lib/errors");
const ChargeCalculationService = require("../services/chargeCalculationService");

// Lazy-load service to avoid Redis initialization issues
let chargeCalculationService = null;
const getChargeCalculationService = () => {
  if (!chargeCalculationService) {
    chargeCalculationService = new ChargeCalculationService();
  }
  return chargeCalculationService;
};

/**
 * Calculate surcharges for a specific partner
 */
async function calculateSurcharges(req, res) {
  try {
    const { partnerId } = req.params;
    const calculationData = req.body;

    // Validate partner ID
    if (!partnerId) {
      throw new ValidationError("Partner ID is required");
    }

    // Add user context for audit logging
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Surcharge calculation requested", {
      partnerId,
      userId: auditContext.userId,
      calculationData: { ...calculationData, sensitiveData: "[REDACTED]" },
    });

    // Calculate surcharges
    const result = await getChargeCalculationService().calculateSurcharges(
      partnerId,
      calculationData,
    );

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Surcharge calculation completed successfully", {
      partnerId,
      calculationId: result.calculationId,
      totalSurcharge: result.totalSurcharge,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(
        result,
        "Surcharge calculation completed successfully",
      ),
    );
  } catch (error) {
    logger.error("Surcharge calculation failed", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res
      .status(500)
      .json(APIResponse.error("Surcharge calculation failed", 500));
  }
}

/**
 * Calculate comprehensive charges for shipment
 */
async function calculateShipmentCharges(req, res) {
  try {
    const shipmentData = req.body.shipmentDetails || req.body;
    const options = req.body.calculationOptions || {};

    // Add user context
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Shipment charge calculation requested", {
      shipmentId: shipmentData.shipmentId,
      userId: auditContext.userId,
      options,
    });

    // Calculate shipment charges
    const result = await getChargeCalculationService().calculateShipmentCharges(
      shipmentData,
      options,
    );

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Shipment charge calculation completed successfully", {
      shipmentId: shipmentData.shipmentId,
      calculationId: result.calculationId,
      totalCharges: result.totalCharges,
      partnerCount: result.partnerQuotes?.length || 0,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(
        result,
        "Shipment charge calculation completed successfully",
      ),
    );
  } catch (error) {
    logger.error("Shipment charge calculation failed", {
      shipmentId: req.body.shipmentDetails?.shipmentId || req.body.shipmentId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res
      .status(500)
      .json(APIResponse.error("Shipment charge calculation failed", 500));
  }
}

/**
 * Validate charge calculation against business rules
 */
async function validateCharges(req, res) {
  try {
    const chargeData = req.body.chargeData || req.body;
    const validationRules = req.body.validationRules || {};

    // Add user context
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Charge validation requested", {
      userId: auditContext.userId,
      validationRules: Object.keys(validationRules),
    });

    // Validate charges
    const result = await getChargeCalculationService().validateCharges(
      chargeData,
      validationRules,
    );

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Charge validation completed successfully", {
      isValid: result.isValid,
      validationScore: result.validationScore,
      warningCount: result.warnings?.length || 0,
      errorCount: result.errors?.length || 0,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(result, "Charge validation completed successfully"),
    );
  } catch (error) {
    logger.error("Charge validation failed", {
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res.status(500).json(APIResponse.error("Charge validation failed", 500));
  }
}

/**
 * Get charge calculation breakdown and analytics
 */
async function getChargeBreakdown(req, res) {
  try {
    const { calculationId } = req.params;

    if (!calculationId) {
      throw new ValidationError("Calculation ID is required");
    }

    logger.info("Charge breakdown requested", {
      calculationId,
      userId: req.user?.id,
    });

    // Get charge breakdown
    const result =
      await getChargeCalculationService().getChargeBreakdown(calculationId);

    logger.info("Charge breakdown retrieved successfully", {
      calculationId,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Charge breakdown retrieved successfully"),
    );
  } catch (error) {
    logger.error("Failed to get charge breakdown", {
      calculationId: req.params.calculationId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res.status(404).json(APIResponse.error("Charge breakdown not found", 404));
  }
}

/**
 * Clear charge calculation cache
 */
async function clearChargeCache(req, res) {
  try {
    const { pattern } = req.query;

    // Add user context for audit logging
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Charge cache clear requested", {
      pattern: pattern || "*",
      userId: auditContext.userId,
    });

    // Clear cache
    const result =
      await getChargeCalculationService().clearChargeCache(pattern);

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Charge cache cleared successfully", {
      pattern: pattern || "*",
      keysCleared: result.keysCleared,
      userId: auditContext.userId,
    });

    res.json(APIResponse.success(result, "Charge cache cleared successfully"));
  } catch (error) {
    logger.error("Failed to clear charge cache", {
      pattern: req.query.pattern,
      error: error.message,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to clear charge cache", 500));
  }
}

/**
 * Get charge calculation statistics and analytics
 */
async function getChargeStatistics(req, res) {
  try {
    const { timeframe = "24h", partnerId } = req.query;

    logger.info("Charge statistics requested", {
      timeframe,
      partnerId,
      userId: req.user?.id,
    });

    // Generate statistics (this would typically query Redis metrics)
    const statistics = {
      timeframe,
      partnerId,
      totalCalculations: 0,
      averageCalculationTime: 0,
      cacheHitRate: 0,
      topPartners: [],
      calculationTrends: [],
      generatedAt: new Date().toISOString(),
    };

    logger.info("Charge statistics generated successfully", {
      timeframe,
      partnerId,
      totalCalculations: statistics.totalCalculations,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        statistics,
        "Charge statistics retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get charge statistics", {
      error: error.message,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to get charge statistics", 500));
  }
}

module.exports = {
  calculateSurcharges,
  calculateShipmentCharges,
  validateCharges,
  getChargeBreakdown,
  clearChargeCache,
  getChargeStatistics,
};
