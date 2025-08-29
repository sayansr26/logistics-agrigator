const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const {
  ValidationError,
  NotFoundError,
  APIError,
} = require("../shared/lib/errors");

/**
 * Tracking Service for Comprehensive Shipment Tracking
 *
 * Following auth-service patterns with:
 * - Function-based exports (not class-based)
 * - Real database operations using Prisma
 * - Comprehensive event logging and status management
 * - AWB-based tracking functionality
 * - Delivery confirmation and POD management
 * - Performance analytics and reporting
 */

/**
 * Shipment status workflow definitions
 */
const SHIPMENT_STATUS_FLOW = {
  CREATED: ["BOOKED", "CANCELLED"],
  BOOKED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "RTO"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO"],
  OUT_FOR_DELIVERY: ["DELIVERED", "NDR", "RTO"],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
  RTO: ["DELIVERED"], // Return to origin can be delivered
  NDR: ["OUT_FOR_DELIVERY", "RTO"], // Non-delivery report can retry or RTO
};

/**
 * Event source types
 */
const EVENT_SOURCES = {
  SYSTEM: "SYSTEM",
  PARTNER: "PARTNER",
  MANUAL: "MANUAL",
  API: "API",
  WEBHOOK: "WEBHOOK",
};

/**
 * Notification types for tracking events
 */
const NOTIFICATION_TYPES = {
  SMS: "SMS",
  EMAIL: "EMAIL",
  PUSH: "PUSH",
  WEBHOOK: "WEBHOOK",
};

/**
 * Validate if status transition is allowed
 */
