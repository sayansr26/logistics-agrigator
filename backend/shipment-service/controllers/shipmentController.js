const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const {
  ConflictError,
  ValidationError,
  NotFoundError,
  APIError,
} = require("../shared/lib/errors");
const { authUtils } = require("../shared/lib/auth");
const partnerIntegrationService = require("../services/partnerIntegrationService");
const paymentProcessingService = require("../services/paymentProcessingService");
const trackingService = require("../services/trackingService");
const bulkProcessingService = require("../services/bulkProcessingService");
const ndrService = require("../services/ndrService");
const labelGenerationService = require("../services/labelGenerationService");
const pickupSchedulingService = require("../services/pickupSchedulingService");

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
 * Resolve the outlet context for shipment creation.
 * - outlet role: uses own userId as outletId
 * - superadmin/admin: must provide outletId in body
 * - other roles: outletId is optional
 */
function resolveOutletContext(req) {
  const role = req.user.role;
  const userId = req.user.userId || req.user.id;
  const clientId = req.user.clientId;
  const bodyOutletId = req.body.outletId;
  // outletUserId from frontend is the outlet's phone number (external wallet API user ID)
  const bodyOutletUserId = req.body.outletUserId;

  if (role === "outlet") {
    // Outlet's phone from JWT token — used as wallet userId in external API
    const walletUserId = req.user.phone || userId;
    return { outletId: userId, clientId, walletUserId };
  }

  if (["superadmin", "admin"].includes(role)) {
    if (!bodyOutletId) {
      throw new ValidationError(
        "outletId is required when creating shipments as admin/superadmin",
      );
    }
    // bodyOutletUserId = outlet phone number passed from frontend for wallet operations
    if (!bodyOutletUserId) {
      throw new ValidationError(
        "outletUserId (phone) is required for wallet payment processing",
      );
    }
    return { outletId: bodyOutletId, clientId, walletUserId: bodyOutletUserId };
  }

  return {
    outletId: bodyOutletId || null,
    clientId,
    walletUserId: req.user.phone || userId,
  };
}

/**
 * Create a new shipment
 */
