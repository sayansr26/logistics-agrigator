const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const APIResponse = require("../shared/lib/response");
const { ValidationError, APIError } = require("../shared/lib/errors");
const ExternalPartnerClient = require("./externalPartnerClient");

/**
 * Comprehensive Partner Assignment Service
 *
 * Handles:
 * - Partner availability checking
 * - Shipment assignment algorithms
 * - Assignment workflow management
 * - Performance tracking and analytics
 */
class PartnerAssignmentService {
  constructor() {
    this.redis = getRedisClient();
    this.externalClient = new ExternalPartnerClient();
    this.cacheTTL = {
      availability: 300, // 5 minutes
      assignment: 600, // 10 minutes
      workflow: 1800, // 30 minutes
    };

    // Assignment strategies
    this.assignmentStrategies = {
      BEST_MATCH: "best_match",
      COST_OPTIMIZED: "cost_optimized",
      TIME_OPTIMIZED: "time_optimized",
      RELIABILITY_FOCUSED: "reliability_focused",
      BALANCED: "balanced",
    };
  }

  /**
   * Check partner availability for shipment
   * @param {Object} availabilityData - Availability check parameters
   * @returns {Object} Partner availability results
   */
  async checkPartnerAvailability(availabilityData) {
    try {
      // Validate input data
      this.validateAvailabilityData(availabilityData);

      // Create cache key
      const cacheKey = `partner_availability:${this.createAvailabilityHash(availabilityData)}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Partner availability cache hit", { cacheKey });
        return JSON.parse(cached);
      }

      // Call external API for availability check
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/partners/availability/check",
        data: availabilityData,
      });

      // Process and enhance the response
      const processedResult = this.processAvailabilityResponse(
        response,
        availabilityData,
      );

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.availability,
        JSON.stringify(processedResult),
      );

      logger.info("Partner availability check completed", {
        availablePartners: processedResult.availablePartners?.length || 0,
        totalPartnersChecked: processedResult.totalPartnersChecked || 0,
      });

      return processedResult;
    } catch (error) {
      logger.error("Partner availability check failed", {
        error: error.message,
        availabilityData,
      });
      throw new APIError(`Partner availability check failed: ${error.message}`);
    }
  }

  /**
   * Assign shipment to optimal partner
   * @param {Object} assignmentData - Assignment parameters
   * @returns {Object} Assignment results
   */
  async assignShipment(assignmentData) {
    try {
      // Validate assignment data
      this.validateAssignmentData(assignmentData);

      // Create cache key
      const cacheKey = `shipment_assignment:${this.createAssignmentHash(assignmentData)}`;

      // Try cache first (shorter TTL for assignments)
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Shipment assignment cache hit", { cacheKey });
        return JSON.parse(cached);
      }

      // Call external API for shipment assignment
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/shipment-assignment/assign",
        data: assignmentData,
      });

      // Process and enhance the response
      const processedResult = this.processAssignmentResponse(
        response,
        assignmentData,
      );

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.assignment,
        JSON.stringify(processedResult),
      );

      // Track assignment metrics
      await this.trackAssignmentMetrics(processedResult);

      logger.info("Shipment assignment completed", {
        shipmentId: assignmentData.shipmentDetails?.shipmentId,
        assignedPartner: processedResult.assignedPartner?.partnerId,
        strategy: assignmentData.assignmentPreferences?.assignmentStrategy,
      });

      return processedResult;
    } catch (error) {
      logger.error("Shipment assignment failed", {
        shipmentId: assignmentData.shipmentDetails?.shipmentId,
        error: error.message,
        assignmentData,
      });
      throw new APIError(`Shipment assignment failed: ${error.message}`);
    }
  }

  /**
   * Execute partner assignment workflow
   * @param {Object} workflowData - Workflow parameters
   * @returns {Object} Workflow execution results
   */
  async executeAssignmentWorkflow(workflowData) {
    try {
      // Validate workflow data
      this.validateWorkflowData(workflowData);

      const workflowId = `WF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info("Starting assignment workflow", {
        workflowId,
        shipmentCount: workflowData.shipments?.length || 1,
        strategy: workflowData.strategy,
      });

      // Initialize workflow state
      const workflowState = {
        workflowId,
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
        totalShipments: workflowData.shipments?.length || 1,
        processedShipments: 0,
        successfulAssignments: 0,
        failedAssignments: 0,
        assignments: [],
        errors: [],
      };

      // Process shipments based on strategy
      if (workflowData.shipments && Array.isArray(workflowData.shipments)) {
        // Bulk assignment workflow
        await this.processBulkAssignments(workflowData, workflowState);
      } else {
        // Single shipment workflow
        await this.processSingleAssignment(workflowData, workflowState);
      }

      // Finalize workflow
      workflowState.status =
        workflowState.failedAssignments > 0
          ? "COMPLETED_WITH_ERRORS"
          : "COMPLETED";
      workflowState.completedAt = new Date().toISOString();
      workflowState.duration =
        new Date(workflowState.completedAt) - new Date(workflowState.startedAt);

      // Cache workflow results
      const cacheKey = `assignment_workflow:${workflowId}`;
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.workflow,
        JSON.stringify(workflowState),
      );

      logger.info("Assignment workflow completed", {
        workflowId,
        status: workflowState.status,
        successRate:
          (workflowState.successfulAssignments / workflowState.totalShipments) *
          100,
        duration: workflowState.duration,
      });

      return workflowState;
    } catch (error) {
      logger.error("Assignment workflow failed", {
        error: error.message,
        workflowData,
      });
      throw new APIError(`Assignment workflow failed: ${error.message}`);
    }
  }

  /**
   * Get assignment performance analytics
   * @param {Object} analyticsParams - Analytics parameters
   * @returns {Object} Performance analytics
   */
  async getAssignmentAnalytics(analyticsParams = {}) {
    try {
      const cacheKey = `assignment_analytics:${this.createAnalyticsHash(analyticsParams)}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Assignment analytics cache hit", { cacheKey });
        return JSON.parse(cached);
      }

      // Generate analytics
      const analytics = await this.generateAssignmentAnalytics(analyticsParams);

      // Cache analytics
      await this.redis.setex(cacheKey, 1800, JSON.stringify(analytics)); // 30 minutes

      return analytics;
    } catch (error) {
      logger.error("Failed to get assignment analytics", {
        error: error.message,
        analyticsParams,
      });
      throw new APIError(
        `Failed to get assignment analytics: ${error.message}`,
      );
    }
  }

  /**
   * Get assignment strategy recommendations
   * @param {Object} shipmentData - Shipment data for analysis
   * @returns {Object} Strategy recommendations
   */
  async getStrategyRecommendations(shipmentData) {
    try {
      // Analyze shipment characteristics
      const analysis = this.analyzeShipmentCharacteristics(shipmentData);

      // Generate strategy recommendations
      const recommendations = {
        primaryStrategy: this.determinePrimaryStrategy(analysis),
        alternativeStrategies: this.getAlternativeStrategies(analysis),
        reasoning: this.generateStrategyReasoning(analysis),
        confidenceScore: this.calculateConfidenceScore(analysis),
      };

      logger.info("Strategy recommendations generated", {
        shipmentId: shipmentData.shipmentId,
        primaryStrategy: recommendations.primaryStrategy,
        confidenceScore: recommendations.confidenceScore,
      });

      return recommendations;
    } catch (error) {
      logger.error("Failed to generate strategy recommendations", {
        shipmentId: shipmentData.shipmentId,
        error: error.message,
      });
      throw new APIError(
        `Failed to generate strategy recommendations: ${error.message}`,
      );
    }
  }

  // Private helper methods

  /**
   * Validate availability data
   */
  validateAvailabilityData(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Invalid availability data");
    }

    if (!data.shipmentDetails) {
      throw new ValidationError("Shipment details are required");
    }

    const shipment = data.shipmentDetails;
    const required = ["fromPincode", "toPincode", "weight"];

    for (const field of required) {
      if (!shipment[field]) {
        throw new ValidationError(
          `Missing required field: shipmentDetails.${field}`,
        );
      }
    }

    // Validate pincode format
    const pincodeRegex = /^\d{6}$/;
    if (
      !pincodeRegex.test(shipment.fromPincode) ||
      !pincodeRegex.test(shipment.toPincode)
    ) {
      throw new ValidationError("Invalid pincode format");
    }
  }

  /**
   * Validate assignment data
   */
  validateAssignmentData(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Invalid assignment data");
    }

    if (!data.shipmentDetails) {
      throw new ValidationError("Shipment details are required");
    }

    // Validate assignment preferences
    if (data.assignmentPreferences?.assignmentStrategy) {
      const validStrategies = Object.values(this.assignmentStrategies);
      if (
        !validStrategies.includes(data.assignmentPreferences.assignmentStrategy)
      ) {
        throw new ValidationError(
          `Invalid assignment strategy. Valid options: ${validStrategies.join(", ")}`,
        );
      }
    }
  }

  /**
   * Validate workflow data
   */
  validateWorkflowData(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Invalid workflow data");
    }

    if (!data.shipments && !data.shipmentDetails) {
      throw new ValidationError(
        "Either shipments array or shipmentDetails is required",
      );
    }

    if (data.shipments && !Array.isArray(data.shipments)) {
      throw new ValidationError("Shipments must be an array");
    }
  }

  /**
   * Process availability response from external API
   */
  processAvailabilityResponse(response, originalData) {
    return {
      checkId: `AC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      availablePartners: response.availablePartners || [],
      unavailablePartners: response.unavailablePartners || [],
      totalPartnersChecked: response.totalPartnersChecked || 0,
      availabilityScore: this.calculateAvailabilityScore(response),
      checkMetadata: {
        checkedAt: new Date().toISOString(),
        inputData: originalData,
        checkCriteria: response.checkCriteria || {},
        validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      },
      recommendations: this.generateAvailabilityRecommendations(response),
    };
  }

  /**
   * Process assignment response from external API
   */
  processAssignmentResponse(response, originalData) {
    return {
      assignmentId: `SA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      assignedPartner: response.assignedPartner || null,
      alternativePartners: response.alternativePartners || [],
      assignmentScore: response.assignmentScore || 0,
      assignmentReason:
        response.assignmentReason || "Best match based on criteria",
      estimatedCost: response.estimatedCost || null,
      estimatedDeliveryTime: response.estimatedDeliveryTime || null,
      assignmentMetadata: {
        assignedAt: new Date().toISOString(),
        inputData: originalData,
        strategy:
          originalData.assignmentPreferences?.assignmentStrategy ||
          "BEST_MATCH",
        validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      },
      qualityMetrics: this.calculateAssignmentQuality(response),
    };
  }

  /**
   * Process bulk assignments
   */
  async processBulkAssignments(workflowData, workflowState) {
    const batchSize = workflowData.batchSize || 10;
    const shipments = workflowData.shipments;

    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);

      const batchPromises = batch.map(async (shipment) => {
        try {
          const assignmentData = {
            shipmentDetails: shipment,
            assignmentPreferences: workflowData.assignmentPreferences || {},
            options: workflowData.options || {},
          };

          const assignment = await this.assignShipment(assignmentData);

          workflowState.assignments.push(assignment);
          workflowState.successfulAssignments++;
          workflowState.processedShipments++;

          return assignment;
        } catch (error) {
          workflowState.errors.push({
            shipmentId: shipment.shipmentId,
            error: error.message,
          });
          workflowState.failedAssignments++;
          workflowState.processedShipments++;

          logger.error("Bulk assignment failed for shipment", {
            shipmentId: shipment.shipmentId,
            error: error.message,
          });
        }
      });

      await Promise.allSettled(batchPromises);

      // Update workflow progress
      logger.info("Bulk assignment batch processed", {
        workflowId: workflowState.workflowId,
        batchNumber: Math.floor(i / batchSize) + 1,
        processed: workflowState.processedShipments,
        total: workflowState.totalShipments,
      });
    }
  }

  /**
   * Process single assignment
   */
  async processSingleAssignment(workflowData, workflowState) {
    try {
      const assignment = await this.assignShipment({
        shipmentDetails: workflowData.shipmentDetails,
        assignmentPreferences: workflowData.assignmentPreferences || {},
        options: workflowData.options || {},
      });

      workflowState.assignments.push(assignment);
      workflowState.successfulAssignments++;
      workflowState.processedShipments++;
    } catch (error) {
      workflowState.errors.push({
        shipmentId: workflowData.shipmentDetails?.shipmentId,
        error: error.message,
      });
      workflowState.failedAssignments++;
      workflowState.processedShipments++;
    }
  }

  /**
   * Track assignment metrics
   */
  async trackAssignmentMetrics(assignmentResult) {
    try {
      const metricsKey = `assignment_metrics:${new Date().toISOString().split("T")[0]}`;

      // Increment daily metrics
      await this.redis.hincrby(metricsKey, "total_assignments", 1);

      if (assignmentResult.assignedPartner) {
        await this.redis.hincrby(metricsKey, "successful_assignments", 1);
        await this.redis.hincrby(
          metricsKey,
          `partner_${assignmentResult.assignedPartner.partnerId}`,
          1,
        );
      } else {
        await this.redis.hincrby(metricsKey, "failed_assignments", 1);
      }

      // Set expiry for metrics (30 days)
      await this.redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } catch (error) {
      logger.error("Failed to track assignment metrics", {
        error: error.message,
      });
    }
  }

  /**
   * Generate assignment analytics
   */
  async generateAssignmentAnalytics(params) {
    // This would typically aggregate data from Redis metrics
    return {
      totalAssignments: 0,
      successRate: 0,
      averageAssignmentTime: 0,
      topPartners: [],
      strategyPerformance: {},
      trends: {},
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate availability score
   */
  calculateAvailabilityScore(response) {
    const available = response.availablePartners?.length || 0;
    const total = response.totalPartnersChecked || 1;
    return Math.round((available / total) * 100);
  }

  /**
   * Calculate assignment quality
   */
  calculateAssignmentQuality(response) {
    return {
      costEfficiency: response.assignmentScore || 0,
      timeEfficiency: response.estimatedDeliveryTime
        ? 100 - (response.estimatedDeliveryTime / 24) * 10
        : 0,
      reliabilityScore: response.assignedPartner?.reliabilityScore || 0,
      overallQuality: response.assignmentScore || 0,
    };
  }

  /**
   * Generate availability recommendations
   */
  generateAvailabilityRecommendations(response) {
    const recommendations = [];

    if ((response.availablePartners?.length || 0) < 2) {
      recommendations.push({
        type: "LOW_AVAILABILITY",
        message: "Consider expanding partner network for better coverage",
        priority: "high",
      });
    }

    return recommendations;
  }

  /**
   * Analyze shipment characteristics
   */
  analyzeShipmentCharacteristics(shipmentData) {
    return {
      urgency: shipmentData.urgency || "STANDARD",
      value: shipmentData.declaredValue || 0,
      weight: shipmentData.weight || 0,
      distance: this.calculateDistance(
        shipmentData.fromPincode,
        shipmentData.toPincode,
      ),
      paymentType: shipmentData.paymentType || "PREPAID",
    };
  }

  /**
   * Determine primary strategy
   */
  determinePrimaryStrategy(analysis) {
    if (analysis.urgency === "EXPRESS")
      return this.assignmentStrategies.TIME_OPTIMIZED;
    if (analysis.value > 10000)
      return this.assignmentStrategies.RELIABILITY_FOCUSED;
    if (analysis.weight > 5000) return this.assignmentStrategies.COST_OPTIMIZED;
    return this.assignmentStrategies.BALANCED;
  }

  /**
   * Get alternative strategies
   */
  getAlternativeStrategies(analysis) {
    const all = Object.values(this.assignmentStrategies);
    const primary = this.determinePrimaryStrategy(analysis);
    return all.filter((strategy) => strategy !== primary).slice(0, 2);
  }

  /**
   * Generate strategy reasoning
   */
  generateStrategyReasoning(analysis) {
    const primary = this.determinePrimaryStrategy(analysis);

    const reasoningMap = {
      [this.assignmentStrategies.TIME_OPTIMIZED]:
        "Express delivery requirement detected",
      [this.assignmentStrategies.RELIABILITY_FOCUSED]:
        "High-value shipment requires reliable partner",
      [this.assignmentStrategies.COST_OPTIMIZED]:
        "Heavy shipment benefits from cost optimization",
      [this.assignmentStrategies.BALANCED]:
        "Standard shipment suitable for balanced approach",
    };

    return reasoningMap[primary] || "Default strategy selected";
  }

  /**
   * Calculate confidence score
   */
  calculateConfidenceScore(analysis) {
    let score = 70; // Base confidence

    if (analysis.urgency === "EXPRESS") score += 15;
    if (analysis.value > 5000) score += 10;
    if (analysis.weight > 1000) score += 5;

    return Math.min(100, score);
  }

  /**
   * Calculate distance (simplified)
   */
  calculateDistance(fromPincode, toPincode) {
    // Simplified distance calculation
    // In real implementation, this would use geographical data
    return Math.abs(parseInt(fromPincode) - parseInt(toPincode)) / 1000;
  }

  /**
   * Create hash for availability data
   */
  createAvailabilityHash(data) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  /**
   * Create hash for assignment data
   */
  createAssignmentHash(data) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  /**
   * Create hash for analytics parameters
   */
  createAnalyticsHash(params) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify(params))
      .digest("hex");
  }
}

module.exports = PartnerAssignmentService;
