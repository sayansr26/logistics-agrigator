const partnerDataService = require("../services/partnerDataService");
const { response } = require("../shared/lib/response");
const { APIError, ValidationError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

/**
 * Get partner packages
 * @route GET /api/partner-packages/:partnerId
 */
async function getPartnerPackages(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = req.query;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const packages = await partnerDataService.getPartnerPackages(
      partnerId,
      filters,
    );

    logger.info("Partner packages retrieved successfully", {
      partnerId,
      localCount: packages.metadata.localCount,
      externalCount: packages.metadata.externalCount,
      userId: req.user?.id,
    });

    return res.json(
      response.success(
        packages,
        "Partner packages retrieved successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Error in getPartnerPackages", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to retrieve partner packages", 500));
  }
}

/**
 * Get partner charges
 * @route GET /api/partner-charges/:partnerId
 */
async function getPartnerCharges(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = req.query;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const charges = await partnerDataService.getPartnerCharges(
      partnerId,
      filters,
    );

    logger.info("Partner charges retrieved successfully", {
      partnerId,
      packageChargeCount: charges.metadata.packageChargeCount,
      customerChargeCount: charges.metadata.customerChargeCount,
      externalChargeCount: charges.metadata.externalChargeCount,
      userId: req.user?.id,
    });

    return res.json(
      response.success(charges, "Partner charges retrieved successfully", 200),
    );
  } catch (error) {
    logger.error("Error in getPartnerCharges", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to retrieve partner charges", 500));
  }
}

/**
 * Get partner discounts
 * @route GET /api/partner-discounts/:partnerId
 */
async function getPartnerDiscounts(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = {
      activeOnly: req.query.activeOnly === "true",
      discountType: req.query.discountType,
      includeExpired: req.query.includeExpired === "true",
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const discounts = await partnerDataService.getPartnerDiscounts(
      partnerId,
      filters,
    );

    logger.info("Partner discounts retrieved successfully", {
      partnerId,
      totalCount: discounts.metadata.totalCount,
      activeCount: discounts.metadata.activeCount,
      filters,
      userId: req.user?.id,
    });

    return res.json(
      response.success(
        discounts,
        "Partner discounts retrieved successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Error in getPartnerDiscounts", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to retrieve partner discounts", 500));
  }
}

/**
 * Get partner services and capabilities
 * @route GET /api/partner-services/:partnerId
 */
async function getPartnerServices(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = req.query;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const services = await partnerDataService.getPartnerServices(
      partnerId,
      filters,
    );

    logger.info("Partner services retrieved successfully", {
      partnerId,
      totalZones: services.metadata.totalZones,
      activeZones: services.metadata.activeZones,
      serviceTypes: services.metadata.totalServiceTypes,
      userId: req.user?.id,
    });

    return res.json(
      response.success(
        services,
        "Partner services retrieved successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Error in getPartnerServices", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to retrieve partner services", 500));
  }
}

/**
 * Get comprehensive partner data
 * @route GET /api/partners/comprehensive-data/:partnerId
 */
async function getComprehensivePartnerData(req, res) {
  try {
    const { partnerId } = req.params;
    const options = {
      includePackages: req.query.includePackages !== "false",
      includeCharges: req.query.includeCharges !== "false",
      includeDiscounts: req.query.includeDiscounts !== "false",
      includeServices: req.query.includeServices !== "false",
      includeMetrics: req.query.includeMetrics !== "false",
      packageFilters: req.query.packageFilters
        ? JSON.parse(req.query.packageFilters)
        : {},
      chargeFilters: req.query.chargeFilters
        ? JSON.parse(req.query.chargeFilters)
        : {},
      discountFilters: req.query.discountFilters
        ? JSON.parse(req.query.discountFilters)
        : {},
      serviceFilters: req.query.serviceFilters
        ? JSON.parse(req.query.serviceFilters)
        : {},
    };

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const comprehensiveData =
      await partnerDataService.getComprehensivePartnerData(partnerId, options);

    logger.info("Comprehensive partner data retrieved successfully", {
      partnerId,
      dataTypes: Object.keys(comprehensiveData.data),
      aggregationTime: comprehensiveData.metadata.aggregationTime,
      dataAvailability: comprehensiveData.metadata.dataAvailability,
      userId: req.user?.id,
    });

    return res.json(
      response.success(
        comprehensiveData,
        "Comprehensive partner data retrieved successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Error in getComprehensivePartnerData", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(
        response.error("Failed to retrieve comprehensive partner data", 500),
      );
  }
}

/**
 * Get partner performance metrics
 * @route GET /api/partners/:partnerId/metrics
 */
async function getPartnerMetrics(req, res) {
  try {
    const { partnerId } = req.params;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    const metrics = await partnerDataService.getPartnerMetrics(partnerId);

    logger.info("Partner metrics retrieved successfully", {
      partnerId,
      coveragePercentage: metrics.coverage.coveragePercentage,
      serviceTypeCount: metrics.services.serviceTypeCount,
      totalDiscounts: metrics.discounts.totalDiscounts,
      userId: req.user?.id,
    });

    return res.json(
      response.success(metrics, "Partner metrics retrieved successfully", 200),
    );
  } catch (error) {
    logger.error("Error in getPartnerMetrics", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to retrieve partner metrics", 500));
  }
}

/**
 * Export partner data in various formats
 * @route GET /api/partners/:partnerId/export
 */
async function exportPartnerData(req, res) {
  try {
    const { partnerId } = req.params;
    const { format = "json", dataTypes = "all" } = req.query;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    // Determine what data to include
    const includeOptions = {
      includePackages: dataTypes === "all" || dataTypes.includes("packages"),
      includeCharges: dataTypes === "all" || dataTypes.includes("charges"),
      includeDiscounts: dataTypes === "all" || dataTypes.includes("discounts"),
      includeServices: dataTypes === "all" || dataTypes.includes("services"),
      includeMetrics: dataTypes === "all" || dataTypes.includes("metrics"),
    };

    const exportData = await partnerDataService.getComprehensivePartnerData(
      partnerId,
      includeOptions,
    );

    // Add export metadata
    exportData.exportMetadata = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.id || "system",
      format,
      dataTypes:
        dataTypes === "all"
          ? Object.keys(exportData.data)
          : dataTypes.split(","),
      version: "1.0.0",
    };

    if (format === "csv") {
      // For CSV format, we'd need to flatten the data structure
      // This is a simplified implementation
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="partner-${partnerId}-data.csv"`,
      );

      // Convert to CSV (simplified - would need proper CSV conversion)
      const csvData = convertToCSV(exportData);
      return res.send(csvData);
    }

    // Default to JSON format
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="partner-${partnerId}-data.json"`,
    );

    logger.info("Partner data exported successfully", {
      partnerId,
      format,
      dataTypes,
      exportSize: JSON.stringify(exportData).length,
      userId: req.user?.id,
    });

    return res.json(exportData);
  } catch (error) {
    logger.error("Error in exportPartnerData", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(response.error(error.message, 400, error.details));
    }

    return res
      .status(500)
      .json(response.error("Failed to export partner data", 500));
  }
}

/**
 * Clear partner data cache
 * @route DELETE /api/partners/:partnerId/cache
 */
async function clearPartnerCache(req, res) {
  try {
    const { partnerId } = req.params;
    const { dataType } = req.query;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    await partnerDataService.clearPartnerCache(partnerId, dataType);

    logger.info("Partner cache cleared successfully", {
      partnerId,
      dataType: dataType || "all",
      userId: req.user?.id,
    });

    return res.json(
      response.success(
        { partnerId, clearedDataType: dataType || "all" },
        "Partner cache cleared successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Error in clearPartnerCache", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    return res
      .status(500)
      .json(response.error("Failed to clear partner cache", 500));
  }
}

/**
 * Get partner data health check
 * @route GET /api/partners/:partnerId/health
 */
async function getPartnerDataHealth(req, res) {
  try {
    const { partnerId } = req.params;

    // Validate partner exists
    const partnerExists =
      await partnerDataService.validatePartnerExists(partnerId);
    if (!partnerExists) {
      return res
        .status(404)
        .json(response.error("Partner not found", 404, { partnerId }));
    }

    // Check data availability and freshness
    const healthCheck = {
      partnerId,
      timestamp: new Date().toISOString(),
      dataHealth: {
        packages: { available: false, lastUpdated: null, cacheHit: false },
        charges: { available: false, lastUpdated: null, cacheHit: false },
        discounts: { available: false, lastUpdated: null, cacheHit: false },
        services: { available: false, lastUpdated: null, cacheHit: false },
      },
      overallHealth: "unknown",
    };

    // Quick health checks (these should be fast)
    try {
      const services = await partnerDataService.getPartnerServices(
        partnerId,
        {},
      );
      healthCheck.dataHealth.services.available = true;
      healthCheck.dataHealth.services.lastUpdated = services.timestamp;
      healthCheck.dataHealth.services.cacheHit = services.source === "cache";
    } catch (error) {
      healthCheck.dataHealth.services.error = error.message;
    }

    // Determine overall health
    const availableServices = Object.values(healthCheck.dataHealth).filter(
      (d) => d.available,
    ).length;
    const totalServices = Object.keys(healthCheck.dataHealth).length;

    if (availableServices === totalServices) {
      healthCheck.overallHealth = "healthy";
    } else if (availableServices > 0) {
      healthCheck.overallHealth = "partial";
    } else {
      healthCheck.overallHealth = "unhealthy";
    }

    logger.info("Partner data health check completed", {
      partnerId,
      overallHealth: healthCheck.overallHealth,
      availableServices,
      totalServices,
      userId: req.user?.id,
    });

    const statusCode = healthCheck.overallHealth === "unhealthy" ? 503 : 200;

    return res
      .status(statusCode)
      .json(
        response.success(
          healthCheck,
          `Partner data health: ${healthCheck.overallHealth}`,
          statusCode,
        ),
      );
  } catch (error) {
    logger.error("Error in getPartnerDataHealth", {
      partnerId: req.params.partnerId,
      error: error.message,
      userId: req.user?.id,
    });

    return res
      .status(500)
      .json(response.error("Failed to check partner data health", 500));
  }
}

/**
 * Helper method to convert data to CSV format
 * @param {Object} data - Data to convert
 * @returns {string} CSV string
 */
function convertToCSV(data) {
  // This is a simplified CSV conversion
  // In a real implementation, you'd want a proper CSV library
  const headers = ["Type", "ID", "Name", "Value", "Timestamp"];
  let csv = headers.join(",") + "\n";

  // Add basic partner info
  csv += `Partner,${data.partnerId},Partner Data Export,Comprehensive,${data.timestamp}\n`;

  // Add summary data
  if (data.data.services) {
    csv += `Services,${data.partnerId},Total Zones,${data.data.services.metadata.totalZones},${data.data.services.timestamp}\n`;
    csv += `Services,${data.partnerId},Active Zones,${data.data.services.metadata.activeZones},${data.data.services.timestamp}\n`;
  }

  if (data.data.metrics) {
    csv += `Metrics,${data.partnerId},Coverage Percentage,${data.data.metrics.coverage.coveragePercentage},${data.data.metrics.timestamp}\n`;
    csv += `Metrics,${data.partnerId},Service Types,${data.data.metrics.services.serviceTypeCount},${data.data.metrics.timestamp}\n`;
  }

  return csv;
}

module.exports = {
  getPartnerPackages,
  getPartnerCharges,
  getPartnerDiscounts,
  getPartnerServices,
  getComprehensivePartnerData,
  getPartnerMetrics,
  exportPartnerData,
  clearPartnerCache,
  getPartnerDataHealth,
};
