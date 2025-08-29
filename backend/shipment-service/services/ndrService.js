/**
 * NDR (Non-Delivery Report) Service
 *
 * Handles NDR case management, reattempt scheduling, and RTO workflows
 * Follows established service patterns with comprehensive tracking
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const {
  APIError,
  ValidationError,
  NotFoundError,
} = require("../shared/lib/errors");
const trackingService = require("./trackingService");

class NDRService {
  constructor() {
    // Redis client will be obtained when needed, following auth-service patterns
  }

  /**
   * Create NDR case for failed delivery
   */
  async createNDRCase(shipmentId, ndrData, userId = null) {
    try {
      logger.info("Creating NDR case", {
        service: "shipment-service",
        function: "createNDRCase",
        shipmentId,
        userId,
      });

      // Get shipment details
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          trackingEvents: {
            orderBy: { timestamp: "desc" },
            take: 5,
          },
        },
      });

      if (!shipment) {
        throw new NotFoundError(`Shipment not found: ${shipmentId}`);
      }

      // Validate shipment status for NDR creation
      if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(shipment.status)) {
        throw new ValidationError(
          `Cannot create NDR for shipment with status: ${shipment.status}`,
        );
      }

      const {
        reason = "DELIVERY_FAILED",
        description,
        deliveryAttemptDate,
        customerFeedback = null,
        deliveryPersonNotes = null,
        addressIssue = false,
        customerUnavailable = false,
        reattemptRequested = true,
        preferredReattemptDate = null,
      } = ndrData;

      // Create NDR case record
      const ndrCase = await prisma.nDRCase.create({
        data: {
          shipmentId,
          reason,
          description,
          status: "OPEN",
          priority: this.calculateNDRPriority(reason, shipment.paymentType),
          deliveryAttemptDate: deliveryAttemptDate || new Date(),
          customerFeedback,
          deliveryPersonNotes,
          addressIssue,
          customerUnavailable,
          reattemptRequested,
          preferredReattemptDate,
          createdById: userId,
        },
      });

      // Update shipment status to NDR
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          status: "NDR",
          lastStatusUpdate: new Date(),
        },
      });

      // Create tracking event for NDR
      await trackingService.createTrackingEvent(shipmentId, {
        status: "NDR",
        message: `NDR case created: ${reason}`,
        location: shipment.deliveryCity,
        eventMetadata: {
          ndrCaseId: ndrCase.id,
          reason,
          reattemptRequested,
          addressIssue,
          customerUnavailable,
        },
        source: "MANUAL",
        userId,
      });

      // Schedule automatic reattempt if requested
      if (reattemptRequested) {
        await this.scheduleReattempt(ndrCase.id, preferredReattemptDate);
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          resource: "NDRCase",
          resourceId: ndrCase.id,
          changes: {
            shipmentId,
            reason,
            reattemptRequested,
          },
          ipAddress: "127.0.0.1",
          userAgent: "NDRService",
        },
      });

      logger.info("NDR case created successfully", {
        ndrCaseId: ndrCase.id,
        shipmentId,
        reason,
      });

      return ndrCase;
    } catch (error) {
      logger.error("Create NDR case error", {
        shipmentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get NDR cases with filtering
   */
  async getNDRCases(filters = {}, pagination = {}) {
    try {
      const {
        status,
        reason,
        priority,
        clientId,
        shipmentId,
        dateFrom,
        dateTo,
        reattemptRequested,
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = pagination;

      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {
        AND: [],
      };

      if (status) {
        whereClause.AND.push({ status });
      }

      if (reason) {
        whereClause.AND.push({ reason });
      }

      if (priority) {
        whereClause.AND.push({ priority });
      }

      if (shipmentId) {
        whereClause.AND.push({ shipmentId });
      }

      if (clientId) {
        whereClause.AND.push({
          shipment: {
            clientId,
          },
        });
      }

      if (reattemptRequested !== undefined) {
        whereClause.AND.push({ reattemptRequested });
      }

      if (dateFrom || dateTo) {
        const dateFilter = {};
        if (dateFrom) {
          dateFilter.gte = new Date(dateFrom);
        }
        if (dateTo) {
          dateFilter.lte = new Date(dateTo);
        }
        whereClause.AND.push({
          createdAt: dateFilter,
        });
      }

      // Remove empty AND array if no filters
      if (whereClause.AND.length === 0) {
        delete whereClause.AND;
      }

      const [ndrCases, totalCount] = await Promise.all([
        prisma.nDRCase.findMany({
          where: whereClause,
          include: {
            shipment: {
              select: {
                orderId: true,
                awbNumber: true,
                deliveryName: true,
                deliveryPhone: true,
                deliveryCity: true,
                deliveryState: true,
                deliveryPincode: true,
                partnerName: true,
                paymentType: true,
                totalCost: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: offset,
          take: parseInt(limit),
        }),
        prisma.nDRCase.count({
          where: whereClause,
        }),
      ]);

      return {
        ndrCases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        summary: await this.getNDRSummary(whereClause),
      };
    } catch (error) {
      logger.error("Get NDR cases error", {
        error: error.message,
        filters,
      });
      throw new APIError(
        `Failed to retrieve NDR cases: ${error.message}`,
        500,
        "NDR_RETRIEVAL_ERROR",
      );
    }
  }

  /**
   * Take action on NDR case
   */
  async takeNDRAction(ndrCaseId, actionData, userId) {
    try {
      logger.info("Taking NDR action", {
        ndrCaseId,
        action: actionData.action,
        userId,
      });

      const ndrCase = await prisma.nDRCase.findUnique({
        where: { id: ndrCaseId },
        include: {
          shipment: true,
        },
      });

      if (!ndrCase) {
        throw new NotFoundError(`NDR case not found: ${ndrCaseId}`);
      }

      const {
        action,
        notes,
        newAddress = null,
        reattemptDate = null,
      } = actionData;

      let updatedNDRCase;
      let shipmentUpdate = {};
      let trackingMessage;

      switch (action) {
        case "SCHEDULE_REATTEMPT":
          updatedNDRCase = await this.scheduleReattempt(
            ndrCaseId,
            reattemptDate,
            notes,
            userId,
          );
          trackingMessage = `Reattempt scheduled for ${reattemptDate || "next available slot"}`;
          break;

        case "UPDATE_ADDRESS":
          if (!newAddress) {
            throw new ValidationError(
              "New address is required for address update",
            );
          }
          updatedNDRCase = await this.updateDeliveryAddress(
            ndrCaseId,
            newAddress,
            notes,
            userId,
          );
          trackingMessage = "Delivery address updated";
          break;

        case "INITIATE_RTO":
          updatedNDRCase = await this.initiateRTO(ndrCaseId, notes, userId);
          shipmentUpdate = {
            status: "RTO",
            lastStatusUpdate: new Date(),
          };
          trackingMessage = "Return to Origin initiated";
          break;

        case "CLOSE_RESOLVED":
          updatedNDRCase = await prisma.nDRCase.update({
            where: { id: ndrCaseId },
            data: {
              status: "RESOLVED",
              resolution: notes,
              resolvedAt: new Date(),
              resolvedById: userId,
            },
          });
          trackingMessage = "NDR case resolved";
          break;

        case "ASSIGN_AGENT": {
          const { assignedToId } = actionData;
          if (!assignedToId) {
            throw new ValidationError("Agent ID is required for assignment");
          }
          updatedNDRCase = await prisma.nDRCase.update({
            where: { id: ndrCaseId },
            data: {
              assignedToId,
              assignedAt: new Date(),
            },
          });
          trackingMessage = `NDR case assigned to agent`;
          break;
        }

        default:
          throw new ValidationError(`Invalid NDR action: ${action}`);
      }

      // Update shipment if needed
      if (Object.keys(shipmentUpdate).length > 0) {
        await prisma.shipment.update({
          where: { id: ndrCase.shipmentId },
          data: shipmentUpdate,
        });
      }

      // Create tracking event
      await trackingService.createTrackingEvent(ndrCase.shipmentId, {
        status: shipmentUpdate.status || ndrCase.shipment.status,
        message: trackingMessage,
        location: ndrCase.shipment.deliveryCity,
        eventMetadata: {
          ndrCaseId,
          action,
          actionBy: userId,
          notes,
        },
        source: "MANUAL",
        userId,
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "NDR_ACTION",
          resource: "NDRCase",
          resourceId: ndrCaseId,
          changes: {
            action,
            notes,
            previousStatus: ndrCase.status,
            newStatus: updatedNDRCase.status,
          },
          ipAddress: "127.0.0.1",
          userAgent: "NDRService",
        },
      });

      return updatedNDRCase;
    } catch (error) {
      logger.error("Take NDR action error", {
        ndrCaseId,
        action: actionData.action,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule delivery reattempt
   */
  async scheduleReattempt(
    ndrCaseId,
    preferredDate = null,
    notes = null,
    userId = null,
  ) {
    try {
      // Calculate next reattempt date if not provided
      const reattemptDate = preferredDate || this.calculateNextReattemptDate();

      const updatedNDRCase = await prisma.nDRCase.update({
        where: { id: ndrCaseId },
        data: {
          status: "REATTEMPT_SCHEDULED",
          reattemptDate: new Date(reattemptDate),
          reattemptNotes: notes,
          reattemptScheduledById: userId,
          reattemptScheduledAt: new Date(),
        },
      });

      // Cache reattempt schedule in Redis for quick lookup
      try {
        const redisClient = getRedisClient();
        await redisClient.setex(
          `reattempt:${ndrCaseId}`,
          86400 * 7, // 7 days TTL
          JSON.stringify({
            ndrCaseId,
            shipmentId: updatedNDRCase.shipmentId,
            reattemptDate,
            scheduledAt: new Date().toISOString(),
          }),
        );
      } catch (redisError) {
        logger.warn("Redis caching failed", { error: redisError.message });
      }

      return updatedNDRCase;
    } catch (error) {
      logger.error("Schedule reattempt error", {
        ndrCaseId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update delivery address for NDR case
   */
  async updateDeliveryAddress(
    ndrCaseId,
    newAddress,
    notes = null,
    userId = null,
  ) {
    try {
      const ndrCase = await prisma.nDRCase.findUnique({
        where: { id: ndrCaseId },
        include: { shipment: true },
      });

      if (!ndrCase) {
        throw new NotFoundError(`NDR case not found: ${ndrCaseId}`);
      }

      // Update shipment delivery address
      await prisma.shipment.update({
        where: { id: ndrCase.shipmentId },
        data: {
          deliveryName: newAddress.name,
          deliveryPhone: newAddress.phone,
          deliveryEmail: newAddress.email,
          deliveryLine1: newAddress.line1,
          deliveryLine2: newAddress.line2,
          deliveryLandmark: newAddress.landmark,
          deliveryCity: newAddress.city,
          deliveryState: newAddress.state,
          deliveryPincode: newAddress.pincode,
          deliveryCountry: newAddress.country || "India",
        },
      });

      // Update NDR case
      const updatedNDRCase = await prisma.nDRCase.update({
        where: { id: ndrCaseId },
        data: {
          status: "ADDRESS_UPDATED",
          addressUpdateNotes: notes,
          addressUpdatedById: userId,
          addressUpdatedAt: new Date(),
        },
      });

      return updatedNDRCase;
    } catch (error) {
      logger.error("Update delivery address error", {
        ndrCaseId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initiate Return to Origin (RTO) process
   */
  async initiateRTO(ndrCaseId, notes = null, userId = null) {
    try {
      const updatedNDRCase = await prisma.nDRCase.update({
        where: { id: ndrCaseId },
        data: {
          status: "RTO_INITIATED",
          rtoInitiatedAt: new Date(),
          rtoInitiatedById: userId,
          rtoNotes: notes,
        },
      });

      return updatedNDRCase;
    } catch (error) {
      logger.error("Initiate RTO error", {
        ndrCaseId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get NDR summary statistics
   */
  async getNDRSummary(whereClause = {}) {
    try {
      const [statusCounts, reasonCounts, priorityCounts] = await Promise.all([
        prisma.nDRCase.groupBy({
          by: ["status"],
          where: whereClause,
          _count: true,
        }),
        prisma.nDRCase.groupBy({
          by: ["reason"],
          where: whereClause,
          _count: true,
        }),
        prisma.nDRCase.groupBy({
          by: ["priority"],
          where: whereClause,
          _count: true,
        }),
      ]);

      return {
        statusDistribution: statusCounts.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        reasonDistribution: reasonCounts.map((r) => ({
          reason: r.reason,
          count: r._count,
        })),
        priorityDistribution: priorityCounts.map((p) => ({
          priority: p.priority,
          count: p._count,
        })),
      };
    } catch (error) {
      logger.error("Get NDR summary error", {
        error: error.message,
      });
      return {
        statusDistribution: [],
        reasonDistribution: [],
        priorityDistribution: [],
      };
    }
  }

  /**
   * Utility methods
   */
  calculateNDRPriority(reason, paymentType) {
    // COD shipments get higher priority due to cash collection impact
    if (paymentType === "COD") {
      return "HIGH";
    }

    // Address issues need quick resolution
    if (reason === "ADDRESS_ISSUE") {
      return "HIGH";
    }

    // Customer unavailable is common and medium priority
    if (reason === "CUSTOMER_UNAVAILABLE") {
      return "MEDIUM";
    }

    return "LOW";
  }

  calculateNextReattemptDate() {
    // Default: next business day at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Skip weekends
    if (tomorrow.getDay() === 0) {
      // Sunday
      tomorrow.setDate(tomorrow.getDate() + 1);
    } else if (tomorrow.getDay() === 6) {
      // Saturday
      tomorrow.setDate(tomorrow.getDate() + 2);
    }

    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  }
}

module.exports = new NDRService();
