const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const {
  ConflictError,
  ValidationError,
  NotFoundError,
} = require("../shared/lib/errors");

/**
 * Shipment Controller with Real Database Operations
 *
 * Following auth-service patterns with:
 * - Function-based exports (not class-based)
 * - Real database operations using Prisma
 * - Comprehensive audit logging
 * - Multi-tenant support
 * - Integration with Partner and Wallet services
 */

/**
 * Create a new shipment
 */
async function createShipment(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const {
      orderId,
      pickupAddress,
      deliveryAddress,
      packageDetails,
      paymentType = "PREPAID",
      codAmount,
      serviceType = "STANDARD",
      specialInstructions,
    } = req.body;

    logger.info("Creating shipment", {
      service: "shipment-service",
      userId,
      clientId,
      orderId,
      paymentType,
      serviceType,
    });

    // Check for duplicate order ID within client
    const existingShipment = await prisma.shipment.findFirst({
      where: {
        orderId,
        clientId,
      },
    });

    if (existingShipment) {
      throw new ConflictError(
        `Shipment with order ID ${orderId} already exists`,
      );
    }

    // TODO: Calculate shipping cost using Partner Service
    // For now, use mock calculation
    const totalCost = calculateShipmentCost(packageDetails, serviceType);

    // TODO: Validate payment with Wallet Service for PREPAID
    // For now, proceed with creation

    // Create shipment with real database operation
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        clientId,
        userId,
        status: "CREATED",
        paymentType,
        paymentStatus: paymentType === "COD" ? "CONFIRMED" : "PENDING",
        codAmount: paymentType === "COD" ? codAmount : null,
        totalCost,
        currency: "INR",

        // Pickup address
        pickupName: pickupAddress.name,
        pickupPhone: pickupAddress.phone,
        pickupEmail: pickupAddress.email,
        pickupLine1: pickupAddress.addressLine1,
        pickupLine2: pickupAddress.addressLine2,
        pickupLandmark: pickupAddress.landmark,
        pickupCity: pickupAddress.city,
        pickupState: pickupAddress.state,
        pickupPincode: pickupAddress.pincode,
        pickupCountry: pickupAddress.country || "India",

        // Delivery address
        deliveryName: deliveryAddress.name,
        deliveryPhone: deliveryAddress.phone,
        deliveryEmail: deliveryAddress.email,
        deliveryLine1: deliveryAddress.addressLine1,
        deliveryLine2: deliveryAddress.addressLine2,
        deliveryLandmark: deliveryAddress.landmark,
        deliveryCity: deliveryAddress.city,
        deliveryState: deliveryAddress.state,
        deliveryPincode: deliveryAddress.pincode,
        deliveryCountry: deliveryAddress.country || "India",

        // Package details
        weight: packageDetails.weight,
        length: packageDetails.dimensions.length,
        width: packageDetails.dimensions.width,
        height: packageDetails.dimensions.height,
        description: packageDetails.description,
        value: packageDetails.value,
        fragile: packageDetails.fragile || false,

        // Service details
        serviceType,
        specialInstructions,

        // Set estimated delivery (mock for now)
        estimatedDelivery: calculateEstimatedDelivery(serviceType),
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        paymentType: true,
        paymentStatus: true,
        codAmount: true,
        totalCost: true,
        currency: true,
        serviceType: true,
        estimatedDelivery: true,
        createdAt: true,
      },
    });

    // Create initial tracking event
    await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: "CREATED",
        message: "Shipment created successfully",
        source: "SYSTEM",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          orderId,
          paymentType,
          totalCost: totalCost.toString(),
          serviceType,
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    logger.info("Shipment created successfully", {
      service: "shipment-service",
      shipmentId: shipment.id,
      userId,
      clientId,
      orderId,
      totalCost,
    });

    res.status(201).json(
      APIResponse.success(
        {
          shipment: {
            ...shipment,
            totalCost: parseFloat(shipment.totalCost),
            codAmount: shipment.codAmount
              ? parseFloat(shipment.codAmount)
              : null,
          },
        },
        "Shipment created successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to create shipment", {
      service: "shipment-service",
      userId: req.user?.userId,
      clientId: req.user?.clientId,
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof ConflictError || error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        error.code || "VALIDATION_ERROR",
      );
      return res.status(error.statusCode || 400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to create shipment",
      "SHIPMENT_CREATION_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Get shipments with filtering and pagination
 */
async function getShipments(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const isAdmin = req.user.isAdmin;

    const {
      page = 1,
      limit = 20,
      status,
      paymentType,
      dateFrom,
      dateTo,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    // Multi-tenant filtering - admin can see all, others only their own
    if (!isAdmin) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentType) {
      where.paymentType = paymentType;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Get shipments with pagination
    const [shipments, totalCount] = await Promise.all([
      prisma.shipment.findMany({
        where,
        select: {
          id: true,
          orderId: true,
          status: true,
          paymentType: true,
          paymentStatus: true,
          codAmount: true,
          totalCost: true,
          currency: true,
          serviceType: true,
          partnerId: true,
          partnerName: true,
          awbNumber: true,
          deliveryName: true,
          deliveryCity: true,
          deliveryState: true,
          deliveryPincode: true,
          estimatedDelivery: true,
          actualDelivery: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.shipment.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON response
    const formattedShipments = shipments.map((shipment) => ({
      ...shipment,
      totalCost: parseFloat(shipment.totalCost),
      codAmount: shipment.codAmount ? parseFloat(shipment.codAmount) : null,
    }));

    // Audit log for data access
    await prisma.auditLog.create({
      data: {
        userId,
        action: "LIST",
        resource: "Shipment",
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments",
          page: parseInt(page),
          limit: parseInt(limit),
          filters: { status, paymentType, dateFrom, dateTo },
          totalCount,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    res.json(
      APIResponse.success(
        {
          shipments: formattedShipments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalCount,
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            hasNext: offset + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1,
          },
        },
        "Shipments retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get shipments", {
      service: "shipment-service",
      userId: req.user?.userId,
      clientId: req.user?.clientId,
      error: error.message,
    });

    const errorResponse = APIResponse.error(
      "Failed to retrieve shipments",
      "SHIPMENTS_FETCH_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Get single shipment by ID
 */
async function getShipmentById(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const isAdmin = req.user.isAdmin;
    const { id } = req.params;

    // Build where clause for multi-tenant access
    const where = { id };
    if (!isAdmin) {
      where.clientId = clientId;
    }

    const shipment = await prisma.shipment.findFirst({
      where,
      include: {
        trackingEvents: {
          select: {
            id: true,
            status: true,
            message: true,
            location: true,
            source: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: "desc",
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Format response
    const formattedShipment = {
      ...shipment,
      totalCost: parseFloat(shipment.totalCost),
      codAmount: shipment.codAmount ? parseFloat(shipment.codAmount) : null,
      refundAmount: shipment.refundAmount
        ? parseFloat(shipment.refundAmount)
        : null,
      weight: parseFloat(shipment.weight),
      length: parseFloat(shipment.length),
      width: parseFloat(shipment.width),
      height: parseFloat(shipment.height),
      value: shipment.value ? parseFloat(shipment.value) : null,
    };

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "VIEW",
        resource: "Shipment",
        resourceId: shipment.id,
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    res.json(
      APIResponse.success(
        { shipment: formattedShipment },
        "Shipment retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get shipment", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to retrieve shipment",
      "SHIPMENT_FETCH_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Update shipment
 */
async function updateShipment(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const isAdmin = req.user.isAdmin;
    const { id } = req.params;
    const updateData = req.body;

    // Build where clause for multi-tenant access
    const where = { id };
    if (!isAdmin) {
      where.clientId = clientId;
    }

    // Check if shipment exists
    const existingShipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        status: true,
        specialInstructions: true,
      },
    });

    if (!existingShipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Prepare update data
    const prismaUpdateData = {};

    if (updateData.status && updateData.status !== existingShipment.status) {
      prismaUpdateData.status = updateData.status;
    }

    if (updateData.specialInstructions !== undefined) {
      prismaUpdateData.specialInstructions = updateData.specialInstructions;
    }

    if (Object.keys(prismaUpdateData).length === 0) {
      throw new ValidationError("No valid fields provided for update");
    }

    // Update shipment
    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: prismaUpdateData,
      select: {
        id: true,
        orderId: true,
        status: true,
        specialInstructions: true,
        updatedAt: true,
      },
    });

    // Create tracking event if status changed
    if (prismaUpdateData.status) {
      await prisma.trackingEvent.create({
        data: {
          shipmentId: id,
          status: prismaUpdateData.status,
          message: `Shipment status updated to ${prismaUpdateData.status}`,
          source: "MANUAL",
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        resource: "Shipment",
        resourceId: id,
        changes: {
          before: existingShipment,
          after: prismaUpdateData,
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    logger.info("Shipment updated successfully", {
      service: "shipment-service",
      shipmentId: id,
      userId,
      clientId,
      changes: prismaUpdateData,
    });

    res.json(
      APIResponse.success(
        { shipment: updatedShipment },
        "Shipment updated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to update shipment", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    if (error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        "VALIDATION_ERROR",
      );
      return res.status(400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to update shipment",
      "SHIPMENT_UPDATE_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Cancel shipment
 */
async function cancelShipment(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const isAdmin = req.user.isAdmin;
    const { id } = req.params;
    const { reason = "User requested cancellation" } = req.body;

    // Build where clause for multi-tenant access
    const where = { id };
    if (!isAdmin) {
      where.clientId = clientId;
    }

    // Get shipment details
    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        status: true,
        paymentType: true,
        totalCost: true,
        walletTransactionId: true,
        createdAt: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Check if shipment can be cancelled
    if (!["CREATED", "BOOKED", "PICKED_UP"].includes(shipment.status)) {
      throw new ValidationError("Shipment cannot be cancelled at this stage");
    }

    // Calculate refund amount
    const refundAmount = calculateRefundAmount(shipment, reason);

    // Update shipment status
    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        paymentStatus: refundAmount > 0 ? "REFUNDED" : "NO_REFUND",
        refundAmount: refundAmount > 0 ? refundAmount : null,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        paymentStatus: true,
        refundAmount: true,
        cancelledAt: true,
        cancellationReason: true,
      },
    });

    // Create tracking event
    await prisma.trackingEvent.create({
      data: {
        shipmentId: id,
        status: "CANCELLED",
        message: `Shipment cancelled: ${reason}`,
        source: "MANUAL",
      },
    });

    // TODO: Process refund via Wallet Service
    // For now, just log the refund requirement

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CANCEL",
        resource: "Shipment",
        resourceId: id,
        changes: {
          status: "CANCELLED",
          refundAmount: refundAmount > 0 ? refundAmount.toString() : null,
          reason,
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id/cancel",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    logger.info("Shipment cancelled successfully", {
      service: "shipment-service",
      shipmentId: id,
      userId,
      clientId,
      refundAmount,
      reason,
    });

    res.json(
      APIResponse.success(
        {
          shipment: {
            ...updatedShipment,
            refundAmount: updatedShipment.refundAmount
              ? parseFloat(updatedShipment.refundAmount)
              : null,
          },
        },
        "Shipment cancelled successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to cancel shipment", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    if (error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        "VALIDATION_ERROR",
      );
      return res.status(400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to cancel shipment",
      "SHIPMENT_CANCELLATION_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Get shipment tracking
 */
async function getShipmentTracking(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Get shipment with tracking events
    const shipment = await prisma.shipment.findUnique({
      where: { id },
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
            source: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: "asc",
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Optional audit log for tracking access (can be disabled for high-volume tracking)
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "TRACK",
          resource: "Shipment",
          resourceId: id,
          metadata: {
            source: "shipment-service",
            endpoint: "/api/v1/shipments/:id/tracking",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });
    }

    res.json(
      APIResponse.success(
        { shipment },
        "Tracking information retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get tracking", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to retrieve tracking information",
      "TRACKING_FETCH_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Add tracking event
 */
async function addTrackingEvent(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { status, message, location } = req.body;

    // Check if shipment exists (without multi-tenant filtering for admin operations)
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Create tracking event
    const trackingEvent = await prisma.trackingEvent.create({
      data: {
        shipmentId: id,
        status,
        message,
        location,
        source: "MANUAL",
      },
      select: {
        id: true,
        status: true,
        message: true,
        location: true,
        source: true,
        timestamp: true,
      },
    });

    // Update shipment status if different
    if (status !== shipment.status) {
      await prisma.shipment.update({
        where: { id },
        data: { status },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "ADD_TRACKING_EVENT",
        resource: "TrackingEvent",
        resourceId: trackingEvent.id,
        changes: {
          shipmentId: id,
          status,
          message,
          location,
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id/tracking/events",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Tracking event added successfully", {
      service: "shipment-service",
      shipmentId: id,
      eventId: trackingEvent.id,
      status,
      userId,
    });

    res
      .status(201)
      .json(
        APIResponse.success(
          { trackingEvent },
          "Tracking event added successfully",
        ),
      );
  } catch (error) {
    logger.error("Failed to add tracking event", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to add tracking event",
      "TRACKING_EVENT_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

// Helper functions

/**
 * Calculate shipment cost (mock implementation)
 * TODO: Replace with Partner Service integration
 */
function calculateShipmentCost(packageDetails, serviceType) {
  let baseCost = 100;

  // Weight-based pricing
  const weight = parseFloat(packageDetails.weight);
  if (weight > 1) {
    baseCost += (weight - 1) * 20;
  }

  // Service type multiplier
  const serviceMultipliers = {
    EXPRESS: 1.5,
    STANDARD: 1.0,
    ECONOMY: 0.8,
  };

  baseCost *= serviceMultipliers[serviceType] || 1.0;

  return parseFloat(baseCost.toFixed(2));
}

/**
 * Calculate estimated delivery date
 */
function calculateEstimatedDelivery(serviceType) {
  const now = new Date();
  const deliveryDays = {
    EXPRESS: 1,
    STANDARD: 3,
    ECONOMY: 7,
  };

  const days = deliveryDays[serviceType] || 3;
  now.setDate(now.getDate() + days);

  return now;
}

/**
 * Calculate refund amount based on cancellation policy
 */
function calculateRefundAmount(shipment, _reason) {
  if (shipment.paymentType === "COD") {
    return 0; // No refund for COD shipments
  }

  const cost = parseFloat(shipment.totalCost);
  const hoursElapsed =
    (Date.now() - new Date(shipment.createdAt).getTime()) / (1000 * 60 * 60);

  // Refund policy based on time elapsed
  if (hoursElapsed < 1) {
    return cost; // Full refund within 1 hour
  } else if (hoursElapsed < 24) {
    return parseFloat((cost * 0.8).toFixed(2)); // 80% refund within 24 hours
  } else {
    return parseFloat((cost * 0.5).toFixed(2)); // 50% refund after 24 hours
  }
}

module.exports = {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipment,
  cancelShipment,
  getShipmentTracking,
  addTrackingEvent,
};
