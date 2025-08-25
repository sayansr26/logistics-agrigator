const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { ValidationError, APIError } = require("../shared/lib/errors");
const PartnerAssignmentService = require("../services/partnerAssignmentService");

// Lazy-load service to avoid Redis initialization issues
let partnerAssignmentService = null;
const getPartnerAssignmentService = () => {
  if (!partnerAssignmentService) {
    partnerAssignmentService = new PartnerAssignmentService();
  }
  return partnerAssignmentService;
};

/**
 * Check partner availability for shipment
 */
async function checkPartnerAvailability(req, res) {
  try {
    const availabilityData = req.body;

    // Add user context for audit logging
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Partner availability check requested", {
      shipmentId: availabilityData.shipmentDetails?.shipmentId,
      userId: auditContext.userId,
      fromPincode: availabilityData.shipmentDetails?.fromPincode,
      toPincode: availabilityData.shipmentDetails?.toPincode,
    });

    // Check partner availability
    const result =
      await getPartnerAssignmentService().checkPartnerAvailability(
        availabilityData,
      );

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Partner availability check completed successfully", {
      checkId: result.checkId,
      availablePartners: result.availablePartners?.length || 0,
      totalPartnersChecked: result.totalPartnersChecked,
      availabilityScore: result.availabilityScore,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(
        result,
        "Partner availability check completed successfully",
      ),
    );
  } catch (error) {
    logger.error("Partner availability check failed", {
      shipmentId: req.body.shipmentDetails?.shipmentId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res
      .status(500)
      .json(APIResponse.error("Partner availability check failed", 500));
  }
}

/**
 * Assign shipment to optimal partner
 */
async function assignShipment(req, res) {
  try {
    const assignmentData = req.body;

    // Add user context for audit logging
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Shipment assignment requested", {
      shipmentId: assignmentData.shipmentDetails?.shipmentId,
      strategy: assignmentData.assignmentPreferences?.assignmentStrategy,
      userId: auditContext.userId,
    });

    // Assign shipment
    const result =
      await getPartnerAssignmentService().assignShipment(assignmentData);

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Shipment assignment completed successfully", {
      assignmentId: result.assignmentId,
      shipmentId: assignmentData.shipmentDetails?.shipmentId,
      assignedPartner: result.assignedPartner?.partnerId,
      assignmentScore: result.assignmentScore,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(result, "Shipment assignment completed successfully"),
    );
  } catch (error) {
    logger.error("Shipment assignment failed", {
      shipmentId: req.body.shipmentDetails?.shipmentId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res.status(500).json(APIResponse.error("Shipment assignment failed", 500));
  }
}

/**
 * Execute partner assignment workflow
 */
async function executeAssignmentWorkflow(req, res) {
  try {
    const workflowData = req.body;

    // Add user context for audit logging
    const auditContext = {
      userId: req.user?.id,
      userRole: req.user?.role,
      clientId: req.user?.clientId,
      ipAddress: req.ip,
    };

    logger.info("Assignment workflow requested", {
      shipmentCount: workflowData.shipments?.length || 1,
      strategy: workflowData.strategy,
      userId: auditContext.userId,
    });

    // Execute workflow
    const result =
      await getPartnerAssignmentService().executeAssignmentWorkflow(
        workflowData,
      );

    // Add audit context to result
    result.auditContext = auditContext;

    logger.info("Assignment workflow completed successfully", {
      workflowId: result.workflowId,
      status: result.status,
      successfulAssignments: result.successfulAssignments,
      failedAssignments: result.failedAssignments,
      successRate: (result.successfulAssignments / result.totalShipments) * 100,
      userId: auditContext.userId,
    });

    res.json(
      APIResponse.success(result, "Assignment workflow completed successfully"),
    );
  } catch (error) {
    logger.error("Assignment workflow failed", {
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res.status(500).json(APIResponse.error("Assignment workflow failed", 500));
  }
}

/**
 * Get assignment performance analytics
 */
async function getAssignmentAnalytics(req, res) {
  try {
    const analyticsParams = {
      timeframe: req.query.timeframe || "24h",
      partnerId: req.query.partnerId,
      strategy: req.query.strategy,
      clientId: req.user?.clientId,
    };

    logger.info("Assignment analytics requested", {
      analyticsParams,
      userId: req.user?.id,
    });

    // Get analytics
    const result =
      await getPartnerAssignmentService().getAssignmentAnalytics(
        analyticsParams,
      );

    logger.info("Assignment analytics retrieved successfully", {
      timeframe: analyticsParams.timeframe,
      totalAssignments: result.totalAssignments,
      successRate: result.successRate,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        result,
        "Assignment analytics retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get assignment analytics", {
      error: error.message,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to get assignment analytics", 500));
  }
}

/**
 * Get assignment strategy recommendations
 */
async function getStrategyRecommendations(req, res) {
  try {
    const shipmentData = req.body;

    logger.info("Strategy recommendations requested", {
      shipmentId: shipmentData.shipmentId,
      userId: req.user?.id,
    });

    // Get strategy recommendations
    const result =
      await getPartnerAssignmentService().getStrategyRecommendations(
        shipmentData,
      );

    logger.info("Strategy recommendations generated successfully", {
      shipmentId: shipmentData.shipmentId,
      primaryStrategy: result.primaryStrategy,
      confidenceScore: result.confidenceScore,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        result,
        "Strategy recommendations generated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to generate strategy recommendations", {
      shipmentId: req.body.shipmentId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to generate strategy recommendations", 500),
      );
  }
}

/**
 * Get assignment workflow status
 */
async function getWorkflowStatus(req, res) {
  try {
    const { workflowId } = req.params;

    if (!workflowId) {
      throw new ValidationError("Workflow ID is required");
    }

    logger.info("Workflow status requested", {
      workflowId,
      userId: req.user?.id,
    });

    // Get workflow status from cache
    const redis = require("../config/redis").getRedisClient();
    const cacheKey = `assignment_workflow:${workflowId}`;
    const workflowData = await redis.get(cacheKey);

    if (!workflowData) {
      return res
        .status(404)
        .json(APIResponse.error("Workflow not found or expired", 404));
    }

    const result = JSON.parse(workflowData);

    logger.info("Workflow status retrieved successfully", {
      workflowId,
      status: result.status,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Workflow status retrieved successfully"),
    );
  } catch (error) {
    logger.error("Failed to get workflow status", {
      workflowId: req.params.workflowId,
      error: error.message,
      userId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      return res.status(400).json(APIResponse.error(error.message, 400));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to get workflow status", 500));
  }
}

/**
 * Get assignment performance metrics
 */
async function getAssignmentMetrics(req, res) {
  try {
    const { timeframe = "24h", partnerId } = req.query;

    logger.info("Assignment metrics requested", {
      timeframe,
      partnerId,
      userId: req.user?.id,
    });

    // Get metrics from Redis
    const redis = require("../config/redis").getRedisClient();
    const metricsKey = `assignment_metrics:${new Date().toISOString().split("T")[0]}`;
    const metrics = await redis.hgetall(metricsKey);

    const result = {
      timeframe,
      partnerId,
      totalAssignments: parseInt(metrics.total_assignments || 0),
      successfulAssignments: parseInt(metrics.successful_assignments || 0),
      failedAssignments: parseInt(metrics.failed_assignments || 0),
      successRate: metrics.total_assignments
        ? (parseInt(metrics.successful_assignments || 0) /
            parseInt(metrics.total_assignments)) *
          100
        : 0,
      partnerDistribution: this.getPartnerDistribution(metrics),
      generatedAt: new Date().toISOString(),
    };

    logger.info("Assignment metrics retrieved successfully", {
      timeframe,
      totalAssignments: result.totalAssignments,
      successRate: result.successRate,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Assignment metrics retrieved successfully"),
    );
  } catch (error) {
    logger.error("Failed to get assignment metrics", {
      error: error.message,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to get assignment metrics", 500));
  }
}

/**
 * Helper function to get partner distribution from metrics
 */
function getPartnerDistribution(metrics) {
  const distribution = {};

  for (const [key, value] of Object.entries(metrics)) {
    if (key.startsWith("partner_")) {
      const partnerId = key.replace("partner_", "");
      distribution[partnerId] = parseInt(value);
    }
  }

  return distribution;
}

module.exports = {
  checkPartnerAvailability,
  assignShipment,
  executeAssignmentWorkflow,
  getAssignmentAnalytics,
  getStrategyRecommendations,
  getWorkflowStatus,
  getAssignmentMetrics,
};
