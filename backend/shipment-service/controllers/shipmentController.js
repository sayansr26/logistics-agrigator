const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const {
  ConflictError,
  ValidationError,
  NotFoundError,
  APIError,
} = require("../shared/lib/errors");
const partnerIntegrationService = require("../services/partnerIntegrationService");
const paymentProcessingService = require("../services/paymentProcessingService");
const trackingService = require("../services/trackingService");

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

    // Calculate shipping rates and select partner using Partner Service
    const rateCalculationParams = {
      fromPincode: pickupAddress.pincode,
      toPincode: deliveryAddress.pincode,
      weight: packageDetails.weight,
      serviceType: serviceType.toUpperCase(),
      dimensions: packageDetails.dimensions,
      codAmount: paymentType === "COD" ? codAmount : null,
      strategy: "cheapest", // Can be 'cheapest', 'fastest', or 'balanced'
    };

    logger.info("Calculating rates using Partner Service", {
      service: "shipment-service",
      userId,
      rateParams: rateCalculationParams,
    });

    const { selectedCourier, alternativeOptions } =
      await partnerIntegrationService.selectOptimalCourier(
        rateCalculationParams,
      );

    // Use the selected partner's rate as total cost
    const totalCost = selectedCourier.totalAmount;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(
      estimatedDelivery.getDate() + selectedCourier.deliveryDays,
    );

    logger.info("Partner selected for shipment", {
      service: "shipment-service",
      userId,
      selectedPartner: {
        partnerId: selectedCourier.partnerId,
        partnerName: selectedCourier.partnerName,
        totalAmount: selectedCourier.totalAmount,
        deliveryDays: selectedCourier.deliveryDays,
      },
      alternatives: alternativeOptions.length,
    });

    // SHIP-003: Real Wallet Service Integration for PREPAID payments
    let walletTransactionId = null;
    let paymentReference = null;

    if (paymentType === "PREPAID") {
      logger.info("Processing PREPAID payment via Wallet Service", {
        service: "shipment-service",
        userId,
        shipmentAmount: totalCost,
        orderId,
      });

      try {
        // Get auth token from request headers for wallet service
        const authToken = req.headers.authorization?.replace("Bearer ", "");

        // Process payment through Wallet Service (validation + debit)
        const paymentResult =
          await paymentProcessingService.processShipmentPayment(
            userId,
            totalCost,
            orderId, // Using orderId as temporary reference until shipment ID is available
            `Shipment charge for order ${orderId} - ${packageDetails.description || "Package"}`,
            authToken,
          );

        walletTransactionId = paymentResult.walletTransactionId;
        paymentReference = paymentResult.paymentReference;

        logger.info("Wallet payment processed successfully", {
          service: "shipment-service",
          userId,
          walletTransactionId,
          paymentReference,
          amount: totalCost,
        });
      } catch (paymentError) {
        logger.error("Wallet payment failed", {
          service: "shipment-service",
          userId,
          orderId,
          amount: totalCost,
          error: paymentError.message,
        });

        // Re-throw the error to prevent shipment creation
        if (paymentError instanceof ConflictError) {
          throw new ConflictError(
            `Payment failed: ${paymentError.message}`,
            paymentError.details,
          );
        }

        throw new APIError(
          "Payment processing failed. Please try again or contact support.",
          500,
          { originalError: paymentError.message },
        );
      }
    }

    // Create shipment with real database operation
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        clientId,
        userId,
        status: "CREATED",
        paymentType,
        paymentStatus:
          paymentType === "COD"
            ? "CONFIRMED"
            : walletTransactionId
              ? "CONFIRMED"
              : "PENDING",
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

        // Partner assignment from Partner Service
        partnerId: selectedCourier.partnerId,
        partnerName: selectedCourier.partnerName,

        // Real estimated delivery from Partner Service
        estimatedDelivery,

        // Wallet Integration (SHIP-003: Real integration implemented)
        walletTransactionId, // Real wallet transaction ID from payment processing
        paymentReference, // Real payment reference from Wallet Service
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

    // Create initial tracking event using tracking service
    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: "CREATED",
        message: `Shipment created successfully with order ID ${orderId}`,
        eventMetadata: {
          orderId,
          paymentType,
          totalCost: totalCost.toString(),
          serviceType,
          partnerId: selectedCourier.partnerId,
          partnerName: selectedCourier.partnerName,
        },
        source: trackingService.EVENT_SOURCES.SYSTEM,
      },
      userId,
    );

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

    // Create tracking event if status changed using tracking service
    if (prismaUpdateData.status) {
      await trackingService.updateShipmentStatus(
        id,
        prismaUpdateData.status,
        `Shipment status updated to ${prismaUpdateData.status}`,
        {
          updateReason: "Manual update via API",
          updatedFields: Object.keys(prismaUpdateData),
        },
        userId,
      );
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

    // Create tracking event using tracking service
    await trackingService.updateShipmentStatus(
      id,
      "CANCELLED",
      `Shipment cancelled: ${reason}`,
      {
        cancellationReason: reason,
        refundAmount: refundAmount > 0 ? refundAmount.toString() : null,
        refundProcessed: refundTransactionId ? true : false,
        refundTransactionId,
      },
      userId,
    );

    // SHIP-003: Real Wallet Service Integration for Refunds
    let refundTransactionId = null;

    if (
      refundAmount > 0 &&
      shipment.paymentType === "PREPAID" &&
      shipment.walletTransactionId
    ) {
      logger.info("Processing refund via Wallet Service", {
        service: "shipment-service",
        shipmentId: id,
        userId: shipment.userId || userId,
        refundAmount,
        originalWalletTransactionId: shipment.walletTransactionId,
      });

      try {
        // Get auth token from request headers for wallet service
        const authToken = req.headers.authorization?.replace("Bearer ", "");

        // Process refund through Wallet Service
        const refundResult =
          await paymentProcessingService.processShipmentRefund(
            shipment.userId || userId,
            refundAmount,
            shipment.id,
            reason,
            authToken,
          );

        refundTransactionId = refundResult.refundTransactionId;

        // Update shipment with refund transaction ID
        await prisma.shipment.update({
          where: { id },
          data: {
            refundTransactionId,
          },
        });

        logger.info("Wallet refund processed successfully", {
          service: "shipment-service",
          shipmentId: id,
          userId: shipment.userId || userId,
          refundTransactionId,
          refundAmount,
        });
      } catch (refundError) {
        logger.error("Wallet refund failed", {
          service: "shipment-service",
          shipmentId: id,
          userId: shipment.userId || userId,
          refundAmount,
          error: refundError.message,
        });

        // Don't fail the cancellation if refund fails - admin can handle manually
        logger.warn(
          "Shipment cancelled but refund processing failed - requires manual intervention",
          {
            service: "shipment-service",
            shipmentId: id,
            refundAmount,
            walletTransactionId: shipment.walletTransactionId,
          },
        );
      }
    }

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

    // Use tracking service to get comprehensive tracking data
    const shipment = await trackingService.getTrackingEvents(id, true);

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
            eventsCount: shipment.trackingEvents?.length || 0,
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

    // Create tracking event using tracking service (handles status update automatically)
    const trackingEvent = await trackingService.createTrackingEvent(
      id,
      {
        status,
        message,
        location,
        eventMetadata: {},
        source: trackingService.EVENT_SOURCES.MANUAL,
      },
      userId,
    );

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

/**
 * Calculate shipping rates using Partner Service
 */
async function calculateRates(req, res) {
  try {
    const userId = req.user.userId;
    const {
      fromPincode,
      toPincode,
      weight,
      serviceType = "STANDARD",
      dimensions = { length: 10, width: 10, height: 10 },
      codAmount,
    } = req.body;

    logger.info("Calculating shipping rates", {
      service: "shipment-service",
      userId,
      fromPincode,
      toPincode,
      weight,
      serviceType,
    });

    // Prepare rate calculation parameters
    const rateParams = {
      fromPincode,
      toPincode,
      weight,
      serviceType: serviceType.toUpperCase(),
      dimensions,
      codAmount,
    };

    // Calculate rates using Partner Service
    const rateData = await partnerIntegrationService.calculateRates(rateParams);

    // Audit logging
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CALCULATE_RATES",
        resource: "Shipment",
        resourceId: null,
        changes: rateParams,
        metadata: {
          resultCount: rateData.rates?.length || 0,
          cheapestRate: rateData.cheapestRate?.totalAmount,
          fastestRate: rateData.fastestRate?.deliveryDays,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success(
        {
          rates: rateData.rates,
          cheapestRate: rateData.cheapestRate,
          fastestRate: rateData.fastestRate,
          calculation: {
            fromPincode,
            toPincode,
            weight,
            serviceType,
            totalOptions: rateData.rates?.length || 0,
          },
        },
        "Shipping rates calculated successfully",
      ),
    );
  } catch (error) {
    logger.error("Rate calculation failed", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
      body: req.body,
    });

    if (error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        "VALIDATION_ERROR",
      );
      return res.status(400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to calculate shipping rates",
      "RATE_CALCULATION_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Select optimal courier partner
 */
async function selectPartner(req, res) {
  try {
    const userId = req.user.userId;
    const {
      fromPincode,
      toPincode,
      weight,
      serviceType = "STANDARD",
      dimensions = { length: 10, width: 10, height: 10 },
      codAmount,
      strategy = "cheapest", // cheapest, fastest, balanced
    } = req.body;

    logger.info("Selecting courier partner", {
      service: "shipment-service",
      userId,
      fromPincode,
      toPincode,
      strategy,
    });

    // Prepare selection parameters
    const selectionParams = {
      fromPincode,
      toPincode,
      weight,
      serviceType: serviceType.toUpperCase(),
      dimensions,
      codAmount,
      strategy,
    };

    // Select optimal courier using Partner Service
    const { selectedCourier, alternativeOptions, selectionReason } =
      await partnerIntegrationService.selectOptimalCourier(selectionParams);

    // Audit logging
    await prisma.auditLog.create({
      data: {
        userId,
        action: "SELECT_PARTNER",
        resource: "Shipment",
        resourceId: null,
        changes: selectionParams,
        metadata: {
          selectedPartnerId: selectedCourier.partnerId,
          selectedPartnerName: selectedCourier.partnerName,
          totalAmount: selectedCourier.totalAmount,
          deliveryDays: selectedCourier.deliveryDays,
          strategy,
          alternativesCount: alternativeOptions.length,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success(
        {
          selectedCourier,
          alternativeOptions,
          selectionReason,
          selection: {
            fromPincode,
            toPincode,
            weight,
            serviceType,
            strategy,
            totalAlternatives: alternativeOptions.length,
          },
        },
        "Courier partner selected successfully",
      ),
    );
  } catch (error) {
    logger.error("Partner selection failed", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
      body: req.body,
    });

    if (error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        "VALIDATION_ERROR",
      );
      return res.status(400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to select courier partner",
      "PARTNER_SELECTION_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Check serviceability using Partner Service
 */
async function checkServiceability(req, res) {
  try {
    const userId = req.user.userId;
    const { fromPincode, toPincode, serviceType = "STANDARD" } = req.body;

    logger.info("Checking serviceability", {
      service: "shipment-service",
      userId,
      fromPincode,
      toPincode,
      serviceType,
    });

    // Prepare serviceability parameters
    const serviceabilityParams = {
      fromPincode,
      toPincode,
      serviceType: serviceType.toUpperCase(),
    };

    // Check serviceability using Partner Service
    const serviceabilityData =
      await partnerIntegrationService.checkServiceability(serviceabilityParams);

    // Count serviceable partners
    const serviceableCount = serviceabilityData.filter(
      (s) => s.serviceable,
    ).length;
    const totalPartners = serviceabilityData.length;

    // Audit logging
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CHECK_SERVICEABILITY",
        resource: "Shipment",
        resourceId: null,
        changes: serviceabilityParams,
        metadata: {
          serviceablePartners: serviceableCount,
          totalPartners,
          serviceabilityPercentage:
            totalPartners > 0 ? (serviceableCount / totalPartners) * 100 : 0,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success(
        {
          serviceability: serviceabilityData,
          summary: {
            fromPincode,
            toPincode,
            serviceType,
            serviceablePartners: serviceableCount,
            totalPartners,
            isServiceable: serviceableCount > 0,
            serviceabilityPercentage:
              totalPartners > 0
                ? parseFloat(
                    ((serviceableCount / totalPartners) * 100).toFixed(2),
                  )
                : 0,
          },
        },
        "Serviceability check completed successfully",
      ),
    );
  } catch (error) {
    logger.error("Serviceability check failed", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
      body: req.body,
    });

    if (error instanceof ValidationError) {
      const errorResponse = APIResponse.error(
        error.message,
        "VALIDATION_ERROR",
      );
      return res.status(400).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to check serviceability",
      "SERVICEABILITY_CHECK_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

// Helper functions

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

/**
 * Track shipment by AWB number (Public endpoint)
 * SHIP-004: New endpoint for public tracking
 */
async function trackByAwbNumber(req, res) {
  try {
    const { awbNumber } = req.params;

    logger.info("Public tracking by AWB", {
      service: "shipment-service",
      awbNumber,
    });

    // Use tracking service for AWB tracking
    const trackingData = await trackingService.trackByAwbNumber(awbNumber);

    res.json(
      APIResponse.success(
        trackingData,
        "Shipment tracking retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to track by AWB", {
      service: "shipment-service",
      awbNumber: req.params.awbNumber,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      const errorResponse = APIResponse.error(error.message, "NOT_FOUND");
      return res.status(404).json(errorResponse);
    }

    const errorResponse = APIResponse.error(
      "Failed to retrieve tracking information",
      "AWB_TRACKING_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Record delivery confirmation with POD
 * SHIP-004: New endpoint for delivery confirmation
 */
async function recordDeliveryConfirmation(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const deliveryData = req.body;

    logger.info("Recording delivery confirmation", {
      service: "shipment-service",
      shipmentId: id,
      userId,
      recipientName: deliveryData.recipientName,
    });

    // Use tracking service for delivery confirmation
    const deliveryEvent = await trackingService.recordDeliveryConfirmation(
      id,
      deliveryData,
      userId,
    );

    res
      .status(201)
      .json(
        APIResponse.success(
          { deliveryEvent },
          "Delivery confirmation recorded successfully",
        ),
      );
  } catch (error) {
    logger.error("Failed to record delivery confirmation", {
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
      "Failed to record delivery confirmation",
      "DELIVERY_CONFIRMATION_FAILED",
    );
    res.status(500).json(errorResponse);
  }
}

/**
 * Get tracking analytics and performance metrics
 * SHIP-004: New endpoint for tracking analytics
 */
async function getTrackingAnalytics(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const isAdmin = req.user.isAdmin;
    const { timeRange = "7d" } = req.query;

    logger.info("Generating tracking analytics", {
      service: "shipment-service",
      timeRange,
      userId,
      clientId,
      isAdmin,
    });

    // Admin can see all analytics, clients see only their own
    const analyticsClientId = isAdmin ? null : clientId;

    // Use tracking service for analytics
    const analytics = await trackingService.getTrackingAnalytics(
      timeRange,
      analyticsClientId,
    );

    // Audit log for analytics access
    await prisma.auditLog.create({
      data: {
        userId,
        action: "VIEW_ANALYTICS",
        resource: "TrackingAnalytics",
        changes: {
          timeRange,
          scope: isAdmin ? "global" : "client",
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/analytics/tracking",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    res.json(
      APIResponse.success(
        analytics,
        "Tracking analytics generated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to generate tracking analytics", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
    });

    const errorResponse = APIResponse.error(
      "Failed to generate tracking analytics",
      "ANALYTICS_GENERATION_FAILED",
    );
    res.status(500).json(errorResponse);
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
  calculateRates,
  selectPartner,
  checkServiceability,
  // New SHIP-004 endpoints
  trackByAwbNumber,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
};