async function createShipment(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const {
      orderId,
      shipmentType = "B2C",
      shipmentDirection = "FORWARD",
      pickupAddressId,
      pickupAddress,
      deliveryAddress,
      rtoSameAsPickup = true,
      rtoAddress,
      productDescription,
      hsnCode,
      gstPercentage,
      packageDetails,
      numberOfBoxes = 1,
      boxes: boxesInput,
      invoices: invoicesInput,
      paymentType = "PREPAID",
      codAmount,
      serviceType = "STANDARD",
      specialInstructions,
      selectedPartnerId,
      quoteSnapshot,
    } = req.body;

    const { outletId, clientId, walletUserId } = resolveOutletContext(req);

    logger.info("Creating shipment", {
      service: "shipment-service",
      userId,
      clientId,
      outletId,
      orderId,
      shipmentType,
      paymentType,
      serviceType,
    });

    // Check for duplicate order ID within client
    const existingShipment = await prisma.shipment.findFirst({
      where: { orderId, clientId },
    });

    if (existingShipment) {
      throw new ConflictError(
        `Shipment with order ID ${orderId} already exists`,
      );
    }

    // Determine the selected partner. Use quoteSnapshot or fall back to live quote.
    let selectedCourier;
    let alternativeOptions = [];

    if (selectedPartnerId && quoteSnapshot) {
      selectedCourier = quoteSnapshot;
    } else {
      const rateCalculationParams = {
        fromPincode: pickupAddress.pincode,
        toPincode: deliveryAddress.pincode,
        weight: packageDetails.weight,
        serviceType: serviceType.toUpperCase(),
        dimensions: packageDetails.dimensions,
        codAmount: paymentType === "COD" ? codAmount : null,
        strategy: "cheapest",
      };

      const courierSelection =
        await partnerIntegrationService.selectOptimalCourier(
          rateCalculationParams,
        );
      selectedCourier = courierSelection.selectedCourier;
      alternativeOptions = courierSelection.alternativeOptions;
    }

    const totalCost = selectedCourier.totalAmount;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(
      estimatedDelivery.getDate() + (selectedCourier.deliveryDays || 5),
    );

    // Calculate volumetric weight: numberOfBoxes * (L*B*H) / divisor
    const divisor = selectedCourier.volumetricDivisor || 5000;
    const volWeight =
      (numberOfBoxes *
        packageDetails.dimensions.length *
        packageDetails.dimensions.width *
        packageDetails.dimensions.height) /
      divisor;
    const chargeableWeight = Math.max(packageDetails.weight, volWeight);

    // Wallet debit for PREPAID
    let walletTransactionId = null;
    let paymentReference = null;

    if (paymentType === "PREPAID") {
      try {
        const authToken = req.headers.authorization?.replace("Bearer ", "");
        const paymentResult =
          await paymentProcessingService.processShipmentPayment(
            walletUserId,
            totalCost,
            orderId,
            `Shipment charge for order ${orderId} - ${packageDetails.description || "Package"}`,
            authToken,
          );

        walletTransactionId = paymentResult.walletTransactionId;
        paymentReference = paymentResult.paymentReference;
      } catch (paymentError) {
        logger.error("Wallet payment failed", {
          service: "shipment-service",
          userId: walletUserId,
          orderId,
          amount: totalCost,
          error: paymentError.message,
        });

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

    // Build RTO address fields
    const rtoFields = rtoSameAsPickup
      ? {
          rtoSameAsPickup: true,
          rtoName: pickupAddress.name,
          rtoPhone: pickupAddress.phone,
          rtoLine1: pickupAddress.addressLine1,
          rtoLine2: pickupAddress.addressLine2,
          rtoLandmark: pickupAddress.landmark,
          rtoCity: pickupAddress.city,
          rtoState: pickupAddress.state,
          rtoPincode: pickupAddress.pincode,
          rtoCountry: pickupAddress.country || "India",
        }
      : {
          rtoSameAsPickup: false,
          rtoName: rtoAddress?.name,
          rtoPhone: rtoAddress?.phone,
          rtoLine1: rtoAddress?.addressLine1,
          rtoLine2: rtoAddress?.addressLine2,
          rtoLandmark: rtoAddress?.landmark,
          rtoCity: rtoAddress?.city,
          rtoState: rtoAddress?.state,
          rtoPincode: rtoAddress?.pincode,
          rtoCountry: rtoAddress?.country || "India",
        };

    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        clientId,
        userId,
        outletId,
        shipmentType,
        shipmentDirection,
        status: "CREATED",
        bookingStatus: "PENDING",
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

        pickupAddressId: pickupAddressId || null,
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

        ...rtoFields,

        productDescription: productDescription || null,
        hsnCode: hsnCode || null,
        gstPercentage: gstPercentage || null,

        numberOfBoxes,
        weight: packageDetails.weight,
        length: packageDetails.dimensions.length,
        width: packageDetails.dimensions.width,
        height: packageDetails.dimensions.height,
        volumetricWeight: volWeight,
        chargeableWeight,
        volumetricDivisor: divisor,
        description: packageDetails.description,
        value: packageDetails.value,
        fragile: packageDetails.fragile || false,

        serviceType,
        specialInstructions,

        partnerId: selectedCourier.partnerId,
        partnerName: selectedCourier.partnerName,
        quoteSnapshot: quoteSnapshot || selectedCourier,

        estimatedDelivery,

        walletTransactionId,
        paymentReference,
      },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        shipmentType: true,
        shipmentDirection: true,
        status: true,
        bookingStatus: true,
        paymentType: true,
        paymentStatus: true,
        codAmount: true,
        totalCost: true,
        currency: true,
        serviceType: true,
        partnerId: true,
        partnerName: true,
        chargeableWeight: true,
        volumetricWeight: true,
        estimatedDelivery: true,
        createdAt: true,
      },
    });

    // Create invoice records for B2B shipments
    if (invoicesInput && invoicesInput.length > 0) {
      await prisma.shipmentInvoice.createMany({
        data: invoicesInput.map((inv) => ({
          shipmentId: shipment.id,
          eWayBillNo: inv.eWayBillNo || null,
          invoiceNo: inv.invoiceNo,
          invoiceAmt: inv.invoiceAmt,
          invoiceDate: new Date(inv.invoiceDate),
          attachmentUrl: inv.attachmentUrl || null,
        })),
      });
    }

    // Create box dimension records for multi-box shipments
    if (boxesInput && boxesInput.length > 0) {
      await prisma.shipmentBox.createMany({
        data: boxesInput.map((box) => ({
          shipmentId: shipment.id,
          boxNumber: box.boxNumber,
          length: box.length,
          width: box.width,
          height: box.height,
        })),
      });
    }

    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: "CREATED",
        message: `Shipment created successfully with order ID ${orderId}`,
        eventMetadata: {
          orderId,
          paymentType,
          shipmentType,
          totalCost: totalCost.toString(),
          serviceType,
          partnerId: selectedCourier.partnerId,
          partnerName: selectedCourier.partnerName,
          outletId,
        },
        source: trackingService.EVENT_SOURCES.SYSTEM,
      },
      userId,
    );

    // Attempt courier booking via partner-service (non-blocking)
    let courierBookingResult = null;
    try {
      const authToken = req.headers.authorization?.replace("Bearer ", "");
      courierBookingResult = await partnerIntegrationService.bookWithCourier(
        selectedCourier.partnerId,
        {
          shipmentId: shipment.id,
          orderId,
          pickupAddress: {
            name: pickupAddress.name,
            phone: pickupAddress.phone,
            address: pickupAddress.addressLine1,
            city: pickupAddress.city,
            state: pickupAddress.state,
            pincode: pickupAddress.pincode,
          },
          deliveryAddress: {
            name: deliveryAddress.name,
            phone: deliveryAddress.phone,
            address: deliveryAddress.addressLine1,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            pincode: deliveryAddress.pincode,
          },
          packageDetails: {
            weight: chargeableWeight,
            length: packageDetails.dimensions?.length,
            width: packageDetails.dimensions?.width,
            height: packageDetails.dimensions?.height,
          },
          paymentType,
          codAmount: paymentType === "COD" ? codAmount : 0,
          productDescription: packageDetails.description || "Package",
          declaredValue: packageDetails.value || totalCost,
        },
        authToken,
      );

      if (courierBookingResult?.awbNumber) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            awbNumber: courierBookingResult.awbNumber,
            partnerShipmentId: courierBookingResult.partnerShipmentId || null,
            status: "BOOKED",
            bookingStatus: "BOOKED",
          },
        });

        shipment.awbNumber = courierBookingResult.awbNumber;
        shipment.status = "BOOKED";
        shipment.bookingStatus = "BOOKED";

        await trackingService.createTrackingEvent(
          shipment.id,
          {
            status: "BOOKED",
            message: `Shipment booked with courier. AWB: ${courierBookingResult.awbNumber}`,
            eventMetadata: {
              awbNumber: courierBookingResult.awbNumber,
              courierPartnerId: selectedCourier.partnerId,
            },
            source: trackingService.EVENT_SOURCES.PARTNER,
          },
          userId,
        );
      }
    } catch (courierError) {
      logger.warn("Courier booking failed - shipment created without AWB", {
        service: "shipment-service",
        shipmentId: shipment.id,
        partnerId: selectedCourier.partnerId,
        error: courierError.message,
      });

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { bookingStatus: "PENDING_BOOKING" },
      });
      shipment.bookingStatus = "PENDING_BOOKING";
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          orderId,
          shipmentType,
          outletId,
          paymentType,
          totalCost: totalCost.toString(),
          serviceType,
          awbNumber: courierBookingResult?.awbNumber || null,
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

    res.status(201).json(
      APIResponse.success(
        {
          shipment: {
            ...shipment,
            totalCost: parseFloat(shipment.totalCost),
            codAmount: shipment.codAmount
              ? parseFloat(shipment.codAmount)
              : null,
            chargeableWeight: shipment.chargeableWeight
              ? parseFloat(shipment.chargeableWeight)
              : null,
            volumetricWeight: shipment.volumetricWeight
              ? parseFloat(shipment.volumetricWeight)
              : null,
          },
          courierBooking: courierBookingResult
            ? {
                awbNumber: courierBookingResult.awbNumber,
                booked: true,
              }
            : {
                booked: false,
                message: "Courier booking pending - manual retry available",
              },
        },
        courierBookingResult?.awbNumber
          ? "Shipment created and booked successfully"
          : "Shipment created successfully (courier booking pending)",
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

    const {
      page = 1,
      limit = 20,
      status,
      paymentType,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    if (status) {
      where.status = status;
    }

    if (paymentType) {
      where.paymentType = paymentType;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { awbNumber: { contains: term, mode: "insensitive" } },
        { orderId: { contains: term, mode: "insensitive" } },
        { deliveryName: { contains: term, mode: "insensitive" } },
        { pickupName: { contains: term, mode: "insensitive" } },
        { deliveryCity: { contains: term, mode: "insensitive" } },
      ];
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

    where = authUtils.applyScopeFilter(req, where);

    // Get shipments with pagination
    const [shipments, totalCount] = await Promise.all([
      prisma.shipment.findMany({
        where,
        select: {
          id: true,
          orderId: true,
          shipmentType: true,
          status: true,
          paymentType: true,
          paymentStatus: true,
          codAmount: true,
          totalCost: true,
          currency: true,
          serviceType: true,
          weight: true,
          partnerId: true,
          partnerName: true,
          awbNumber: true,
          pickupName: true,
          pickupCity: true,
          pickupState: true,
          pickupPincode: true,
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

    const formattedShipments = shipments.map((shipment) => ({
      ...shipment,
      totalCost: parseFloat(shipment.totalCost),
      codAmount: shipment.codAmount ? parseFloat(shipment.codAmount) : null,
      weight: shipment.weight ? parseFloat(shipment.weight) : null,
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
    const { id } = req.params;

    // Build where clause with scope filtering for multi-tenant access
    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

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
    const { id } = req.params;
    const updateData = req.body;

    // Build where clause with scope filtering for multi-tenant access
    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

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
    const { id } = req.params;
    const { reason = "User requested cancellation" } = req.body;

    // Build where clause with scope filtering for multi-tenant access
    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

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
        awbNumber: true,
        partnerId: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    // Check if shipment can be cancelled
    if (!["CREATED", "BOOKED", "PICKED_UP"].includes(shipment.status)) {
      throw new ValidationError("Shipment cannot be cancelled at this stage");
    }

    // Attempt to cancel with courier if AWB exists (non-blocking)
    if (shipment.awbNumber && shipment.partnerId) {
      try {
        const authToken = req.headers.authorization?.replace("Bearer ", "");
        await partnerIntegrationService.cancelWithCourier(
          shipment.partnerId,
          shipment.awbNumber,
          reason,
          authToken,
        );
        logger.info("Courier cancellation successful", {
          service: "shipment-service",
          shipmentId: id,
          awbNumber: shipment.awbNumber,
        });
      } catch (courierCancelError) {
        logger.warn(
          "Courier cancellation failed - proceeding with internal cancellation",
          {
            service: "shipment-service",
            shipmentId: id,
            awbNumber: shipment.awbNumber,
            error: courierCancelError.message,
          },
        );
      }
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

    // Create tracking event for cancellation
    await trackingService.updateShipmentStatus(
      id,
      "CANCELLED",
      `Shipment cancelled: ${reason}`,
      {
        cancellationReason: reason,
        refundAmount: refundAmount > 0 ? refundAmount.toString() : null,
        refundProcessed: !!refundTransactionId,
        refundTransactionId,
      },
      userId,
    );

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

    const authToken = req.header("Authorization");
    const rateData = await partnerIntegrationService.calculateRates(
      rateParams,
      authToken,
    );

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

    const authToken = req.header("Authorization");
    const serviceabilityData =
      await partnerIntegrationService.checkServiceability(
        serviceabilityParams,
        authToken,
      );

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

/**
 * Get partner quotes for staged shipment creation.
 * Returns all available partner rates with charge breakdown and a recommended choice.
 */
async function getShipmentQuotes(req, res) {
  try {
    const userId = req.user.userId;
    const {
      fromPincode,
      toPincode,
      weight,
      numberOfBoxes = 1,
      dimensions,
      serviceType = "STANDARD",
      paymentType = "PREPAID",
      codAmount,
      shipmentType = "B2C",
    } = req.body;

    logger.info("Getting shipment quotes", {
      service: "shipment-service",
      userId,
      fromPincode,
      toPincode,
      weight,
      numberOfBoxes,
    });

    const rateParams = {
      fromPincode,
      toPincode,
      weight,
      serviceType: serviceType.toUpperCase(),
      dimensions,
      codAmount: paymentType === "COD" ? codAmount : null,
      declaredValue: req.body.declaredValue || req.body.shipmentValue || 0,
      paymentMode: paymentType,
      isFragile: req.body.isFragile || false,
      outletId: req.body.outletId || null,
      sortBy: req.body.sortBy || "cheapest",
    };

    const authToken = req.header("Authorization");

    const [rateData, serviceabilityData] = await Promise.all([
      partnerIntegrationService.calculateRates(rateParams, authToken),
      partnerIntegrationService.checkServiceability(rateParams, authToken),
    ]);

    const serviceableMap = new Map();
    if (Array.isArray(serviceabilityData)) {
      serviceabilityData.forEach((s) =>
        serviceableMap.set(s.partnerId, s.serviceable),
      );
    }

    const quotes = (rateData.rates || [])
      .filter((rate) => serviceableMap.get(rate.partnerId) !== false)
      .map((rate) => {
        const divisor = rate.volumetricDivisor || 5000;
        const volWeight =
          (numberOfBoxes *
            dimensions.length *
            dimensions.width *
            dimensions.height) /
          divisor;
        const chargeableWt = Math.max(weight, volWeight);

        // Normalize breakdown from partner-service to frontend-friendly format
        const BASE_LABELS = {
          WEIGHT: "Weight Charge",
          INVOICE_VALUE: "Invoice Value Charge",
          ZONE_TO_ZONE_WEIGHT: "Zone-to-Zone Charge",
          DISTANCE_BASE_WEIGHT: "Distance Charge",
        };

        const rawBreakdown =
          rate.breakdown || rate.chargesBreakdown || rate.chargeBreakdown || [];
        const chargeBreakdown = Array.isArray(rawBreakdown)
          ? rawBreakdown.map((entry) => {
              const rawName = entry.chargeTypeName || entry.base || "Charge";
              const isRawEnum = Object.keys(BASE_LABELS).includes(rawName);
              const label = isRawEnum ? BASE_LABELS[rawName] : rawName;

              return {
                name: label,
                amount: entry.totalCharge || 0,
                type: entry.base || null,
                calculation: entry.calculation || null,
              };
            })
          : [];

        return {
          partnerId: rate.partnerId,
          partnerName: rate.partnerName,
          totalAmount: rate.totalRate || rate.totalAmount || 0,
          deliveryDays: rate.deliveryDays || rate.estimatedDays || null,
          chargeBreakdown,
          volumetricDivisor: divisor,
          volumetricWeight: parseFloat(volWeight.toFixed(3)),
          chargeableWeight: parseFloat(chargeableWt.toFixed(3)),
          actualWeight: weight,
          serviceable: serviceableMap.get(rate.partnerId) !== false,
          ...(rate.discount && { discount: rate.discount }),
        };
      })
      .sort((a, b) => a.totalAmount - b.totalAmount);

    const recommended = quotes[0] || null;

    await prisma.auditLog.create({
      data: {
        userId,
        action: "GET_SHIPMENT_QUOTES",
        resource: "Shipment",
        metadata: {
          source: "shipment-service",
          fromPincode,
          toPincode,
          weight,
          numberOfBoxes,
          quotesReturned: quotes.length,
          shipmentType,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success({
        quotes,
        recommended,
        params: {
          fromPincode,
          toPincode,
          weight,
          numberOfBoxes,
          dimensions,
          serviceType,
          paymentType,
          shipmentType,
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to get shipment quotes", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to get shipment quotes",
          "QUOTE_FETCH_FAILED",
        ),
      );
  }
}

/**
 * Dispute re-rate: record courier-validated weight/dimensions, recalculate,
 * refund old amount, charge new amount, or put on hold if balance insufficient.
 */
async function rerateShipment(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const clientId = req.user.clientId;
    const { id } = req.params;
    const {
      disputedWeight,
      disputedLength,
      disputedWidth,
      disputedHeight,
      reason,
    } = req.body;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        userId: true,
        status: true,
        partnerId: true,
        partnerName: true,
        totalCost: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        numberOfBoxes: true,
        volumetricDivisor: true,
        paymentType: true,
        walletTransactionId: true,
        pickupPincode: true,
        deliveryPincode: true,
        serviceType: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    if (!["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(shipment.status)) {
      throw new ValidationError(
        "Shipment can only be re-rated in BOOKED, PICKED_UP, or IN_TRANSIT status",
      );
    }

    const oldCost = parseFloat(shipment.totalCost);
    const newWeight = disputedWeight || parseFloat(shipment.weight);
    const newLength = disputedLength || parseFloat(shipment.length);
    const newWidth = disputedWidth || parseFloat(shipment.width);
    const newHeight = disputedHeight || parseFloat(shipment.height);
    const divisor = parseFloat(shipment.volumetricDivisor) || 5000;
    const numBoxes = shipment.numberOfBoxes || 1;

    const newVolWeight =
      (numBoxes * newLength * newWidth * newHeight) / divisor;
    const newChargeableWeight = Math.max(newWeight, newVolWeight);

    // Recalculate rates with partner service
    let newCost = oldCost;
    try {
      const rateData = await partnerIntegrationService.calculateRates({
        fromPincode: shipment.pickupPincode,
        toPincode: shipment.deliveryPincode,
        weight: newChargeableWeight,
        serviceType: shipment.serviceType,
        dimensions: { length: newLength, width: newWidth, height: newHeight },
      });

      const partnerRate = (rateData.rates || []).find(
        (r) => r.partnerId === shipment.partnerId,
      );
      if (partnerRate) {
        newCost = partnerRate.totalAmount;
      }
    } catch (rateError) {
      logger.warn("Rate recalculation failed during re-rate, using old cost", {
        service: "shipment-service",
        shipmentId: id,
        error: rateError.message,
      });
    }

    const difference = newCost - oldCost;
    const authToken = req.headers.authorization?.replace("Bearer ", "");
    const walletTarget = shipment.outletId || shipment.userId;

    let refundTxId = null;
    let chargeTxId = null;
    let holdApplied = false;

    if (difference !== 0 && shipment.paymentType === "PREPAID") {
      // Refund the old amount first
      try {
        const refundResult =
          await paymentProcessingService.processShipmentRefund(
            walletTarget,
            oldCost,
            shipment.id,
            `Re-rate refund for shipment ${shipment.orderId}: ${reason}`,
            authToken,
          );
        refundTxId = refundResult.refundTransactionId;
      } catch (refundErr) {
        logger.error("Re-rate refund failed", {
          service: "shipment-service",
          shipmentId: id,
          error: refundErr.message,
        });
      }

      // Charge the new amount
      try {
        const chargeResult =
          await paymentProcessingService.processShipmentPayment(
            walletTarget,
            newCost,
            shipment.id,
            `Re-rate charge for shipment ${shipment.orderId}: ${reason}`,
            authToken,
          );
        chargeTxId = chargeResult.walletTransactionId;
      } catch (chargeErr) {
        logger.warn("Re-rate charge failed - putting shipment on hold", {
          service: "shipment-service",
          shipmentId: id,
          error: chargeErr.message,
        });
        holdApplied = true;
      }
    }

    const updateData = {
      disputeStatus: holdApplied ? "HOLD" : "RESOLVED",
      disputedWeight: newWeight,
      disputedLength: newLength,
      disputedWidth: newWidth,
      disputedHeight: newHeight,
      disputedCost: newCost,
      totalCost: holdApplied ? shipment.totalCost : newCost,
      chargeableWeight: newChargeableWeight,
      volumetricWeight: newVolWeight,
    };

    if (holdApplied) {
      updateData.status = "HOLD";
      updateData.holdReason = `Insufficient balance after re-rate. New charge: ₹${newCost}, Old charge: ₹${oldCost}. Reason: ${reason}`;
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        orderId: true,
        status: true,
        disputeStatus: true,
        totalCost: true,
        disputedCost: true,
        chargeableWeight: true,
        holdReason: true,
        updatedAt: true,
      },
    });

    // Record financial adjustment
    await prisma.shipmentFinancialAdjustment.create({
      data: {
        shipmentId: id,
        adjustmentType: "DISPUTE_RERATE",
        reason,
        oldAmount: oldCost,
        newAmount: newCost,
        difference,
        refundTransactionId: refundTxId,
        chargeTransactionId: chargeTxId,
        disputedWeight: newWeight,
        disputedLength: newLength,
        disputedWidth: newWidth,
        disputedHeight: newHeight,
        createdById: userId,
      },
    });

    await trackingService.createTrackingEvent(
      id,
      {
        status: holdApplied ? "HOLD" : "RERATE_RESOLVED",
        message: holdApplied
          ? `Shipment on hold: insufficient balance after re-rate (₹${oldCost} → ₹${newCost})`
          : `Shipment re-rated: ₹${oldCost} → ₹${newCost}`,
        eventMetadata: {
          reason,
          oldCost,
          newCost,
          difference,
          holdApplied,
          disputedWeight: newWeight,
          chargeableWeight: newChargeableWeight,
        },
        source: trackingService.EVENT_SOURCES.MANUAL,
      },
      userId,
    );

    await prisma.auditLog.create({
      data: {
        userId,
        action: "RERATE_SHIPMENT",
        resource: "Shipment",
        resourceId: id,
        changes: {
          reason,
          oldCost,
          newCost,
          difference,
          holdApplied,
          disputedWeight: newWeight,
          disputedLength: newLength,
          disputedWidth: newWidth,
          disputedHeight: newHeight,
        },
        metadata: { source: "shipment-service" },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    res.json(
      APIResponse.success(
        {
          shipment: {
            ...updatedShipment,
            totalCost: parseFloat(updatedShipment.totalCost),
            disputedCost: updatedShipment.disputedCost
              ? parseFloat(updatedShipment.disputedCost)
              : null,
            chargeableWeight: updatedShipment.chargeableWeight
              ? parseFloat(updatedShipment.chargeableWeight)
              : null,
          },
          financialImpact: {
            oldCost,
            newCost,
            difference,
            refundTransactionId: refundTxId,
            chargeTransactionId: chargeTxId,
            holdApplied,
          },
        },
        holdApplied
          ? "Shipment re-rated and placed on hold due to insufficient balance"
          : "Shipment re-rated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to re-rate shipment", {
      service: "shipment-service",
      shipmentId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
    });

    if (error instanceof NotFoundError) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to re-rate shipment", "RERATE_FAILED"));
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

/**
 * SHIP-005: Bulk Operations and Advanced Features
 */

/**
 * Process bulk shipments from CSV/Excel data
 */
async function processBulkShipments(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const { bulkData, options = {} } = req.body;

    logger.info("Processing bulk shipments", {
      service: "shipment-service",
      userId,
      clientId,
      totalRecords: bulkData.length,
    });

    // Validate bulk data
    if (!Array.isArray(bulkData) || bulkData.length === 0) {
      throw new ValidationError("Bulk data must be a non-empty array");
    }

    if (bulkData.length > 1000) {
      throw new ValidationError(
        "Maximum 1000 shipments allowed per bulk operation",
      );
    }

    // Process bulk shipments
    const result = await bulkProcessingService.processBulkShipments(
      bulkData,
      userId,
      clientId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          result,
          "Bulk shipments processed successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Bulk shipments processing error:", error);
    throw error;
  }
}

/**
 * Get bulk job status
 */
async function getBulkJobStatus(req, res) {
  try {
    const { jobId } = req.params;

    logger.info("Getting bulk job status", {
      service: "shipment-service",
      jobId,
      userId: req.user.userId,
    });

    const jobStatus = await bulkProcessingService.getBulkJobStatus(jobId);

    res
      .status(200)
      .json(
        APIResponse.success(
          jobStatus,
          "Bulk job status retrieved successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Get bulk job status error:", error);
    throw error;
  }
}

/**
 * Create NDR case
 */
async function createNDRCase(req, res) {
  try {
    const { shipmentId } = req.params;
    const userId = req.user.userId;
    const ndrData = req.body;

    logger.info("Creating NDR case", {
      service: "shipment-service",
      shipmentId,
      userId,
      reason: ndrData.reason,
    });

    const ndrCase = await ndrService.createNDRCase(shipmentId, ndrData, userId);

    res
      .status(201)
      .json(APIResponse.success(ndrCase, "NDR case created successfully", 201));
  } catch (error) {
    logger.error("Create NDR case error:", error);
    throw error;
  }
}

/**
 * Get NDR cases with filtering
 */
async function getNDRCases(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const filters = { ...req.query };

    // Add client filter for multi-tenant support
    if (clientId && req.user.role !== "admin") {
      filters.clientId = clientId;
    }

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Getting NDR cases", {
      service: "shipment-service",
      userId,
      clientId,
      filters,
    });

    const result = await ndrService.getNDRCases(filters, pagination);

    res
      .status(200)
      .json(
        APIResponse.success(result, "NDR cases retrieved successfully", 200),
      );
  } catch (error) {
    logger.error("Get NDR cases error:", error);
    throw error;
  }
}

/**
 * Take action on NDR case
 */
async function takeNDRAction(req, res) {
  try {
    const { ndrCaseId } = req.params;
    const userId = req.user.userId;
    const actionData = req.body;

    logger.info("Taking NDR action", {
      service: "shipment-service",
      ndrCaseId,
      action: actionData.action,
      userId,
    });

    const updatedCase = await ndrService.takeNDRAction(
      ndrCaseId,
      actionData,
      userId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          updatedCase,
          `NDR action '${actionData.action}' completed successfully`,
          200,
        ),
      );
  } catch (error) {
    logger.error("Take NDR action error:", error);
    throw error;
  }
}

/**
 * Generate shipping label
 */
async function generateShippingLabel(req, res) {
  try {
    const { shipmentId } = req.params;
    const userId = req.user.userId;
    const labelOptions = req.body;

    logger.info("Generating shipping label", {
      service: "shipment-service",
      shipmentId,
      userId,
      format: labelOptions.format,
    });

    const result = await labelGenerationService.generateShippingLabel(
      shipmentId,
      labelOptions,
      userId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          result,
          "Shipping label generated successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Generate shipping label error:", error);
    throw error;
  }
}

/**
 * Generate bulk labels
 */
async function generateBulkLabels(req, res) {
  try {
    const userId = req.user.userId;
    const { shipmentIds, labelOptions = {} } = req.body;

    logger.info("Generating bulk labels", {
      service: "shipment-service",
      userId,
      shipmentCount: shipmentIds.length,
    });

    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      throw new ValidationError("shipmentIds must be a non-empty array");
    }

    const result = await labelGenerationService.generateBulkLabels(
      shipmentIds,
      labelOptions,
      userId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(result, "Bulk labels generated successfully", 200),
      );
  } catch (error) {
    logger.error("Generate bulk labels error:", error);
    throw error;
  }
}

/**
 * Create manifest
 */
async function createManifest(req, res) {
  try {
    const userId = req.user.userId;
    const manifestData = req.body;

    logger.info("Creating manifest", {
      service: "shipment-service",
      userId,
      partnerId: manifestData.partnerId,
      shipmentCount: manifestData.shipmentIds.length,
    });

    const result = await labelGenerationService.createManifest(
      manifestData,
      userId,
    );

    res
      .status(201)
      .json(APIResponse.success(result, "Manifest created successfully", 201));
  } catch (error) {
    logger.error("Create manifest error:", error);
    throw error;
  }
}

/**
 * Schedule pickup
 */
async function schedulePickup(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const pickupData = req.body;

    logger.info("Scheduling pickup", {
      service: "shipment-service",
      userId,
      clientId,
      partnerId: pickupData.partnerId,
      shipmentCount: pickupData.shipmentIds?.length || 0,
    });

    const result = await pickupSchedulingService.schedulePickup(
      pickupData,
      userId,
      clientId,
    );

    res
      .status(201)
      .json(APIResponse.success(result, "Pickup scheduled successfully", 201));
  } catch (error) {
    logger.error("Schedule pickup error:", error);
    throw error;
  }
}

/**
 * Get pickup schedules
 */
async function getPickupSchedules(req, res) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const filters = { ...req.query };

    // Add client filter for multi-tenant support
    if (clientId && req.user.role !== "admin") {
      filters.clientId = clientId;
    }

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "scheduledDate",
      sortOrder: req.query.sortOrder || "asc",
    };

    logger.info("Getting pickup schedules", {
      service: "shipment-service",
      userId,
      clientId,
      filters,
    });

    const result = await pickupSchedulingService.getPickupSchedules(
      filters,
      pagination,
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          result,
          "Pickup schedules retrieved successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Get pickup schedules error:", error);
    throw error;
  }
}

/**
 * Update pickup status
 */
async function updatePickupStatus(req, res) {
  try {
    const { pickupScheduleId } = req.params;
    const userId = req.user.userId;
    const statusData = req.body;

    logger.info("Updating pickup status", {
      service: "shipment-service",
      pickupScheduleId,
      newStatus: statusData.status,
      userId,
    });

    const result = await pickupSchedulingService.updatePickupStatus(
      pickupScheduleId,
      statusData,
      userId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(result, "Pickup status updated successfully", 200),
      );
  } catch (error) {
    logger.error("Update pickup status error:", error);
    throw error;
  }
}

/**
 * Cancel pickup
 */
async function cancelPickup(req, res) {
  try {
    const { pickupScheduleId } = req.params;
    const userId = req.user.userId;
    const { cancellationReason } = req.body;

    logger.info("Cancelling pickup", {
      service: "shipment-service",
      pickupScheduleId,
      cancellationReason,
      userId,
    });

    const result = await pickupSchedulingService.cancelPickup(
      pickupScheduleId,
      cancellationReason,
      userId,
    );

    res
      .status(200)
      .json(APIResponse.success(result, "Pickup cancelled successfully", 200));
  } catch (error) {
    logger.error("Cancel pickup error:", error);
    throw error;
  }
}

/**
 * Get available time slots
 */
async function getAvailableTimeSlots(req, res) {
  try {
    const { date, partnerId } = req.query;

    if (!date) {
      throw new ValidationError("Date parameter is required");
    }

    logger.info("Getting available time slots", {
      service: "shipment-service",
      date,
      partnerId,
      userId: req.user.userId,
    });

    const result = await pickupSchedulingService.getAvailableTimeSlots(
      date,
      partnerId,
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          result,
          "Available time slots retrieved successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Get available time slots error:", error);
    throw error;
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
  getShipmentQuotes,
  rerateShipment,
  // SHIP-004 endpoints
  trackByAwbNumber,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
  // SHIP-005: Bulk Operations and Advanced Features
  processBulkShipments,
  getBulkJobStatus,
  createNDRCase,
  getNDRCases,
  takeNDRAction,
  generateShippingLabel,
  generateBulkLabels,
  createManifest,
  schedulePickup,
  getPickupSchedules,
  updatePickupStatus,
  cancelPickup,
  getAvailableTimeSlots,
};
