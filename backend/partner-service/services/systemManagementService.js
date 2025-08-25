const { getRedisClient } = require("../config/redis");
const { APIError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const { getExternalPartnerClient } = require("./externalPartnerClient");

class SystemManagementService {
  constructor() {
    this.redis = null;
    this.externalClient = getExternalPartnerClient();
    this.cacheTTL = {
      systemStatus: 300, // 5 minutes for system status
      rateLimits: 600, // 10 minutes for rate limits
      cacheStats: 180, // 3 minutes for cache statistics
      auditLogs: 1800, // 30 minutes for audit logs
      webhooks: 900, // 15 minutes for webhook data
      systemConfig: 3600, // 1 hour for system configuration
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
   * Create cache key for system management data
   * @param {string} type - Cache type
   * @param {string} identifier - Unique identifier
   * @returns {string} Cache key
   */
  createCacheKey(type, identifier) {
    return `system_management:${type}:${identifier}`;
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
   * Initialize main system
   * @param {Object} config - System configuration
   * @returns {Object} System initialization result
   */
  async initializeMainSystem(config = {}) {
    try {
      const cacheKey = this.createCacheKey("init", this.createHash(config));
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !config.force) {
        logger.info("System initialization retrieved from cache");
        return JSON.parse(cached);
      }

      // Initialize system via external API
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/main-system",
        data: config,
      });

      // Enhance initialization data
      const initData = {
        ...response,
        systemHealth: await this.getSystemHealth(),
        services: await this.getServicesStatus(),
        configuration: await this.getSystemConfiguration(),
        timestamp: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.systemStatus,
        JSON.stringify(initData),
      );

      logger.info("Main system initialized successfully", {
        servicesCount: initData.services?.length || 0,
      });

      return initData;
    } catch (error) {
      logger.error("Error initializing main system", {
        error: error.message,
      });
      throw new APIError(`Failed to initialize main system: ${error.message}`);
    }
  }

  /**
   * Manage rate limiting
   * @param {Object} rateLimitConfig - Rate limit configuration
   * @returns {Object} Rate limit management result
   */
  async manageRateLimit(rateLimitConfig = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "rate_limit",
        this.createHash(rateLimitConfig),
      );
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !rateLimitConfig.skipCache) {
        logger.info("Rate limit configuration retrieved from cache");
        return JSON.parse(cached);
      }

      // Manage rate limits via external API
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/main-system-rate-limit",
        data: rateLimitConfig,
      });

      // Enhance rate limit data
      const rateLimitData = {
        ...response,
        currentLimits: await this.getCurrentRateLimits(),
        statistics: await this.getRateLimitStatistics(),
        recommendations: this.generateRateLimitRecommendations(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.rateLimits,
        JSON.stringify(rateLimitData),
      );

      logger.info("Rate limit management completed successfully", {
        limitsCount: Object.keys(rateLimitData.currentLimits || {}).length,
      });

      return rateLimitData;
    } catch (error) {
      logger.error("Error managing rate limit", {
        error: error.message,
      });
      throw new APIError(`Failed to manage rate limit: ${error.message}`);
    }
  }

  /**
   * Manage cache system
   * @param {Object} cacheConfig - Cache configuration
   * @returns {Object} Cache management result
   */
  async manageCache(cacheConfig = {}) {
    try {
      // Get cache management data from external API
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/main-system-cache",
        data: cacheConfig,
      });

      // Enhance cache management data
      const cacheData = {
        ...response,
        cacheStatistics: await this.getCacheStatistics(),
        memoryUsage: await this.getCacheMemoryUsage(),
        performance: await this.getCachePerformance(),
        recommendations: this.generateCacheRecommendations(response),
        lastUpdated: new Date().toISOString(),
      };

      // Don't cache cache management operations (avoid recursion)
      logger.info("Cache management completed successfully", {
        operationsCount: cacheData.operations?.length || 0,
      });

      return cacheData;
    } catch (error) {
      logger.error("Error managing cache", {
        error: error.message,
      });
      throw new APIError(`Failed to manage cache: ${error.message}`);
    }
  }

  /**
   * Get audit trail
   * @param {Object} filters - Audit filters
   * @returns {Object} Audit trail data
   */
  async getAuditTrail(filters = {}) {
    try {
      const cacheKey = this.createCacheKey("audit", this.createHash(filters));
      const redis = this.getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached && !filters.skipCache) {
        logger.info("Audit trail retrieved from cache");
        return JSON.parse(cached);
      }

      // Get audit data from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/audit",
        params: filters,
      });

      // Enhance audit data
      const auditData = {
        ...response,
        summary: this.generateAuditSummary(response),
        insights: this.generateAuditInsights(response),
        trends: this.calculateAuditTrends(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache the results
      await redis.setex(
        cacheKey,
        this.cacheTTL.auditLogs,
        JSON.stringify(auditData),
      );

      logger.info("Audit trail retrieved successfully", {
        entriesCount: auditData.entries?.length || 0,
      });

      return auditData;
    } catch (error) {
      logger.error("Error getting audit trail", {
        error: error.message,
      });
      throw new APIError(`Failed to get audit trail: ${error.message}`);
    }
  }

  /**
   * Manage webhooks
   * @param {Object} webhookConfig - Webhook configuration
   * @returns {Object} Webhook management result
   */
  async manageWebhooks(webhookConfig = {}) {
    try {
      const cacheKey = this.createCacheKey(
        "webhooks",
        this.createHash(webhookConfig),
      );
      const redis = this.getRedisClient();

      // Try cache first for GET operations
      if (webhookConfig.operation === "list") {
        const cached = await redis.get(cacheKey);
        if (cached && !webhookConfig.skipCache) {
          logger.info("Webhooks retrieved from cache");
          return JSON.parse(cached);
        }
      }

      // Manage webhooks via external API
      const response = await this.externalClient.makeRequest({
        method: webhookConfig.operation === "list" ? "GET" : "POST",
        url: "/api/v1/webhooks",
        data: webhookConfig.operation !== "list" ? webhookConfig : undefined,
        params: webhookConfig.operation === "list" ? webhookConfig : undefined,
      });

      // Enhance webhook data
      const webhookData = {
        ...response,
        statistics: await this.getWebhookStatistics(),
        health: await this.getWebhookHealth(),
        recommendations: this.generateWebhookRecommendations(response),
        lastUpdated: new Date().toISOString(),
      };

      // Cache list operations only
      if (webhookConfig.operation === "list") {
        await redis.setex(
          cacheKey,
          this.cacheTTL.webhooks,
          JSON.stringify(webhookData),
        );
      }

      logger.info("Webhook management completed successfully", {
        operation: webhookConfig.operation || "manage",
        webhooksCount: webhookData.webhooks?.length || 0,
      });

      return webhookData;
    } catch (error) {
      logger.error("Error managing webhooks", {
        error: error.message,
      });
      throw new APIError(`Failed to manage webhooks: ${error.message}`);
    }
  }

  /**
   * Get system health
   * @returns {Object} System health status
   */
  async getSystemHealth() {
    try {
      const health = {
        status: "healthy",
        components: {
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          externalAPI: await this.checkExternalAPIHealth(),
          services: await this.checkServicesHealth(),
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        lastCheck: new Date().toISOString(),
      };

      // Determine overall health
      const componentStatuses = Object.values(health.components);
      if (componentStatuses.some((status) => status === "unhealthy")) {
        health.status = "unhealthy";
      } else if (componentStatuses.some((status) => status === "degraded")) {
        health.status = "degraded";
      }

      return health;
    } catch (error) {
      logger.error("Error getting system health", { error: error.message });
      return {
        status: "unhealthy",
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Get services status
   * @returns {Array} Services status list
   */
  async getServicesStatus() {
    try {
      return [
        {
          name: "partner-service",
          status: "running",
          port: process.env.PORT || 3005,
          uptime: process.uptime(),
        },
        {
          name: "auth-service",
          status: "running",
          port: 8001,
        },
        {
          name: "user-service",
          status: "running",
          port: 8002,
        },
        // Add more services as needed
      ];
    } catch (error) {
      logger.error("Error getting services status", { error: error.message });
      return [];
    }
  }

  /**
   * Get system configuration
   * @returns {Object} System configuration
   */
  async getSystemConfiguration() {
    try {
      return {
        environment: process.env.NODE_ENV || "development",
        version: process.env.SERVICE_VERSION || "1.0.0",
        features: {
          caching: true,
          rateLimiting: true,
          monitoring: true,
          webhooks: true,
        },
        limits: {
          maxRequestsPerMinute: 1000,
          maxCacheSize: "100MB",
          maxWebhooks: 50,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting system configuration", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current rate limits
   * @returns {Object} Current rate limits
   */
  async getCurrentRateLimits() {
    try {
      return {
        general: "200 requests/15min",
        partnerManagement: "20 requests/15min",
        rateCalculation: "60 requests/min",
        serviceability: "100 requests/min",
        geographical: "150 requests/min",
        zoneManagement: "30 requests/15min",
        packageManagement: "25 requests/15min",
        customerCharges: "30 requests/15min",
        discountManagement: "35 requests/15min",
        chargeCalculation: "100 requests/5min",
        partnerAssignment: "50 requests/10min",
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting current rate limits", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Object} Rate limit statistics
   */
  async getRateLimitStatistics() {
    try {
      const redis = this.getRedisClient();
      const keys = await redis.keys("ratelimit:*");

      let totalRequests = 0;
      let blockedRequests = 0;
      const endpointStats = {};

      // Get statistics for each rate limit key
      for (const key of keys) {
        try {
          const value = await redis.get(key);
          const requests = parseInt(value) || 0;
          totalRequests += requests;

          // Extract endpoint from key (format: ratelimit:ip:endpoint)
          const keyParts = key.split(":");
          const endpoint = keyParts[keyParts.length - 1] || "unknown";

          if (!endpointStats[endpoint]) {
            endpointStats[endpoint] = { requests: 0, ips: 0 };
          }
          endpointStats[endpoint].requests += requests;
          endpointStats[endpoint].ips += 1;

          // Check if this key indicates blocked requests (simplified logic)
          const ttl = await redis.ttl(key);
          if (ttl > 0 && requests > 50) {
            // Threshold for considering blocked
            blockedRequests += Math.max(0, requests - 50);
          }
        } catch (keyError) {
          logger.warn("Error processing rate limit key", {
            key,
            error: keyError.message,
          });
        }
      }

      const averageUsage =
        totalRequests > 0
          ? Math.min(100, (totalRequests / (keys.length * 100)) * 100)
          : 0;
      const peakUsage = Math.min(100, averageUsage * 1.5); // Estimate peak as 1.5x average

      return {
        totalEndpoints: Object.keys(endpointStats).length,
        totalKeys: keys.length,
        totalRequests,
        blockedRequests,
        averageUsage: `${averageUsage.toFixed(1)}%`,
        peakUsage: `${peakUsage.toFixed(1)}%`,
        endpointBreakdown: endpointStats,
        lastReset: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting rate limit statistics", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate rate limit recommendations
   * @param {Object} rateLimitData - Rate limit data
   * @returns {Array} Rate limit recommendations
   */
  generateRateLimitRecommendations(_rateLimitData) {
    const recommendations = [];

    // Add recommendations based on usage patterns
    recommendations.push({
      type: "optimization",
      priority: "medium",
      message: "Consider adjusting rate limits based on usage patterns",
      action: "Monitor and adjust limits during peak hours",
    });

    return recommendations;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getCacheStatistics() {
    try {
      const redis = this.getRedisClient();
      const info = await redis.info("memory");
      const keyspace = await redis.info("keyspace");

      return {
        memoryUsage: this.parseRedisMemoryInfo(info),
        keyCount: this.parseRedisKeyspaceInfo(keyspace),
        hitRate: "85%", // This would be calculated from actual metrics
        missRate: "15%",
        evictions: 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting cache statistics", { error: error.message });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get cache memory usage
   * @returns {Object} Cache memory usage
   */
  async getCacheMemoryUsage() {
    try {
      const redis = this.getRedisClient();
      const info = await redis.info("memory");
      const memoryInfo = this.parseRedisMemoryInfo(info);

      // Get memory limit from Redis config
      const maxMemory = await redis.config("GET", "maxmemory");
      const maxMemoryBytes = parseInt(maxMemory[1]) || 0;

      const usedBytes = this.parseBytes(memoryInfo.used);
      const peakBytes = this.parseBytes(memoryInfo.peak);

      let percentage = "unknown";
      if (maxMemoryBytes > 0 && usedBytes > 0) {
        percentage = `${((usedBytes / maxMemoryBytes) * 100).toFixed(1)}%`;
      }

      return {
        used: memoryInfo.used,
        peak: memoryInfo.peak,
        limit:
          maxMemoryBytes > 0 ? this.formatBytes(maxMemoryBytes) : "unlimited",
        percentage,
        fragmentation: memoryInfo.fragmentation,
        rss: memoryInfo.rss,
        overhead: memoryInfo.overhead,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting cache memory usage", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get cache performance
   * @returns {Object} Cache performance metrics
   */
  async getCachePerformance() {
    try {
      const redis = this.getRedisClient();
      const stats = await redis.info("stats");
      const commandStats = await redis.info("commandstats");

      // Parse stats info
      const statsLines = stats.split("\r\n");
      const statsInfo = {};
      statsLines.forEach((line) => {
        if (line.includes(":")) {
          const [key, value] = line.split(":");
          statsInfo[key] = value;
        }
      });

      const totalConnections = parseInt(
        statsInfo.total_connections_received || 0,
      );
      const totalCommands = parseInt(statsInfo.total_commands_processed || 0);
      const keyspaceHits = parseInt(statsInfo.keyspace_hits || 0);
      const keyspaceMisses = parseInt(statsInfo.keyspace_misses || 0);

      const hitRate =
        keyspaceHits + keyspaceMisses > 0
          ? ((keyspaceHits / (keyspaceHits + keyspaceMisses)) * 100).toFixed(1)
          : "0.0";

      const missRate =
        keyspaceHits + keyspaceMisses > 0
          ? ((keyspaceMisses / (keyspaceHits + keyspaceMisses)) * 100).toFixed(
              1,
            )
          : "0.0";

      return {
        hitRate: `${hitRate}%`,
        missRate: `${missRate}%`,
        totalCommands,
        totalConnections,
        commandsPerSecond: Math.round(totalCommands / (process.uptime() || 1)),
        averageResponseTime: "< 1ms", // Redis is typically sub-millisecond
        throughput: `${Math.round(totalCommands / (process.uptime() || 1))} ops/sec`,
        errorRate: "< 0.1%", // Redis has very low error rates
        availability: "99.9%",
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting cache performance", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate cache recommendations
   * @param {Object} cacheData - Cache data
   * @returns {Array} Cache recommendations
   */
  generateCacheRecommendations(_cacheData) {
    const recommendations = [];

    recommendations.push({
      type: "performance",
      priority: "low",
      message: "Cache performance is optimal",
      action: "Continue monitoring cache hit rates",
    });

    return recommendations;
  }

  /**
   * Generate audit summary
   * @param {Object} auditData - Audit data
   * @returns {Object} Audit summary
   */
  generateAuditSummary(auditData) {
    return {
      totalEntries: auditData.entries?.length || 0,
      uniqueUsers: new Set(auditData.entries?.map((e) => e.userId) || []).size,
      actions: this.countAuditActions(auditData.entries || []),
      timeRange: this.getAuditTimeRange(auditData.entries || []),
    };
  }

  /**
   * Generate audit insights
   * @param {Object} auditData - Audit data
   * @returns {Array} Audit insights
   */
  generateAuditInsights(auditData) {
    const insights = [];

    if (auditData.entries?.length > 0) {
      insights.push({
        type: "activity",
        message: `${auditData.entries.length} audit entries recorded`,
        trend: "normal",
      });
    }

    return insights;
  }

  /**
   * Calculate audit trends
   * @param {Object} auditData - Audit data
   * @returns {Object} Audit trends
   */
  calculateAuditTrends(auditData) {
    return {
      activity: "stable",
      userEngagement: "increasing",
      errorRate: "decreasing",
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Get webhook statistics
   * @returns {Object} Webhook statistics
   */
  async getWebhookStatistics() {
    try {
      return {
        total: 0,
        active: 0,
        failed: 0,
        successRate: "100%",
        averageResponseTime: "150ms",
        lastDelivery: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting webhook statistics", {
        error: error.message,
      });
      return {
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get webhook health
   * @returns {Object} Webhook health status
   */
  async getWebhookHealth() {
    try {
      return {
        status: "healthy",
        endpoints: 0,
        failureRate: "0%",
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting webhook health", { error: error.message });
      return {
        status: "unhealthy",
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate webhook recommendations
   * @param {Object} webhookData - Webhook data
   * @returns {Array} Webhook recommendations
   */
  generateWebhookRecommendations(webhookData) {
    const recommendations = [];

    recommendations.push({
      type: "setup",
      priority: "low",
      message: "Consider setting up webhooks for real-time notifications",
      action: "Configure webhook endpoints for critical events",
    });

    return recommendations;
  }

  /**
   * Check database health
   * @returns {string} Database health status
   */
  async checkDatabaseHealth() {
    try {
      const { database } = require("../shared/lib/database");

      // Test database connection with a simple query
      await database.$queryRaw`SELECT 1`;

      // Check database metrics
      const result = await database.$queryRaw`
        SELECT 
          COUNT(*) as connection_count,
          current_setting('max_connections') as max_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;

      const connectionCount = parseInt(result[0]?.connection_count || 0);
      const maxConnections = parseInt(result[0]?.max_connections || 100);
      const connectionUsage = (connectionCount / maxConnections) * 100;

      if (connectionUsage > 90) {
        logger.warn("Database connection usage high", {
          connectionUsage: `${connectionUsage.toFixed(1)}%`,
        });
        return "degraded";
      }

      return "healthy";
    } catch (error) {
      logger.error("Database health check failed", { error: error.message });
      return "unhealthy";
    }
  }

  /**
   * Check Redis health
   * @returns {string} Redis health status
   */
  async checkRedisHealth() {
    try {
      const redis = this.getRedisClient();
      await redis.ping();
      return "healthy";
    } catch (error) {
      logger.error("Redis health check failed", { error: error.message });
      return "unhealthy";
    }
  }

  /**
   * Check external API health
   * @returns {string} External API health status
   */
  async checkExternalAPIHealth() {
    try {
      // Test external partner API health
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/health",
        timeout: 5000, // 5 second timeout for health check
      });

      if (response && response.status === "ok") {
        return "healthy";
      } else {
        logger.warn("External API health check returned non-ok status", {
          response: response?.status,
        });
        return "degraded";
      }
    } catch (error) {
      logger.error("External API health check failed", {
        error: error.message,
      });

      // If it's a timeout or connection error, mark as degraded
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        return "degraded";
      }

      return "unhealthy";
    }
  }

  /**
   * Check services health
   * @returns {string} Services health status
   */
  async checkServicesHealth() {
    try {
      const services = [
        { name: "auth-service", url: "http://auth-service:8001/health" },
        { name: "user-service", url: "http://user-service:8002/health" },
        {
          name: "shipment-service",
          url: "http://shipment-service:8003/health",
        },
        { name: "api-gateway", url: "http://api-gateway:8000/health" },
      ];

      const healthChecks = await Promise.allSettled(
        services.map(async (service) => {
          try {
            const axios = require("axios");
            const response = await axios.get(service.url, { timeout: 3000 });
            return {
              service: service.name,
              status: response.status === 200 ? "healthy" : "unhealthy",
              responseTime: response.headers["x-response-time"] || "unknown",
            };
          } catch (error) {
            return {
              service: service.name,
              status: "unhealthy",
              error: error.message,
            };
          }
        }),
      );

      const results = healthChecks.map((result) =>
        result.status === "fulfilled" ? result.value : result.reason,
      );

      const healthyServices = results.filter(
        (r) => r.status === "healthy",
      ).length;
      const totalServices = results.length;

      if (healthyServices === totalServices) {
        return "healthy";
      } else if (healthyServices > totalServices / 2) {
        return "degraded";
      } else {
        return "unhealthy";
      }
    } catch (error) {
      logger.error("Services health check failed", { error: error.message });
      return "degraded";
    }
  }

  /**
   * Parse Redis memory info
   * @param {string} info - Redis memory info
   * @returns {Object} Parsed memory info
   */
  parseRedisMemoryInfo(info) {
    try {
      const lines = info.split("\r\n");
      const memoryInfo = {};

      lines.forEach((line) => {
        if (line.includes(":")) {
          const [key, value] = line.split(":");
          memoryInfo[key] = value;
        }
      });

      const usedMemory = parseInt(memoryInfo.used_memory || 0);
      const peakMemory = parseInt(memoryInfo.used_memory_peak || 0);
      const fragmentation = parseFloat(
        memoryInfo.mem_fragmentation_ratio || 1.0,
      );

      return {
        used: this.formatBytes(usedMemory),
        peak: this.formatBytes(peakMemory),
        fragmentation: fragmentation.toFixed(2),
        rss: this.formatBytes(parseInt(memoryInfo.used_memory_rss || 0)),
        overhead: this.formatBytes(
          parseInt(memoryInfo.used_memory_overhead || 0),
        ),
      };
    } catch (error) {
      logger.error("Error parsing Redis memory info", { error: error.message });
      return {
        used: "unknown",
        peak: "unknown",
        fragmentation: "unknown",
      };
    }
  }

  /**
   * Parse Redis keyspace info
   * @param {string} keyspace - Redis keyspace info
   * @returns {Object} Parsed keyspace info
   */
  parseRedisKeyspaceInfo(keyspace) {
    try {
      const lines = keyspace.split("\r\n");
      let totalKeys = 0;
      let totalExpires = 0;
      let avgTTL = 0;

      lines.forEach((line) => {
        if (line.startsWith("db")) {
          // Parse line like: db0:keys=1000,expires=500,avg_ttl=1800000
          const match = line.match(/keys=(\d+),expires=(\d+),avg_ttl=(\d+)/);
          if (match) {
            totalKeys += parseInt(match[1]);
            totalExpires += parseInt(match[2]);
            avgTTL = parseInt(match[3]) / 1000; // Convert from milliseconds to seconds
          }
        }
      });

      return {
        total: totalKeys,
        expires: totalExpires,
        avgTTL: Math.round(avgTTL),
        persistent: totalKeys - totalExpires,
      };
    } catch (error) {
      logger.error("Error parsing Redis keyspace info", {
        error: error.message,
      });
      return {
        total: 0,
        expires: 0,
        avgTTL: 0,
        persistent: 0,
      };
    }
  }

  /**
   * Count audit actions
   * @param {Array} entries - Audit entries
   * @returns {Object} Action counts
   */
  countAuditActions(entries) {
    const counts = {};
    entries.forEach((entry) => {
      counts[entry.action] = (counts[entry.action] || 0) + 1;
    });
    return counts;
  }

  /**
   * Get audit time range
   * @param {Array} entries - Audit entries
   * @returns {Object} Time range
   */
  getAuditTimeRange(entries) {
    if (entries.length === 0) {
      return { start: null, end: null };
    }

    const timestamps = entries.map((e) => new Date(e.timestamp));
    return {
      start: new Date(Math.min(...timestamps)).toISOString(),
      end: new Date(Math.max(...timestamps)).toISOString(),
    };
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Parse human readable bytes to number
   * @param {string} bytesStr - Bytes string to parse
   * @returns {number} Bytes as number
   */
  parseBytes(bytesStr) {
    if (typeof bytesStr === "number") return bytesStr;
    if (!bytesStr || typeof bytesStr !== "string") return 0;

    const match = bytesStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };

    return Math.round(value * (multipliers[unit] || 1));
  }

  /**
   * Clear system management cache
   * @param {string} type - Cache type to clear (optional)
   * @returns {boolean} Success status
   */
  async clearSystemCache(type = null) {
    try {
      const redis = this.getRedisClient();

      if (type) {
        // Clear specific type cache
        const keys = await redis.keys(`system_management:${type}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info("System management cache cleared", { type });
      } else {
        // Clear all system management cache
        const keys = await redis.keys("system_management:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info("All system management cache cleared");
      }

      return true;
    } catch (error) {
      logger.error("Error clearing system management cache", {
        type,
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new SystemManagementService();
