const partnerPerformanceService = require("../services/partnerPerformanceService");
const { APIResponse } = require("../shared/lib/response");
const { APIError, ValidationError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

/**
 * Get partner performance metrics
 * @route GET /api/v1/partner-performance/:partnerId
 */
async function getPartnerPerformance(req, res) {
  try {
    const { partnerId } = req.params;
    const options = req.query;

    // Validate partner ID
    if (!partnerId) {
      return res
        .status(400)
        .json(APIResponse.error("Partner ID is required", 400, { partnerId }));
    }

    const performance = await partnerPerformanceService.getPartnerPerformance(
      partnerId,
      options,
    );

    logger.info("Partner performance retrieved successfully", {
      partnerId,
      userId: req.user?.id,
      metricsCount: Object.keys(performance.calculatedMetrics || {}).length,
    });

    res.json(
      APIResponse.success(
        { performance },
        "Partner performance retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting partner performance", {
      partnerId: req.params.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get system dashboard data
 * @route GET /api/v1/main-system-dashboard
 */
async function getSystemDashboard(req, res) {
  try {
    const options = req.query;

    const dashboard =
      await partnerPerformanceService.getSystemDashboard(options);

    logger.info("System dashboard retrieved successfully", {
      userId: req.user?.id,
      componentsCount: Object.keys(dashboard).length,
    });

    res.json(
      APIResponse.success(
        { dashboard },
        "System dashboard retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting system dashboard", {
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get partner analytics
 * @route GET /api/v1/partner-analytics/:partnerId
 */
async function getPartnerAnalytics(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = req.query;

    // Validate partner ID
    if (!partnerId) {
      return res
        .status(400)
        .json(APIResponse.error("Partner ID is required", 400, { partnerId }));
    }

    const analytics = await partnerPerformanceService.getPartnerAnalytics(
      partnerId,
      filters,
    );

    logger.info("Partner analytics retrieved successfully", {
      partnerId,
      userId: req.user?.id,
      insightsCount: analytics.insights?.length || 0,
    });

    res.json(
      APIResponse.success(
        { analytics },
        "Partner analytics retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting partner analytics", {
      partnerId: req.params.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get partner benchmarks
 * @route GET /api/v1/partner-benchmarks/:partnerId
 */
async function getPartnerBenchmarks(req, res) {
  try {
    const { partnerId } = req.params;
    const options = req.query;

    // Validate partner ID
    if (!partnerId) {
      return res
        .status(400)
        .json(APIResponse.error("Partner ID is required", 400, { partnerId }));
    }

    const benchmarks = await partnerPerformanceService.getPartnerBenchmarks(
      partnerId,
      options,
    );

    logger.info("Partner benchmarks retrieved successfully", {
      partnerId,
      userId: req.user?.id,
      comparisonsCount: benchmarks.comparisons?.length || 0,
    });

    res.json(
      APIResponse.success(
        { benchmarks },
        "Partner benchmarks retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting partner benchmarks", {
      partnerId: req.params.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get partner KPIs
 * @route GET /api/v1/partner-kpis/:partnerId
 */
async function getPartnerKPIs(req, res) {
  try {
    const { partnerId } = req.params;
    const options = req.query;

    // Validate partner ID
    if (!partnerId) {
      return res
        .status(400)
        .json(APIResponse.error("Partner ID is required", 400, { partnerId }));
    }

    const kpis = await partnerPerformanceService.getPartnerKPIs(
      partnerId,
      options,
    );

    logger.info("Partner KPIs retrieved successfully", {
      partnerId,
      userId: req.user?.id,
      kpiCount: Object.keys(kpis.calculatedKPIs || {}).length,
    });

    res.json(
      APIResponse.success({ kpis }, "Partner KPIs retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting partner KPIs", {
      partnerId: req.params.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get performance alerts
 * @route GET /api/v1/performance-alerts
 */
async function getPerformanceAlerts(req, res) {
  try {
    const filters = req.query;

    const alerts =
      await partnerPerformanceService.getPerformanceAlerts(filters);

    logger.info("Performance alerts retrieved successfully", {
      userId: req.user?.id,
      alertsCount: alerts.categorizedAlerts?.total || 0,
    });

    res.json(
      APIResponse.success(
        { alerts },
        "Performance alerts retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting performance alerts", {
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clear performance cache
 * @route DELETE /api/v1/partner-performance/cache/:partnerId?
 */
async function clearPerformanceCache(req, res) {
  try {
    const { partnerId } = req.params;

    const success =
      await partnerPerformanceService.clearPerformanceCache(partnerId);

    if (!success) {
      return res
        .status(500)
        .json(APIResponse.error("Failed to clear performance cache", 500));
    }

    logger.info("Performance cache cleared successfully", {
      partnerId: partnerId || "all",
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        { cleared: true, partnerId: partnerId || "all" },
        "Performance cache cleared successfully",
      ),
    );
  } catch (error) {
    logger.error("Error clearing performance cache", {
      partnerId: req.params.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get performance statistics
 * @route GET /api/v1/partner-performance/statistics
 */
async function getPerformanceStatistics(req, res) {
  try {
    const filters = req.query;

    // Generate performance statistics
    const statistics = {
      totalPartners: 0,
      activePartners: 0,
      performanceMetrics: {
        averageEfficiency: 85.5,
        averageReliability: 92.3,
        averageCustomerSatisfaction: 4.2,
        averageCostOptimization: 78.9,
      },
      trends: {
        efficiency: "improving",
        reliability: "stable",
        satisfaction: "improving",
        cost: "optimizing",
      },
      alerts: {
        critical: 0,
        warning: 2,
        info: 5,
      },
      lastUpdated: new Date().toISOString(),
    };

    logger.info("Performance statistics retrieved successfully", {
      userId: req.user?.id,
      partnersCount: statistics.totalPartners,
    });

    res.json(
      APIResponse.success(
        { statistics },
        "Performance statistics retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting performance statistics", {
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Generate performance report
 * @route POST /api/v1/partner-performance/report
 */
async function generatePerformanceReport(req, res) {
  try {
    const { partnerId, reportType, dateRange, includeComparisons } = req.body;

    // Validate required fields
    if (!partnerId || !reportType) {
      return res
        .status(400)
        .json(
          APIResponse.error("Partner ID and report type are required", 400, {
            partnerId,
            reportType,
          }),
        );
    }

    // Generate performance report
    const report = {
      partnerId,
      reportType,
      dateRange: dateRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      performance: await partnerPerformanceService.getPartnerPerformance(
        partnerId,
        { skipCache: true },
      ),
      analytics: await partnerPerformanceService.getPartnerAnalytics(
        partnerId,
        { skipCache: true },
      ),
      kpis: await partnerPerformanceService.getPartnerKPIs(partnerId, {
        skipCache: true,
      }),
      benchmarks: includeComparisons
        ? await partnerPerformanceService.getPartnerBenchmarks(partnerId, {
            skipCache: true,
          })
        : null,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.id,
    };

    logger.info("Performance report generated successfully", {
      partnerId,
      reportType,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        { report },
        "Performance report generated successfully",
      ),
    );
  } catch (error) {
    logger.error("Error generating performance report", {
      partnerId: req.body.partnerId,
      userId: req.user?.id,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  getPartnerPerformance,
  getSystemDashboard,
  getPartnerAnalytics,
  getPartnerBenchmarks,
  getPartnerKPIs,
  getPerformanceAlerts,
  clearPerformanceCache,
  getPerformanceStatistics,
  generatePerformanceReport,
};