function isValidStatusTransition(currentStatus, newStatus) {
  if (!currentStatus) return true; // First status can be any

  const allowedTransitions = SHIPMENT_STATUS_FLOW[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Create a new tracking event
 */
async function createTrackingEvent(shipmentId, eventData, userId = null) {
  try {
    const {
      status,
      message,
      location = null,
      eventMetadata = {},
      source = EVENT_SOURCES.SYSTEM,
      timestamp = null,
    } = eventData;

    logger.info("Creating tracking event", {
      shipmentId,
      status,
      source,
      service: "tracking-service",
    });

    // Get current shipment status for validation
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        orderId: true,
        clientId: true,
        awbNumber: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Validate status transition if status is changing
    if (status !== shipment.status) {
      if (!isValidStatusTransition(shipment.status, status)) {
        throw new ValidationError(
          `Invalid status transition from ${shipment.status} to ${status}`,
          {
            currentStatus: shipment.status,
            requestedStatus: status,
            allowedTransitions: SHIPMENT_STATUS_FLOW[shipment.status] || [],
          },
        );
      }
    }

    // Create tracking event with transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create tracking event
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          shipmentId,
          status,
          message,
          location,
          eventData: eventMetadata,
          source,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
        select: {
          id: true,
          status: true,
          message: true,
          location: true,
          eventData: true,
          source: true,
          timestamp: true,
          createdAt: true,
        },
      });

      // Update shipment status if it's changing
      if (status !== shipment.status) {
        await tx.shipment.update({
          where: { id: shipmentId },
          data: {
            status,
            // Set delivery time for delivered shipments
            actualDelivery: status === "DELIVERED" ? new Date() : undefined,
          },
        });

        logger.info("Shipment status updated", {
          shipmentId,
          oldStatus: shipment.status,
          newStatus: status,
          service: "tracking-service",
        });
      }

      return trackingEvent;
    });

    // Create audit log for tracking event
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE_TRACKING_EVENT",
        resource: "TrackingEvent",
        resourceId: result.id,
        changes: {
          shipmentId,
          status,
          message,
          location,
          source,
          statusChanged: status !== shipment.status,
        },
        metadata: {
          service: "tracking-service",
          orderId: shipment.orderId,
          awbNumber: shipment.awbNumber,
        },
        clientId: shipment.clientId,
      },
    });

    logger.info("Tracking event created successfully", {
      shipmentId,
      eventId: result.id,
      status,
      source,
      service: "tracking-service",
    });

    return result;
  } catch (error) {
    logger.error("Failed to create tracking event", {
      shipmentId,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Get tracking events for a shipment
 */
async function getTrackingEvents(shipmentId, includeShipmentDetails = false) {
  try {
    logger.debug("Getting tracking events", {
      shipmentId,
      includeShipmentDetails,
      service: "tracking-service",
    });

    const cacheKey = `tracking:${shipmentId}:${includeShipmentDetails}`;
    const redis = getRedisClient();

    try {
      // Try cache first (5 minute TTL for tracking data)
      const cached = await redis.get(cacheKey);
      if (cached) {
        const trackingData = JSON.parse(cached);
        logger.debug("Tracking data retrieved from cache", {
          shipmentId,
          service: "tracking-service",
        });
        return trackingData;
      }
    } catch (cacheError) {
      logger.warn("Redis cache error, proceeding without cache", {
        error: cacheError.message,
      });
    }

    const result = includeShipmentDetails
      ? await prisma.shipment.findUnique({
          where: { id: shipmentId },
          select: {
            id: true,
            orderId: true,
            status: true,
            awbNumber: true,
            partnerId: true,
            partnerName: true,
            estimatedDelivery: true,
            actualDelivery: true,
            trackingEvents: {
              select: {
                id: true,
                status: true,
                message: true,
                location: true,
                eventData: true,
                source: true,
                timestamp: true,
                createdAt: true,
              },
              orderBy: { timestamp: "desc" },
            },
          },
        })
      : await prisma.trackingEvent.findMany({
          where: { shipmentId },
          select: {
            id: true,
            status: true,
            message: true,
            location: true,
            eventData: true,
            source: true,
            timestamp: true,
            createdAt: true,
          },
          orderBy: { timestamp: "desc" },
        });

    if (!result) {
      throw new NotFoundError("Shipment not found");
    }

    // Cache the result (5 minutes TTL)
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(result));
    } catch (cacheError) {
      logger.warn("Failed to cache tracking data", {
        error: cacheError.message,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to get tracking events", {
      shipmentId,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Track shipment by AWB number (public endpoint)
 */
async function trackByAwbNumber(awbNumber) {
  try {
    logger.info("Tracking shipment by AWB", {
      awbNumber,
      service: "tracking-service",
    });

    const cacheKey = `awb-tracking:${awbNumber}`;
    const redis = getRedisClient();

    try {
      // Try cache first (10 minute TTL for AWB tracking)
      const cached = await redis.get(cacheKey);
      if (cached) {
        const trackingData = JSON.parse(cached);
        logger.debug("AWB tracking data retrieved from cache", {
          awbNumber,
          service: "tracking-service",
        });
        return trackingData;
      }
    } catch (cacheError) {
      logger.warn("Redis cache error, proceeding without cache", {
        error: cacheError.message,
      });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { awbNumber },
      select: {
        id: true,
        orderId: true,
        status: true,
        awbNumber: true,
        partnerId: true,
        partnerName: true,
        estimatedDelivery: true,
        actualDelivery: true,
        // Basic delivery address for tracking (no sensitive info)
        deliveryCity: true,
        deliveryState: true,
        deliveryPincode: true,
        trackingEvents: {
          select: {
            id: true,
            status: true,
            message: true,
            location: true,
            source: true,
            timestamp: true,
          },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found with this AWB number");
    }

    // Public tracking data (sanitized)
    const publicTrackingData = {
      awbNumber: shipment.awbNumber,
      status: shipment.status,
      partnerName: shipment.partnerName,
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: shipment.actualDelivery,
      destination: {
        city: shipment.deliveryCity,
        state: shipment.deliveryState,
        pincode: shipment.deliveryPincode,
      },
      events: shipment.trackingEvents.map((event) => ({
        status: event.status,
        message: event.message,
        location: event.location,
        timestamp: event.timestamp,
      })),
      lastUpdated: shipment.trackingEvents[0]?.timestamp || shipment.createdAt,
    };

    // Cache the result (10 minutes TTL for public tracking)
    try {
      await redis.setex(cacheKey, 600, JSON.stringify(publicTrackingData));
    } catch (cacheError) {
      logger.warn("Failed to cache AWB tracking data", {
        error: cacheError.message,
      });
    }

    logger.info("AWB tracking successful", {
      awbNumber,
      status: shipment.status,
      eventsCount: shipment.trackingEvents.length,
      service: "tracking-service",
    });

    return publicTrackingData;
  } catch (error) {
    logger.error("Failed to track by AWB", {
      awbNumber,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Update shipment status with automatic event creation
 */
async function updateShipmentStatus(
  shipmentId,
  newStatus,
  message,
  eventData = {},
  userId = null,
) {
  try {
    logger.info("Updating shipment status", {
      shipmentId,
      newStatus,
      service: "tracking-service",
    });

    const trackingEvent = await createTrackingEvent(
      shipmentId,
      {
        status: newStatus,
        message: message || `Status updated to ${newStatus}`,
        eventMetadata: eventData,
        source: userId ? EVENT_SOURCES.MANUAL : EVENT_SOURCES.SYSTEM,
      },
      userId,
    );

    return trackingEvent;
  } catch (error) {
    logger.error("Failed to update shipment status", {
      shipmentId,
      newStatus,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Record delivery confirmation with POD (Proof of Delivery)
 */
async function recordDeliveryConfirmation(
  shipmentId,
  deliveryData,
  userId = null,
) {
  try {
    const {
      recipientName,
      recipientSignature = null,
      deliveryImage = null,
      otp = null,
      notes = null,
      deliveryPersonName = null,
      deliveryTime = null,
    } = deliveryData;

    logger.info("Recording delivery confirmation", {
      shipmentId,
      recipientName,
      hasSignature: !!recipientSignature,
      hasImage: !!deliveryImage,
      service: "tracking-service",
    });

    // Create delivery confirmation event
    const deliveryEvent = await createTrackingEvent(
      shipmentId,
      {
        status: "DELIVERED",
        message: `Package delivered successfully to ${recipientName}`,
        eventMetadata: {
          pod: {
            recipientName,
            recipientSignature,
            deliveryImage,
            otp,
            notes,
            deliveryPersonName,
            deliveryTime: deliveryTime || new Date().toISOString(),
          },
          confirmationType: "POD",
        },
        source: EVENT_SOURCES.PARTNER,
        timestamp: deliveryTime,
      },
      userId,
    );

    logger.info("Delivery confirmation recorded", {
      shipmentId,
      eventId: deliveryEvent.id,
      recipientName,
      service: "tracking-service",
    });

    return deliveryEvent;
  } catch (error) {
    logger.error("Failed to record delivery confirmation", {
      shipmentId,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Get tracking analytics for performance reporting
 */
async function getTrackingAnalytics(timeRange = "7d", clientId = null) {
  try {
    logger.info("Generating tracking analytics", {
      timeRange,
      clientId,
      service: "tracking-service",
    });

    const startDate = new Date();
    switch (timeRange) {
      case "1d":
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const whereClause = {
      createdAt: { gte: startDate },
      ...(clientId && { clientId }),
    };

    // Get shipment status distribution
    const statusDistribution = await prisma.shipment.groupBy({
      by: ["status"],
      where: whereClause,
      _count: { id: true },
    });

    // Get delivery performance
    const deliveryStats = await prisma.shipment.aggregate({
      where: {
        ...whereClause,
        status: "DELIVERED",
        actualDelivery: { not: null },
        estimatedDelivery: { not: null },
      },
      _avg: {
        // This would need a computed field for delivery time difference
      },
      _count: { id: true },
    });

    // Get tracking events by source
    const eventsBySource = await prisma.trackingEvent.groupBy({
      by: ["source"],
      where: {
        createdAt: { gte: startDate },
        shipment: clientId ? { clientId } : undefined,
      },
      _count: { id: true },
    });

    // Get NDR (Non-Delivery Report) statistics
    const ndrStats = await prisma.trackingEvent.groupBy({
      by: ["status"],
      where: {
        status: "NDR",
        createdAt: { gte: startDate },
        shipment: clientId ? { clientId } : undefined,
      },
      _count: { id: true },
    });

    const analytics = {
      timeRange,
      generatedAt: new Date().toISOString(),
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      deliveryPerformance: {
        totalDelivered: deliveryStats._count.id,
        // Add more delivery metrics as needed
      },
      eventsBySource: eventsBySource.map((e) => ({
        source: e.source,
        count: e._count.id,
      })),
      ndrStats: {
        totalNDRs: ndrStats.reduce((sum, s) => sum + s._count.id, 0),
        breakdown: ndrStats.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
      },
    };

    logger.info("Tracking analytics generated", {
      timeRange,
      clientId,
      totalStatuses: statusDistribution.length,
      service: "tracking-service",
    });

    return analytics;
  } catch (error) {
    logger.error("Failed to generate tracking analytics", {
      timeRange,
      clientId,
      error: error.message,
      service: "tracking-service",
    });
    throw error;
  }
}

/**
 * Prepare notification data for tracking events
 * This function prepares data for SMS/Email/Push notifications
 * The actual sending would be handled by a separate notification service
 */
function prepareTrackingNotification(
  trackingEvent,
  shipmentData,
  notificationType = NOTIFICATION_TYPES.SMS,
) {
  try {
    const { status, message, location, timestamp } = trackingEvent;
    const { orderId, awbNumber, deliveryName, deliveryPhone } = shipmentData;

    const baseData = {
      orderId,
      awbNumber,
      status,
      message,
      location,
      timestamp,
      recipientName: deliveryName,
      recipientPhone: deliveryPhone,
    };

    switch (notificationType) {
      case NOTIFICATION_TYPES.SMS:
        return {
          ...baseData,
          smsText: `Order ${orderId}: ${message}${location ? ` at ${location}` : ""}. AWB: ${awbNumber}`,
          phoneNumber: deliveryPhone,
        };

      case NOTIFICATION_TYPES.EMAIL:
        return {
          ...baseData,
          subject: `Shipment Update - Order ${orderId}`,
          emailBody: `Your order ${orderId} (AWB: ${awbNumber}) has been updated.\n\nStatus: ${status}\nMessage: ${message}${location ? `\nLocation: ${location}` : ""}\nTime: ${new Date(timestamp).toLocaleString()}`,
        };

      case NOTIFICATION_TYPES.PUSH:
        return {
          ...baseData,
          title: `Order ${orderId} Update`,
          body: message,
          data: { orderId, awbNumber, status },
        };

      default:
        return baseData;
    }
  } catch (error) {
    logger.error("Failed to prepare tracking notification", {
      eventId: trackingEvent.id,
      notificationType,
      error: error.message,
      service: "tracking-service",
    });
    return null;
  }
}

/**
 * Clear tracking cache for updated shipments
 */
async function clearTrackingCache(shipmentId, awbNumber = null) {
  try {
    const redis = getRedisClient();
    const keys = [
      `tracking:${shipmentId}:true`,
      `tracking:${shipmentId}:false`,
    ];

    if (awbNumber) {
      keys.push(`awb-tracking:${awbNumber}`);
    }

    for (const key of keys) {
      await redis.del(key);
    }

    logger.debug("Tracking cache cleared", {
      shipmentId,
      awbNumber,
      keysCleared: keys.length,
      service: "tracking-service",
    });
  } catch (error) {
    logger.warn("Failed to clear tracking cache", {
      shipmentId,
      error: error.message,
      service: "tracking-service",
    });
  }
}

// Export functions following auth-service pattern
module.exports = {
  createTrackingEvent,
  getTrackingEvents,
  trackByAwbNumber,
  updateShipmentStatus,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
  prepareTrackingNotification,
  clearTrackingCache,
  // Constants for external use
  SHIPMENT_STATUS_FLOW,
  EVENT_SOURCES,
  NOTIFICATION_TYPES,
};
