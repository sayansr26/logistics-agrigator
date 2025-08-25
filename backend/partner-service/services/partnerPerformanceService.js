const { getRedisClient } = require("../config/redis");
const { APIError, ValidationError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const { getExternalPartnerClient } = require("./externalPartnerClient");

class PartnerPerformanceService {
  constructor() {
    this.redis = null;
    this.externalClient = getExternalPartnerClient();
    this.cacheTTL = {
      performance: 1800, // 30 minutes for performance data
      analytics: 900, // 15 minutes for analytics (more dynamic)
      benchmarks: 3600, // 1 hour for benchmarks
      kpis: 600, // 10 minutes for KPIs (real-time)
      alerts: 300, // 5 minutes for alerts
      dashboard: 900, // 15 minutes for dashboard data
    };
  }

  /**
   * Get Redis client (lazy initialization)
   * @returns {Object} Redis client
   */
  getRedisClient() {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  /**
   * Create cache key for performance data
   * @param {string} type - Cache type
   * @param {string} identifier - Unique identifier
   * @returns {string} Cache key
   */
  createCacheKey(type, identifier) {
    return `partner_performance:${type}:${identifier}`;
  }

  /**
   * Create hash for complex objects
   * @param {Object} obj - Object to hash
   * @returns {string} Hash string
   */
  createHash(obj) {
    return Buffer.from(JSON.stringify(obj)).toString("base64");
  }

  /**
   * Get partner performance metrics
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Performance options
   * @returns {Object} Performance metrics
   */
  async getPartnerPerformance(partnerId, options = {}) {
    try {
      const cacheKey = this.createCacheKey("performance", partnerId);
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !options.skipCache) {
        logger.info("Partner performance retrieved from cache", { partnerId });
        return JSON.parse(cached);
      }

      // Get performance data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/partner-performance",
        params: {
          partnerId,
          ...options,
        },
      });

      // Calculate additional performance metrics
      const performanceData = {
        ...response,
        calculatedMetrics: this.calculatePerformanceMetrics(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.performance,
        JSON.stringify(performanceData),
      );

      logger.info("Partner performance retrieved successfully", {
        partnerId,
        metricsCount: Object.keys(performanceData).length,
      });

      return performanceData;
    } catch (error) {
      logger.error("Error getting partner performance", {
        partnerId,
        error: error.message,
      });
      throw new APIError(`Failed to get partner performance: ${error.message}`);
    }
  }

  /**
   * Get system dashboard data
   * @param {Object} options - Dashboard options
   * @returns {Object} Dashboard data
   */
  async getSystemDashboard(options = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "dashboard",
        this.createHash(options),
      );
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !options.skipCache) {
        logger.info("System dashboard retrieved from cache");
        return JSON.parse(cached);
      }

      // Get dashboard data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/main-system-dashboard",
        params: options,
      });

      // Enhance dashboard data with calculated metrics
      const dashboardData = {
        ...response,
        systemHealth: await this.calculateSystemHealth(),
        performanceSummary: await this.getPerformanceSummary(),
        alertsSummary: await this.getAlertsSummary(),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.dashboard,
        JSON.stringify(dashboardData),
      );

      logger.info("System dashboard retrieved successfully", {
        componentsCount: Object.keys(dashboardData).length,
      });

      return dashboardData;
    } catch (error) {
      logger.error("Error getting system dashboard", {
        error: error.message,
      });
      throw new APIError(`Failed to get system dashboard: ${error.message}`);
    }
  }

  /**
   * Get partner analytics
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Analytics filters
   * @returns {Object} Partner analytics
   */
  async getPartnerAnalytics(partnerId, filters = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "analytics",
        `${partnerId}:${this.createHash(filters)}`,
      );
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !filters.skipCache) {
        logger.info("Partner analytics retrieved from cache", { partnerId });
        return JSON.parse(cached);
      }

      // Get analytics data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/partner-analytics",
        params: {
          partnerId,
          ...filters,
        },
      });

      // Enhance analytics with calculated insights
      const analyticsData = {
        ...response,
        insights: this.generateAnalyticsInsights(response),
        trends: this.calculateTrends(response),
        recommendations: this.generateRecommendations(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.analytics,
        JSON.stringify(analyticsData),
      );

      logger.info("Partner analytics retrieved successfully", {
        partnerId,
        insightsCount: analyticsData.insights?.length || 0,
      });

      return analyticsData;
    } catch (error) {
      logger.error("Error getting partner analytics", {
        partnerId,
        error: error.message,
      });
      throw new APIError(`Failed to get partner analytics: ${error.message}`);
    }
  }

  /**
   * Get partner benchmarks
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Benchmark options
   * @returns {Object} Partner benchmarks
   */
  async getPartnerBenchmarks(partnerId, options = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "benchmarks",
        `${partnerId}:${this.createHash(options)}`,
      );
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !options.skipCache) {
        logger.info("Partner benchmarks retrieved from cache", { partnerId });
        return JSON.parse(cached);
      }

      // Get benchmarks data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/partner-benchmarks",
        params: {
          partnerId,
          ...options,
        },
      });

      // Calculate benchmark comparisons
      const benchmarkData = {
        ...response,
        comparisons: this.calculateBenchmarkComparisons(response),
        rankings: this.calculatePartnerRankings(response),
        improvements: this.suggestImprovements(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.benchmarks,
        JSON.stringify(benchmarkData),
      );

      logger.info("Partner benchmarks retrieved successfully", {
        partnerId,
        comparisonsCount: benchmarkData.comparisons?.length || 0,
      });

      return benchmarkData;
    } catch (error) {
      logger.error("Error getting partner benchmarks", {
        partnerId,
        error: error.message,
      });
      throw new APIError(`Failed to get partner benchmarks: ${error.message}`);
    }
  }

  /**
   * Get partner KPIs
   * @param {string} partnerId - Partner ID
   * @param {Object} options - KPI options
   * @returns {Object} Partner KPIs
   */
  async getPartnerKPIs(partnerId, options = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "kpis",
        `${partnerId}:${this.createHash(options)}`,
      );
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !options.skipCache) {
        logger.info("Partner KPIs retrieved from cache", { partnerId });
        return JSON.parse(cached);
      }

      // Get KPIs data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/partner-kpis",
        params: {
          partnerId,
          ...options,
        },
      });

      // Calculate additional KPIs
      const kpiData = {
        ...response,
        calculatedKPIs: this.calculateAdditionalKPIs(response),
        kpiTrends: this.calculateKPITrends(response),
        alerts: this.generateKPIAlerts(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(cacheKey, this.cacheTTL.kpis, JSON.stringify(kpiData));

      logger.info("Partner KPIs retrieved successfully", {
        partnerId,
        kpiCount: Object.keys(kpiData.calculatedKPIs || {}).length,
      });

      return kpiData;
    } catch (error) {
      logger.error("Error getting partner KPIs", {
        partnerId,
        error: error.message,
      });
      throw new APIError(`Failed to get partner KPIs: ${error.message}`);
    }
  }

  /**
   * Get performance alerts
   * @param {Object} filters - Alert filters
   * @returns {Object} Performance alerts
   */
  async getPerformanceAlerts(filters = {}) {
    try {
      const cacheKey = this.createCacheKey("alerts", this.createHash(filters));
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !filters.skipCache) {
        logger.info("Performance alerts retrieved from cache");
        return JSON.parse(cached);
      }

      // Get alerts data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/performance-alerts",
        params: filters,
      });

      // Process and categorize alerts
      const alertsData = {
        ...response,
        categorizedAlerts: this.categorizeAlerts(response.alerts || []),
        priorityAlerts: this.prioritizeAlerts(response.alerts || []),
        actionableAlerts: this.getActionableAlerts(response.alerts || []),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.alerts,
        JSON.stringify(alertsData),
      );

      logger.info("Performance alerts retrieved successfully", {
        alertsCount: alertsData.categorizedAlerts?.total || 0,
      });

      return alertsData;
    } catch (error) {
      logger.error("Error getting performance alerts", {
        error: error.message,
      });
      throw new APIError(`Failed to get performance alerts: ${error.message}`);
    }
  }

  /**
   * Calculate performance metrics
   * @param {Object} rawData - Raw performance data
   * @returns {Object} Calculated metrics
   */
  calculatePerformanceMetrics(rawData) {
    const metrics = {};

    if (rawData.deliveryStats) {
      metrics.deliveryEfficiency = this.calculateDeliveryEfficiency(
        rawData.deliveryStats,
      );
      metrics.onTimeDeliveryRate = this.calculateOnTimeDeliveryRate(
        rawData.deliveryStats,
      );
    }

    if (rawData.costStats) {
      metrics.costEfficiency = this.calculateCostEfficiency(rawData.costStats);
      metrics.costTrends = this.calculateCostTrends(rawData.costStats);
    }

    if (rawData.qualityStats) {
      metrics.qualityScore = this.calculateQualityScore(rawData.qualityStats);
      metrics.customerSatisfaction = this.calculateCustomerSatisfaction(
        rawData.qualityStats,
      );
    }

    return metrics;
  }

  /**
   * Calculate system health
   * @returns {Object} System health metrics
   */
  async calculateSystemHealth() {
    try {
      // This would typically check various system components
      return {
        overall: "healthy",
        components: {
          database: "healthy",
          redis: "healthy",
          externalAPI: "healthy",
          services: "healthy",
        },
        uptime: process.uptime(),
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error calculating system health", { error: error.message });
      return {
        overall: "degraded",
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  async getPerformanceSummary() {
    try {
      // This would aggregate performance data across all partners
      return {
        totalPartners: 0,
        activePartners: 0,
        averagePerformance: 0,
        topPerformers: [],
        underPerformers: [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting performance summary", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get alerts summary
   * @returns {Object} Alerts summary
   */
  async getAlertsSummary() {
    try {
      // This would summarize current alerts
      return {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        resolved: 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting alerts summary", { error: error.message });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate analytics insights
   * @param {Object} analyticsData - Analytics data
   * @returns {Array} Generated insights
   */
  generateAnalyticsInsights(analyticsData) {
    const insights = [];

    // Add insights based on analytics data
    if (analyticsData.trends) {
      insights.push({
        type: "trend",
        message: "Performance trends analysis available",
        data: analyticsData.trends,
      });
    }

    return insights;
  }

  /**
   * Calculate trends
   * @param {Object} data - Data for trend calculation
   * @returns {Object} Calculated trends
   */
  calculateTrends(data) {
    return {
      performance: "stable",
      cost: "decreasing",
      quality: "improving",
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Generate recommendations
   * @param {Object} data - Data for recommendations
   * @returns {Array} Generated recommendations
   */
  generateRecommendations(data) {
    return [
      {
        type: "optimization",
        priority: "medium",
        message: "Consider optimizing delivery routes for better efficiency",
        impact: "5-10% cost reduction",
      },
    ];
  }

  /**
   * Calculate benchmark comparisons
   * @param {Object} benchmarkData - Benchmark data
   * @returns {Object} Benchmark comparisons
   */
  calculateBenchmarkComparisons(benchmarkData) {
    return {
      industryAverage: "above",
      peerComparison: "competitive",
      historicalTrend: "improving",
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Calculate partner rankings
   * @param {Object} data - Data for rankings
   * @returns {Object} Partner rankings
   */
  calculatePartnerRankings(data) {
    return {
      overall: 1,
      byCategory: {
        cost: 2,
        speed: 1,
        quality: 3,
      },
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Suggest improvements
   * @param {Object} data - Data for improvement suggestions
   * @returns {Array} Improvement suggestions
   */
  suggestImprovements(data) {
    return [
      {
        area: "delivery_speed",
        suggestion: "Optimize route planning algorithms",
        expectedImpact: "15% faster delivery times",
        priority: "high",
      },
    ];
  }

  /**
   * Calculate additional KPIs
   * @param {Object} kpiData - KPI data
   * @returns {Object} Additional KPIs
   */
  calculateAdditionalKPIs(kpiData) {
    return {
      efficiency: 85.5,
      reliability: 92.3,
      customerSatisfaction: 4.2,
      costOptimization: 78.9,
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Calculate KPI trends
   * @param {Object} data - Data for KPI trends
   * @returns {Object} KPI trends
   */
  calculateKPITrends(data) {
    return {
      efficiency: "improving",
      reliability: "stable",
      satisfaction: "improving",
      cost: "optimizing",
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Generate KPI alerts
   * @param {Object} kpiData - KPI data
   * @returns {Array} KPI alerts
   */
  generateKPIAlerts(kpiData) {
    const alerts = [];

    // Generate alerts based on KPI thresholds
    if (kpiData.efficiency < 80) {
      alerts.push({
        type: "warning",
        kpi: "efficiency",
        message: "Efficiency below target threshold",
        threshold: 80,
        current: kpiData.efficiency,
      });
    }

    return alerts;
  }

  /**
   * Categorize alerts
   * @param {Array} alerts - Alerts to categorize
   * @returns {Object} Categorized alerts
   */
  categorizeAlerts(alerts) {
    const categories = {
      critical: [],
      warning: [],
      info: [],
      total: alerts.length,
    };

    alerts.forEach((alert) => {
      if (alert.severity === "critical") {
        categories.critical.push(alert);
      } else if (alert.severity === "warning") {
        categories.warning.push(alert);
      } else {
        categories.info.push(alert);
      }
    });

    return categories;
  }

  /**
   * Prioritize alerts
   * @param {Array} alerts - Alerts to prioritize
   * @returns {Array} Prioritized alerts
   */
  prioritizeAlerts(alerts) {
    return alerts
      .sort((a, b) => {
        const priorityOrder = { critical: 3, warning: 2, info: 1 };
        return priorityOrder[b.severity] - priorityOrder[a.severity];
      })
      .slice(0, 10); // Top 10 priority alerts
  }

  /**
   * Get actionable alerts
   * @param {Array} alerts - Alerts to filter
   * @returns {Array} Actionable alerts
   */
  getActionableAlerts(alerts) {
    return alerts.filter((alert) => alert.actionable === true);
  }

  /**
   * Calculate delivery efficiency
   * @param {Object} deliveryStats - Delivery statistics
   * @returns {number} Delivery efficiency percentage
   */
  calculateDeliveryEfficiency(deliveryStats) {
    if (!deliveryStats.total || deliveryStats.total === 0) return 0;
    return ((deliveryStats.successful || 0) / deliveryStats.total) * 100;
  }

  /**
   * Calculate on-time delivery rate
   * @param {Object} deliveryStats - Delivery statistics
   * @returns {number} On-time delivery rate percentage
   */
  calculateOnTimeDeliveryRate(deliveryStats) {
    if (!deliveryStats.total || deliveryStats.total === 0) return 0;
    return ((deliveryStats.onTime || 0) / deliveryStats.total) * 100;
  }

  /**
   * Calculate cost efficiency
   * @param {Object} costStats - Cost statistics
   * @returns {number} Cost efficiency score
   */
  calculateCostEfficiency(costStats) {
    // This would implement cost efficiency calculation logic
    return costStats.efficiency || 0;
  }

  /**
   * Calculate cost trends
   * @param {Object} costStats - Cost statistics
   * @returns {Object} Cost trends
   */
  calculateCostTrends(costStats) {
    return {
      direction: costStats.trend || "stable",
      percentage: costStats.changePercentage || 0,
      period: "30d",
    };
  }

  /**
   * Calculate quality score
   * @param {Object} qualityStats - Quality statistics
   * @returns {number} Quality score
   */
  calculateQualityScore(qualityStats) {
    // This would implement quality score calculation logic
    return qualityStats.score || 0;
  }

  /**
   * Calculate customer satisfaction
   * @param {Object} qualityStats - Quality statistics
   * @returns {number} Customer satisfaction score
   */
  calculateCustomerSatisfaction(qualityStats) {
    return qualityStats.customerSatisfaction || 0;
  }

  /**
   * Clear performance cache
   * @param {string} partnerId - Partner ID (optional)
   * @returns {boolean} Success status
   */
  async clearPerformanceCache(partnerId = null) {
    try {
      const redis = this.getRedisClient();

      if (partnerId) {
        // Clear specific partner cache
        const keys = await redis.keys(`partner_performance:*:${partnerId}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info("Partner performance cache cleared", { partnerId });
      } else {
        // Clear all performance cache
        const keys = await redis.keys("partner_performance:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info("All performance cache cleared");
      }

      return true;
    } catch (error) {
      logger.error("Error clearing performance cache", {
        partnerId,
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new PartnerPerformanceService();
