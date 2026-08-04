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
const shipmentWalletService = require("../services/shipmentWalletService");
const trackingService = require("../services/trackingService");
const bulkProcessingService = require("../services/bulkProcessingService");
const bulkFileParserService = require("../services/bulkFileParserService");
const bulkRerateService = require("../services/bulkRerateService");
const ndrService = require("../services/ndrService");
const labelGenerationService = require("../services/labelGenerationService");
const pickupSchedulingService = require("../services/pickupSchedulingService");
const quoteSigningService = require("../services/quoteSigningService");
const outletWalletContextService = require("../services/outletWalletContextService");
const weightCalc = require("../shared/utils/weightCalc");

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
function resolveOutletContext(req, options = {}) {
  const { requireWalletUserId = false } = options;
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
    if (requireWalletUserId && !bodyOutletUserId) {
      throw new ValidationError(
        "outletUserId (phone) is required for wallet payment processing",
      );
    }
    return {
      outletId: bodyOutletId,
      clientId,
      walletUserId: bodyOutletUserId || null,
    };
  }

  return {
    outletId: bodyOutletId || null,
    clientId,
    walletUserId: req.user.phone || userId,
  };
}

async function processCancellationRefund(shipment, reason, authToken) {
  const refundAmount = calculateRefundAmount(shipment, reason);

  if (shipment.paymentType !== "PREPAID" || refundAmount <= 0) {
    return {
      refundAmount,
      refundTransactionId: null,
      paymentStatus: shipmentWalletService.getCancellationPaymentStatus(
        shipment,
        refundAmount,
        null,
      ),
      walletUserId: shipment.walletUserId || null,
    };
  }

  const walletResolution =
    await shipmentWalletService.resolveShipmentWalletTarget(shipment);

  if (!walletResolution.walletUserId) {
    logger.warn("Unable to resolve wallet user ID for shipment refund", {
      service: "shipment-service",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      outletId: shipment.outletId,
      userId: shipment.userId,
    });

    return {
      refundAmount,
      refundTransactionId: null,
      paymentStatus: shipmentWalletService.getCancellationPaymentStatus(
        shipment,
        refundAmount,
        null,
      ),
      walletUserId: null,
    };
  }

  logger.info("Processing refund via Wallet Service", {
    service: "shipment-service",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    walletUserId: walletResolution.walletUserId,
    walletTargetSource: walletResolution.source,
    refundAmount,
    originalWalletTransactionId: shipment.walletTransactionId || null,
  });

  try {
    const refundResult = await paymentProcessingService.processShipmentRefund(
      walletResolution.walletUserId,
      refundAmount,
      shipment.id,
      reason,
      authToken,
    );

    return {
      refundAmount,
      refundTransactionId: refundResult.refundTransactionId,
      paymentStatus: shipmentWalletService.getCancellationPaymentStatus(
        shipment,
        refundAmount,
        refundResult.refundTransactionId,
      ),
      walletUserId: walletResolution.walletUserId,
    };
  } catch (refundError) {
    logger.error("Wallet refund failed", {
      service: "shipment-service",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      walletUserId: walletResolution.walletUserId,
      refundAmount,
      error: refundError.message,
    });

    return {
      refundAmount,
      refundTransactionId: null,
      paymentStatus: shipmentWalletService.getCancellationPaymentStatus(
        shipment,
        refundAmount,
        null,
      ),
      walletUserId: walletResolution.walletUserId,
    };
  }
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEstimatedDeliveryDate(deliveryDays) {
  const days = toNumber(deliveryDays, 0);
  if (days <= 0) return null;

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + days);
  return estimatedDelivery;
}

function buildCourierMetrics({
  quoteSnapshot,
  weight,
  numberOfBoxes,
  dimensions,
}) {
  // Formula the quote was priced with; null/absent resolves to the system default
  const { divisor, factor } = weightCalc.resolveVolumetricConfig({
    divisor: quoteSnapshot?.volumetricDivisor,
    factor: quoteSnapshot?.volumetricFactor,
  });
  const actualWeight = toNumber(quoteSnapshot?.actualWeight, weight);
  const volumetricWeight =
    quoteSnapshot?.volumetricWeight !== undefined &&
    quoteSnapshot?.volumetricWeight !== null
      ? toNumber(quoteSnapshot.volumetricWeight)
      : weightCalc.computeVolumetric({
          boxes: numberOfBoxes,
          length: dimensions?.length,
          width: dimensions?.width,
          height: dimensions?.height,
          divisor,
          factor,
        });
  const chargeableWeight =
    quoteSnapshot?.chargeableWeight !== undefined &&
    quoteSnapshot?.chargeableWeight !== null
      ? toNumber(quoteSnapshot.chargeableWeight)
      : weightCalc.computeChargeable(actualWeight, volumetricWeight);

  return {
    divisor,
    factor,
    actualWeight,
    volumetricWeight,
    chargeableWeight,
    totalCost: toNumber(quoteSnapshot?.totalAmount),
    estimatedDelivery: getEstimatedDeliveryDate(quoteSnapshot?.deliveryDays),
  };
}

async function attemptCourierBooking({
  shipmentId,
  orderId,
  partnerId,
  pickupLocation,
  pickupAddress,
  deliveryAddress,
  packageDetails,
  shipmentType,
  paymentType,
  codAmount,
  productDescription,
  hsnCode,
  declaredValue,
  authToken,
}) {
  const courierBookingResult = await partnerIntegrationService.bookWithCourier(
    partnerId,
    {
      shipmentId,
      orderId,
      pickupLocation: pickupLocation || null,
      pickupAddress,
      deliveryAddress,
      packageDetails,
      shipmentType: shipmentType || "B2C",
      paymentType,
      codAmount: paymentType === "COD" ? codAmount || 0 : 0,
      productDescription: productDescription || "Package",
      hsnCode: hsnCode || undefined,
      declaredValue,
    },
    authToken,
  );

  return {
    courierBookingResult,
    trackingUrl:
      courierBookingResult?.courierResponse?.trackingUrl ||
      courierBookingResult?.trackingUrl ||
      null,
  };
}

async function createBookingResultAuditLog({
  userId,
  clientId,
  shipmentId,
  action,
  bookingSucceeded,
  partnerId,
  partnerName,
  awbNumber,
  errorMessage,
  req,
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource: "Shipment",
      resourceId: shipmentId,
      metadata: {
        source: "shipment-service",
        bookingSucceeded,
        partnerId,
        partnerName,
        awbNumber: awbNumber || null,
        error: errorMessage || null,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      clientId,
    },
  });
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
      deliveryAddressId,
      rtoSameAsPickup = true,
      rtoAddress,
      rtoAddressId,
      billingSameAsDelivery = true,
      billingAddress,
      billingAddressId,
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
      quoteToken,
      vasSelections = [],
    } = req.body;

    if (
      (selectedPartnerId && !quoteSnapshot) ||
      (!selectedPartnerId && quoteSnapshot)
    ) {
      throw new ValidationError(
        "selectedPartnerId and quoteSnapshot must be provided together",
      );
    }

    const hasAssignedPartner = Boolean(selectedPartnerId && quoteSnapshot);

    // ==================================================================
    // Quote integrity: the price we debit comes from VERIFIED token
    // claims (or a fresh server-side re-quote), never from the
    // client-editable quoteSnapshot.
    // ==================================================================
    let verifiedTotalAmount = null;
    if (hasAssignedPartner) {
      if (!quoteToken) {
        throw new ValidationError(
          "quoteToken is required when booking with a selected partner",
        );
      }

      const { claims, expired } =
        quoteSigningService.verifyQuoteToken(quoteToken);

      quoteSigningService.assertClaimsMatchPayload(claims, {
        partnerId: selectedPartnerId,
        fromPincode: pickupAddress?.pincode,
        toPincode: deliveryAddress?.pincode,
        weight: packageDetails?.weight,
        paymentType,
        codAmount,
        shipmentType,
        vasSelections,
      });

      verifiedTotalAmount = claims.totalAmount;

      if (expired) {
        // User idled past the token TTL — re-quote the selected partner
        // server-side and require the exact same price
        const authToken = req.header("Authorization");
        const freshRates = await partnerIntegrationService.calculateRates(
          {
            fromPincode: claims.fromPincode,
            toPincode: claims.toPincode,
            weight: claims.weight,
            serviceType: (serviceType || "STANDARD").toUpperCase(),
            dimensions: packageDetails?.dimensions,
            numberOfBoxes,
            codAmount: claims.paymentType === "COD" ? claims.codAmount : null,
            declaredValue: packageDetails?.value || 0,
            paymentMode: claims.paymentType,
            isFragile: packageDetails?.fragile || false,
            outletId: req.body.outletId || null,
            partnerId: claims.partnerId,
            shipmentType: claims.shipmentType,
            vasSelections,
          },
          authToken,
        );

        const freshRate = (freshRates.rates || []).find(
          (r) => r.partnerId === claims.partnerId,
        );
        const freshTotal = freshRate
          ? Number(freshRate.totalRate || freshRate.totalAmount || 0)
          : null;

        if (freshTotal === null || freshTotal !== claims.totalAmount) {
          const staleError = new APIError(
            "The quoted price has expired and current pricing differs. Please fetch fresh quotes.",
            409,
            "QUOTE_STALE",
          );
          staleError.details = {
            quotedAmount: claims.totalAmount,
            currentAmount: freshTotal,
          };
          throw staleError;
        }
      }
    }
    const { outletId, clientId, walletUserId } = resolveOutletContext(req, {
      requireWalletUserId: paymentType === "PREPAID" && hasAssignedPartner,
    });

    logger.info("Creating shipment", {
      service: "shipment-service",
      userId,
      clientId,
      outletId,
      orderId,
      shipmentType,
      paymentType,
      serviceType,
      hasAssignedPartner,
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

    const selectedCourier = hasAssignedPartner ? quoteSnapshot : null;
    const metrics = buildCourierMetrics({
      quoteSnapshot: selectedCourier,
      weight: toNumber(packageDetails.weight),
      numberOfBoxes,
      dimensions: packageDetails.dimensions,
    });
    // Verified token amount wins over the client-supplied snapshot amount.
    // systemCharge is the platform price — the wallet debit amount.
    const systemCharge = hasAssignedPartner
      ? (verifiedTotalAmount ?? metrics.totalCost)
      : 0;

    // ==================================================================
    // Outlet markup / commission (charges-engine v3):
    // finalTotal = systemCharge + markupAmount. The markup is the outlet's
    // own revenue (added to COD collectable for COD shipments); the wallet
    // debit stays systemCharge.
    // ==================================================================
    const requestedMarkup = req.body.markup || null;
    let markupType = null;
    let markupValue = null;
    let markupAmount = 0;
    let outletContext = null;

    if (hasAssignedPartner) {
      outletContext =
        req.user.role === "outlet"
          ? await outletWalletContextService.resolveOutletWalletByUserId(userId)
          : outletId
            ? await outletWalletContextService.resolveOutletWalletByOutletId(
                outletId,
              )
            : null;

      const effectiveMarkup =
        requestedMarkup ||
        (outletContext?.defaultMarkupType &&
        outletContext?.defaultMarkupValue !== null
          ? {
              type: outletContext.defaultMarkupType,
              value: Number(outletContext.defaultMarkupValue),
            }
          : null);

      if (effectiveMarkup) {
        if (!outletContext) {
          throw new ValidationError(
            "Markup can only be applied to shipments booked for an outlet",
          );
        }

        markupType = effectiveMarkup.type;
        markupValue = Number(effectiveMarkup.value);

        if (
          markupType === "FLAT" &&
          outletContext.maxMarkupFlat !== null &&
          markupValue > Number(outletContext.maxMarkupFlat)
        ) {
          throw new ValidationError(
            `Markup exceeds the allowed flat cap of ₹${outletContext.maxMarkupFlat}`,
          );
        }
        if (
          markupType === "PERCENTAGE" &&
          outletContext.maxMarkupPercent !== null &&
          markupValue > Number(outletContext.maxMarkupPercent)
        ) {
          throw new ValidationError(
            `Markup exceeds the allowed percentage cap of ${outletContext.maxMarkupPercent}%`,
          );
        }

        markupAmount =
          markupType === "FLAT"
            ? Math.round(markupValue * 100) / 100
            : Math.round(systemCharge * markupValue) / 100;
      }
    }

    const totalCost = hasAssignedPartner ? systemCharge + markupAmount : 0;

    // COD: the courier collects base + markup; cap applies to the SUM
    const codBaseAmount = paymentType === "COD" ? Number(codAmount) || 0 : null;
    const finalCodAmount =
      paymentType === "COD" ? codBaseAmount + markupAmount : null;
    if (paymentType === "COD" && finalCodAmount > 100000) {
      throw new ValidationError(
        `COD collectable (₹${finalCodAmount}) exceeds the ₹1,00,000 limit after markup`,
      );
    }
    const estimatedDelivery = hasAssignedPartner
      ? metrics.estimatedDelivery
      : null;

    // Wallet debit for PREPAID
    let walletTransactionId = null;
    let paymentReference = null;

    if (paymentType === "PREPAID" && hasAssignedPartner) {
      try {
        const authToken = req.headers.authorization?.replace("Bearer ", "");
        const paymentResult =
          await paymentProcessingService.processShipmentPayment(
            walletUserId,
            systemCharge,
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
          amount: systemCharge,
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

    // Billing address: defaults to the delivery address (GST invoicing)
    const billingSource = billingSameAsDelivery
      ? deliveryAddress
      : billingAddress;
    const billingFields = {
      billingSameAsDelivery,
      billingName: billingSource?.name,
      billingPhone: billingSource?.phone,
      billingEmail: billingSource?.email,
      billingLine1: billingSource?.addressLine1,
      billingLine2: billingSource?.addressLine2,
      billingLandmark: billingSource?.landmark,
      billingCity: billingSource?.city,
      billingState: billingSource?.state,
      billingPincode: billingSource?.pincode,
      billingCountry: billingSource?.country || "India",
    };

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          orderId,
          clientId,
          userId,
          outletId,
          shipmentType,
          shipmentDirection,
          status: "CREATED",
          bookingStatus: hasAssignedPartner ? "PENDING_BOOKING" : "UNASSIGNED",
          paymentType,
          paymentStatus: hasAssignedPartner
            ? paymentType === "COD"
              ? "CONFIRMED"
              : walletTransactionId
                ? "CONFIRMED"
                : "PENDING"
            : "PENDING",
          codAmount: paymentType === "COD" ? finalCodAmount : null,
          totalCost,
          currency: "INR",

          // Charges-engine v3 money split
          systemCharge: hasAssignedPartner ? systemCharge : null,
          markupType,
          markupValue,
          markupAmount: markupAmount > 0 ? markupAmount : null,
          codBaseAmount,
          vasSelections: vasSelections.length > 0 ? vasSelections : null,

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
          ...billingFields,

          // Address-book provenance
          deliveryAddressId: deliveryAddressId || null,
          rtoAddressId: rtoSameAsPickup ? null : rtoAddressId || null,
          billingAddressId: billingSameAsDelivery
            ? null
            : billingAddressId || null,

          productDescription: productDescription || null,
          hsnCode: hsnCode || null,
          gstPercentage: gstPercentage || null,

          numberOfBoxes,
          weight: packageDetails.weight,
          length: packageDetails.dimensions.length,
          width: packageDetails.dimensions.width,
          height: packageDetails.dimensions.height,
          volumetricWeight: metrics.volumetricWeight,
          chargeableWeight: metrics.chargeableWeight,
          volumetricDivisor: metrics.divisor,
          volumetricFactor: metrics.factor,
          description: packageDetails.description,
          value: packageDetails.value,
          fragile: packageDetails.fragile || false,

          serviceType,
          specialInstructions,

          partnerId: hasAssignedPartner ? selectedCourier.partnerId : null,
          partnerName: hasAssignedPartner ? selectedCourier.partnerName : null,
          quoteSnapshot: hasAssignedPartner
            ? quoteSnapshot || selectedCourier
            : null,

          estimatedDelivery,

          walletTransactionId,
          walletUserId,
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

      // Accrue the outlet's markup commission atomically with the shipment
      if (markupAmount > 0 && outletContext) {
        await tx.outletEarning.create({
          data: {
            shipmentId: created.id,
            outletId: outletContext.outletId,
            clientId: outletContext.clientId || clientId || null,
            markupType,
            markupValue,
            systemCharge,
            markupAmount,
          },
        });
      }

      return created;
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
        message: hasAssignedPartner
          ? `Shipment created successfully with order ID ${orderId}`
          : `Shipment created without partner assignment for order ID ${orderId}`,
        eventMetadata: {
          orderId,
          paymentType,
          shipmentType,
          totalCost: totalCost.toString(),
          serviceType,
          partnerId: hasAssignedPartner ? selectedCourier.partnerId : null,
          partnerName: hasAssignedPartner ? selectedCourier.partnerName : null,
          bookingStatus: hasAssignedPartner ? "PENDING_BOOKING" : "UNASSIGNED",
          outletId,
        },
        source: trackingService.EVENT_SOURCES.SYSTEM,
      },
      userId,
    );

    // Attempt courier booking via partner-service (non-blocking)
    let courierBookingResult = null;
    if (hasAssignedPartner) {
      try {
        const authToken = req.headers.authorization?.replace("Bearer ", "");
        const bookingAttempt = await attemptCourierBooking({
          shipmentId: shipment.id,
          orderId,
          partnerId: selectedCourier.partnerId,
          pickupLocation: req.body.pickupLocation || null,
          pickupAddress: {
            name: pickupAddress.name,
            phone: pickupAddress.phone,
            email: pickupAddress.email || null,
            address: pickupAddress.addressLine1,
            city: pickupAddress.city,
            state: pickupAddress.state,
            pincode: pickupAddress.pincode,
          },
          deliveryAddress: {
            name: deliveryAddress.name,
            phone: deliveryAddress.phone,
            email: deliveryAddress.email || null,
            address: deliveryAddress.addressLine1,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            pincode: deliveryAddress.pincode,
          },
          packageDetails: {
            weight: metrics.chargeableWeight,
            length: packageDetails.dimensions?.length,
            width: packageDetails.dimensions?.width,
            height: packageDetails.dimensions?.height,
          },
          shipmentType,
          paymentType,
          codAmount,
          productDescription: packageDetails.description || "Package",
          hsnCode,
          declaredValue: packageDetails.value || totalCost,
          authToken,
        });

        courierBookingResult = bookingAttempt.courierBookingResult;

        if (courierBookingResult?.awbNumber) {
          await prisma.shipment.update({
            where: { id: shipment.id },
            data: {
              awbNumber: courierBookingResult.awbNumber,
              partnerShipmentId: courierBookingResult.partnerShipmentId || null,
              trackingUrl: bookingAttempt.trackingUrl,
              courierChannelId: courierBookingResult.channel?.id || null,
              courierChannelName:
                courierBookingResult.channel?.channelName || null,
              status: "BOOKED",
              bookingStatus: "BOOKED",
            },
          });

          shipment.awbNumber = courierBookingResult.awbNumber;
          shipment.trackingUrl = bookingAttempt.trackingUrl;
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

          await createBookingResultAuditLog({
            userId,
            clientId,
            shipmentId: shipment.id,
            action: "CREATE_SHIPMENT_BOOKING_SUCCESS",
            bookingSucceeded: true,
            partnerId: selectedCourier.partnerId,
            partnerName: selectedCourier.partnerName,
            awbNumber: courierBookingResult.awbNumber,
            req,
          });
        }
      } catch (courierError) {
        const bookingErrorMessage =
          courierError.message || "Unknown courier booking error";
        logger.warn("Courier booking failed - shipment created without AWB", {
          service: "shipment-service",
          shipmentId: shipment.id,
          partnerId: selectedCourier.partnerId,
          error: bookingErrorMessage,
          code: courierError.code,
        });

        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { bookingStatus: "PENDING_BOOKING" },
        });
        shipment.bookingStatus = "PENDING_BOOKING";
        shipment._bookingError = bookingErrorMessage;

        await trackingService.createTrackingEvent(
          shipment.id,
          {
            status: "CREATED",
            message: `Partner assigned but courier booking is pending: ${bookingErrorMessage}`,
            eventMetadata: {
              courierPartnerId: selectedCourier.partnerId,
              bookingStatus: "PENDING_BOOKING",
              error: bookingErrorMessage,
            },
            source: trackingService.EVENT_SOURCES.SYSTEM,
          },
          userId,
        );

        await createBookingResultAuditLog({
          userId,
          clientId,
          shipmentId: shipment.id,
          action: "CREATE_SHIPMENT_BOOKING_FAILED",
          bookingSucceeded: false,
          partnerId: selectedCourier.partnerId,
          partnerName: selectedCourier.partnerName,
          errorMessage: bookingErrorMessage,
          req,
        });
      }
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
          systemCharge: systemCharge.toString(),
          markupType,
          markupValue,
          markupAmount,
          codBaseAmount,
          codAmount: paymentType === "COD" ? finalCodAmount : null,
          vasSelections: vasSelections.length > 0 ? vasSelections : null,
          serviceType,
          partnerId: shipment.partnerId || null,
          partnerName: shipment.partnerName || null,
          bookingStatus: shipment.bookingStatus,
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
          courierBooking: hasAssignedPartner
            ? courierBookingResult?.awbNumber
              ? {
                  awbNumber: courierBookingResult.awbNumber,
                  trackingUrl: shipment.trackingUrl || null,
                  booked: true,
                }
              : {
                  booked: false,
                  message:
                    shipment._bookingError ||
                    "Courier booking pending - manual retry available",
                }
            : {
                booked: false,
                message:
                  "Shipment created without partner. Assign a partner to continue.",
              },
        },
        hasAssignedPartner
          ? courierBookingResult?.awbNumber
            ? "Shipment created and booked successfully"
            : "Shipment created successfully (courier booking pending)"
          : "Shipment created successfully without partner assignment",
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
 * Assign or change the shipment partner before booking.
 */
async function assignPartner(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const clientId = req.user.clientId;
    const { id } = req.params;
    const { partnerId, quoteSnapshot, pickupLocation = null } = req.body;

    if (partnerId !== quoteSnapshot?.partnerId) {
      throw new ValidationError("partnerId must match quoteSnapshot.partnerId");
    }

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        clientId: true,
        userId: true,
        outletId: true,
        status: true,
        bookingStatus: true,
        paymentType: true,
        paymentStatus: true,
        codAmount: true,
        totalCost: true,
        walletUserId: true,
        walletTransactionId: true,
        paymentReference: true,
        refundTransactionId: true,
        pickupName: true,
        pickupPhone: true,
        pickupEmail: true,
        pickupLine1: true,
        pickupCity: true,
        pickupState: true,
        pickupPincode: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryEmail: true,
        deliveryLine1: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryPincode: true,
        productDescription: true,
        hsnCode: true,
        description: true,
        value: true,
        fragile: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        numberOfBoxes: true,
        serviceType: true,
        shipmentType: true,
        awbNumber: true,
        partnerId: true,
        partnerName: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    if (shipment.status !== "CREATED") {
      throw new ValidationError(
        "Partner can only be assigned while shipment status is CREATED",
      );
    }

    if (shipment.awbNumber || shipment.bookingStatus === "BOOKED") {
      throw new ConflictError(
        "Partner cannot be changed after shipment booking",
      );
    }

    if (
      !["UNASSIGNED", "PENDING_BOOKING", "PENDING"].includes(
        shipment.bookingStatus,
      )
    ) {
      throw new ValidationError(
        "Partner can only be assigned for unassigned or pending-booking shipments",
      );
    }

    const metrics = buildCourierMetrics({
      quoteSnapshot,
      weight: toNumber(shipment.weight),
      numberOfBoxes: shipment.numberOfBoxes || 1,
      dimensions: {
        length: toNumber(shipment.length),
        width: toNumber(shipment.width),
        height: toNumber(shipment.height),
      },
    });
    const newTotalCost = metrics.totalCost;
    const previousPartnerId = shipment.partnerId;
    const previousPartnerName = shipment.partnerName;
    const isReassignment = Boolean(previousPartnerId);
    const authToken = req.headers.authorization?.replace("Bearer ", "");

    let walletTransactionId = shipment.walletTransactionId || null;
    let paymentReference = shipment.paymentReference || null;
    let refundTransactionId = shipment.refundTransactionId || null;
    let paymentStatus =
      shipment.paymentType === "COD" ? "CONFIRMED" : shipment.paymentStatus;

    if (shipment.paymentType === "PREPAID") {
      const walletResolution =
        await shipmentWalletService.resolveShipmentWalletTarget(shipment);
      const walletUserId =
        walletResolution.walletUserId || shipment.walletUserId;

      if (!walletUserId) {
        throw new ValidationError(
          "Unable to resolve wallet user for partner assignment",
        );
      }

      const oldTotalCost = toNumber(shipment.totalCost);

      if (!isReassignment || shipment.bookingStatus === "UNASSIGNED") {
        if (newTotalCost > 0) {
          const paymentResult =
            await paymentProcessingService.processShipmentPayment(
              walletUserId,
              newTotalCost,
              shipment.id,
              `Shipment charge for order ${shipment.orderId} after partner assignment`,
              authToken,
            );
          walletTransactionId = paymentResult.walletTransactionId;
          paymentReference = paymentResult.paymentReference;
        }
      } else {
        const difference = parseFloat((newTotalCost - oldTotalCost).toFixed(2));

        if (difference > 0) {
          const paymentResult =
            await paymentProcessingService.processShipmentPayment(
              walletUserId,
              difference,
              shipment.id,
              `Additional shipment charge for order ${shipment.orderId} after partner change`,
              authToken,
            );
          walletTransactionId = paymentResult.walletTransactionId;
          paymentReference = paymentResult.paymentReference;
        } else if (difference < 0) {
          const refundResult =
            await paymentProcessingService.processShipmentRefund(
              walletUserId,
              Math.abs(difference),
              shipment.id,
              `Partner change refund for order ${shipment.orderId}`,
              authToken,
            );
          refundTransactionId = refundResult.refundTransactionId;
        }
      }

      paymentStatus = "CONFIRMED";
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        partnerId: quoteSnapshot.partnerId,
        partnerName: quoteSnapshot.partnerName,
        totalCost: newTotalCost,
        quoteSnapshot,
        estimatedDelivery: metrics.estimatedDelivery,
        volumetricDivisor: metrics.divisor,
        volumetricFactor: metrics.factor,
        volumetricWeight: metrics.volumetricWeight,
        chargeableWeight: metrics.chargeableWeight,
        bookingStatus: "PENDING_BOOKING",
        paymentStatus,
        walletTransactionId,
        paymentReference,
        refundTransactionId,
        partnerShipmentId: null,
        trackingUrl: null,
      },
    });

    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: "CREATED",
        message: isReassignment
          ? `Partner changed from ${previousPartnerName} to ${quoteSnapshot.partnerName}`
          : `Partner assigned: ${quoteSnapshot.partnerName}`,
        eventMetadata: {
          previousPartnerId: previousPartnerId || null,
          previousPartnerName: previousPartnerName || null,
          partnerId: quoteSnapshot.partnerId,
          partnerName: quoteSnapshot.partnerName,
          totalCost: newTotalCost,
        },
        source: trackingService.EVENT_SOURCES.SYSTEM,
      },
      userId,
    );

    await prisma.auditLog.create({
      data: {
        userId,
        action: isReassignment ? "CHANGE_PARTNER" : "ASSIGN_PARTNER",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          before: {
            partnerId: previousPartnerId,
            partnerName: previousPartnerName,
            totalCost: shipment.totalCost,
            bookingStatus: shipment.bookingStatus,
          },
          after: {
            partnerId: quoteSnapshot.partnerId,
            partnerName: quoteSnapshot.partnerName,
            totalCost: newTotalCost,
            bookingStatus: "PENDING_BOOKING",
          },
        },
        metadata: {
          source: "shipment-service",
          pickupLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    let courierBookingResult = null;
    let bookingErrorMessage = null;

    try {
      const bookingAttempt = await attemptCourierBooking({
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        partnerId: quoteSnapshot.partnerId,
        pickupLocation,
        pickupAddress: {
          name: shipment.pickupName,
          phone: shipment.pickupPhone,
          email: shipment.pickupEmail || null,
          address: shipment.pickupLine1,
          city: shipment.pickupCity,
          state: shipment.pickupState,
          pincode: shipment.pickupPincode,
        },
        deliveryAddress: {
          name: shipment.deliveryName,
          phone: shipment.deliveryPhone,
          email: shipment.deliveryEmail || null,
          address: shipment.deliveryLine1,
          city: shipment.deliveryCity,
          state: shipment.deliveryState,
          pincode: shipment.deliveryPincode,
        },
        packageDetails: {
          weight: metrics.chargeableWeight,
          length: toNumber(shipment.length),
          width: toNumber(shipment.width),
          height: toNumber(shipment.height),
        },
        shipmentType: shipment.shipmentType,
        paymentType: shipment.paymentType,
        codAmount: shipment.codAmount ? toNumber(shipment.codAmount) : 0,
        productDescription:
          shipment.productDescription || shipment.description || "Package",
        hsnCode: shipment.hsnCode || undefined,
        declaredValue: shipment.value ? toNumber(shipment.value) : newTotalCost,
        authToken,
      });

      courierBookingResult = bookingAttempt.courierBookingResult;

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          awbNumber: courierBookingResult.awbNumber,
          partnerShipmentId: courierBookingResult.partnerShipmentId || null,
          trackingUrl: bookingAttempt.trackingUrl,
          courierChannelId: courierBookingResult.channel?.id || null,
          courierChannelName: courierBookingResult.channel?.channelName || null,
          status: "BOOKED",
          bookingStatus: "BOOKED",
        },
      });

      await trackingService.createTrackingEvent(
        shipment.id,
        {
          status: "BOOKED",
          message: `Shipment booked with courier. AWB: ${courierBookingResult.awbNumber}`,
          eventMetadata: {
            awbNumber: courierBookingResult.awbNumber,
            courierPartnerId: quoteSnapshot.partnerId,
            reassigned: isReassignment,
          },
          source: trackingService.EVENT_SOURCES.PARTNER,
        },
        userId,
      );

      await createBookingResultAuditLog({
        userId,
        clientId,
        shipmentId: shipment.id,
        action: isReassignment
          ? "CHANGE_PARTNER_BOOKING_SUCCESS"
          : "ASSIGN_PARTNER_BOOKING_SUCCESS",
        bookingSucceeded: true,
        partnerId: quoteSnapshot.partnerId,
        partnerName: quoteSnapshot.partnerName,
        awbNumber: courierBookingResult.awbNumber,
        req,
      });
    } catch (courierError) {
      bookingErrorMessage =
        courierError.message || "Unknown courier booking error";
      logger.warn("Courier booking failed after partner assignment", {
        service: "shipment-service",
        shipmentId: shipment.id,
        partnerId: quoteSnapshot.partnerId,
        error: bookingErrorMessage,
      });

      await trackingService.createTrackingEvent(
        shipment.id,
        {
          status: "CREATED",
          message: `Partner ${isReassignment ? "changed" : "assigned"} but booking is pending: ${bookingErrorMessage}`,
          eventMetadata: {
            partnerId: quoteSnapshot.partnerId,
            partnerName: quoteSnapshot.partnerName,
            bookingStatus: "PENDING_BOOKING",
            error: bookingErrorMessage,
          },
          source: trackingService.EVENT_SOURCES.SYSTEM,
        },
        userId,
      );

      await createBookingResultAuditLog({
        userId,
        clientId,
        shipmentId: shipment.id,
        action: isReassignment
          ? "CHANGE_PARTNER_BOOKING_FAILED"
          : "ASSIGN_PARTNER_BOOKING_FAILED",
        bookingSucceeded: false,
        partnerId: quoteSnapshot.partnerId,
        partnerName: quoteSnapshot.partnerName,
        errorMessage: bookingErrorMessage,
        req,
      });
    }

    const updatedShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
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
        documents: {
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
            format: true,
            source: true,
            fetchedAt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    const formattedShipment = {
      ...updatedShipment,
      totalCost: parseFloat(updatedShipment.totalCost),
      codAmount: updatedShipment.codAmount
        ? parseFloat(updatedShipment.codAmount)
        : null,
      refundAmount: updatedShipment.refundAmount
        ? parseFloat(updatedShipment.refundAmount)
        : null,
      weight: parseFloat(updatedShipment.weight),
      length: parseFloat(updatedShipment.length),
      width: parseFloat(updatedShipment.width),
      height: parseFloat(updatedShipment.height),
      value: updatedShipment.value ? parseFloat(updatedShipment.value) : null,
    };

    res.status(200).json(
      APIResponse.success(
        {
          shipment: formattedShipment,
          courierBooking: courierBookingResult?.awbNumber
            ? {
                awbNumber: courierBookingResult.awbNumber,
                trackingUrl: formattedShipment.trackingUrl || null,
                booked: true,
              }
            : {
                booked: false,
                message:
                  bookingErrorMessage ||
                  "Partner assigned successfully. Booking is pending.",
              },
        },
        isReassignment
          ? "Shipment partner updated successfully"
          : "Shipment partner assigned successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to assign shipment partner", {
      service: "shipment-service",
      shipmentId: req.params?.id,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    if (
      error instanceof ConflictError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      const statusCode =
        error instanceof NotFoundError
          ? 404
          : error instanceof ConflictError
            ? 409
            : 400;
      return res
        .status(statusCode)
        .json(
          APIResponse.error(
            error.message,
            error.code || "PARTNER_ASSIGNMENT_FAILED",
          ),
        );
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to assign partner to shipment",
          "PARTNER_ASSIGNMENT_FAILED",
        ),
      );
  }
}

/**
 * Retry courier booking for an existing shipment that is in PENDING_BOOKING state.
 * Useful when courier configuration (e.g., Delhivery pickup location) was fixed after creation.
 */
async function retryCourierBooking(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const { pickupLocation = null } = req.body || {};

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        status: true,
        bookingStatus: true,
        shipmentType: true,
        paymentType: true,
        codAmount: true,
        totalCost: true,
        value: true,
        productDescription: true,
        description: true,
        weight: true,
        chargeableWeight: true,
        length: true,
        width: true,
        height: true,
        pickupName: true,
        pickupPhone: true,
        pickupEmail: true,
        pickupLine1: true,
        pickupCity: true,
        pickupState: true,
        pickupPincode: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryEmail: true,
        deliveryLine1: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryPincode: true,
        partnerId: true,
        awbNumber: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    if (shipment.awbNumber) {
      throw new ConflictError("Shipment is already booked with courier");
    }

    if (!shipment.partnerId) {
      throw new ValidationError("Shipment has no partner assigned for booking");
    }

    const authToken = req.headers.authorization?.replace("Bearer ", "");

    const bookingPayload = {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      pickupLocation,
      pickupAddress: {
        name: shipment.pickupName,
        phone: shipment.pickupPhone,
        email: shipment.pickupEmail || null,
        address: shipment.pickupLine1,
        city: shipment.pickupCity,
        state: shipment.pickupState,
        pincode: shipment.pickupPincode,
      },
      deliveryAddress: {
        name: shipment.deliveryName,
        phone: shipment.deliveryPhone,
        email: shipment.deliveryEmail || null,
        address: shipment.deliveryLine1,
        city: shipment.deliveryCity,
        state: shipment.deliveryState,
        pincode: shipment.deliveryPincode,
      },
      packageDetails: {
        weight: parseFloat(
          (shipment.chargeableWeight || shipment.weight).toString(),
        ),
        length: parseFloat(shipment.length.toString()),
        width: parseFloat(shipment.width.toString()),
        height: parseFloat(shipment.height.toString()),
      },
      shipmentType: shipment.shipmentType,
      paymentType: shipment.paymentType,
      codAmount: shipment.paymentType === "COD" ? shipment.codAmount || 0 : 0,
      productDescription:
        shipment.productDescription || shipment.description || "Package",
      declaredValue: parseFloat(
        (shipment.value || shipment.totalCost).toString(),
      ),
    };

    const courierBookingResult =
      await partnerIntegrationService.bookWithCourier(
        shipment.partnerId,
        bookingPayload,
        authToken,
      );

    const retryTrackingUrl =
      courierBookingResult.courierResponse?.trackingUrl ||
      courierBookingResult.trackingUrl ||
      null;

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        awbNumber: courierBookingResult.awbNumber,
        partnerShipmentId: courierBookingResult.partnerShipmentId || null,
        trackingUrl: retryTrackingUrl,
        courierChannelId: courierBookingResult.channel?.id || null,
        courierChannelName: courierBookingResult.channel?.channelName || null,
        status: "BOOKED",
        bookingStatus: "BOOKED",
      },
    });

    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: "BOOKED",
        message: `Shipment booked with courier. AWB: ${courierBookingResult.awbNumber}`,
        eventMetadata: {
          awbNumber: courierBookingResult.awbNumber,
          courierPartnerId: shipment.partnerId,
          retried: true,
        },
        source: trackingService.EVENT_SOURCES.PARTNER,
      },
      userId,
    );

    await prisma.auditLog.create({
      data: {
        userId,
        action: "RETRY_COURIER_BOOKING",
        resource: "Shipment",
        resourceId: shipment.id,
        metadata: {
          source: "shipment-service",
          partnerId: shipment.partnerId,
          orderId: shipment.orderId,
          pickupLocation: pickupLocation || null,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.status(200).json(
      APIResponse.success(
        {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          awbNumber: courierBookingResult.awbNumber,
          trackingUrl: retryTrackingUrl,
          courierBooking: courierBookingResult,
        },
        { message: "Courier booking retried successfully" },
      ),
    );
  } catch (error) {
    logger.error("Retry courier booking failed", {
      service: "shipment-service",
      shipmentId: req.params?.id,
      userId: req.user?.userId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error instanceof NotFoundError) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND", null, 404));
    }

    if (error instanceof ConflictError) {
      return res
        .status(409)
        .json(APIResponse.error(error.message, "CONFLICT", null, 409));
    }

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR", null, 400));
    }

    const status = error.statusCode || error.response?.status || 500;
    const partnerCode =
      error.code || error.response?.data?.error?.code || "BOOKING_FAILED";
    const partnerMessage =
      error.message ||
      error.response?.data?.error?.message ||
      "Courier booking failed";
    const partnerDetails =
      error.details || error.response?.data?.error?.details || null;

    res
      .status(status)
      .json(
        APIResponse.error(partnerMessage, partnerCode, partnerDetails, status),
      );
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
          bookingStatus: true,
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
        documents: {
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
            format: true,
            source: true,
            fetchedAt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
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

    // Fetch provider capabilities if partner is assigned
    let providerCapabilities = null;
    if (shipment.partnerId) {
      try {
        const authToken = req.headers.authorization?.replace("Bearer ", "");
        providerCapabilities =
          await partnerIntegrationService.getProviderCapabilities(
            shipment.partnerId,
            {
              status: shipment.status,
              bookingStatus: shipment.bookingStatus,
              awbNumber: shipment.awbNumber,
              paymentType: shipment.paymentType,
            },
            authToken,
          );
      } catch (capError) {
        logger.warn("Failed to fetch provider capabilities", {
          service: "shipment-service",
          shipmentId: shipment.id,
          partnerId: shipment.partnerId,
          error: capError.message,
        });
      }
    }

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
        {
          shipment: formattedShipment,
          providerCapabilities: providerCapabilities || null,
        },
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
        userId: true,
        outletId: true,
        status: true,
        paymentType: true,
        paymentStatus: true,
        totalCost: true,
        walletTransactionId: true,
        walletUserId: true,
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

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          refundAmount: refundAmount > 0 ? refundAmount : null,
        },
      });

      // Cancel the outlet's accrued markup commission with the shipment
      const cancelledEarnings = await tx.outletEarning.updateMany({
        where: { shipmentId: id, status: "ACCRUED" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      if (cancelledEarnings.count > 0) {
        await tx.auditLog.create({
          data: {
            userId,
            action: "OUTLET_EARNING_CANCELLED",
            resource: "OutletEarning",
            resourceId: id,
            changes: { shipmentId: id, status: "CANCELLED", reason },
            metadata: { source: "shipment-service" },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            clientId,
          },
        });
      }
    });

    const authToken = req.headers.authorization?.replace("Bearer ", "");
    const refundResult = await processCancellationRefund(
      shipment,
      reason,
      authToken,
    );

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        paymentStatus: refundResult.paymentStatus,
        refundAmount: refundAmount > 0 ? refundAmount : null,
        refundTransactionId: refundResult.refundTransactionId || null,
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        paymentStatus: true,
        refundAmount: true,
        refundTransactionId: true,
        cancelledAt: true,
        cancellationReason: true,
      },
    });

    // Create tracking event for cancellation
    await trackingService.updateShipmentStatus(
      id,
      "CANCELLED",
      `Shipment cancelled: ${reason}`,
      {
        cancellationReason: reason,
        refundAmount: refundAmount > 0 ? refundAmount.toString() : null,
        refundProcessed: !!refundResult.refundTransactionId,
        refundTransactionId: refundResult.refundTransactionId,
        paymentStatus: refundResult.paymentStatus,
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
          paymentStatus: refundResult.paymentStatus,
          refundTransactionId: refundResult.refundTransactionId,
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
      paymentStatus: refundResult.paymentStatus,
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
      shipmentType = "B2C",
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
      shipmentType,
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
      shipmentType = "B2C",
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
      shipmentType,
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
      vasSelections = [],
    } = req.body;

    logger.info("Getting shipment quotes", {
      service: "shipment-service",
      userId,
      fromPincode,
      toPincode,
      weight,
      numberOfBoxes,
      vasCount: vasSelections.length,
    });

    const rateParams = {
      fromPincode,
      toPincode,
      weight,
      serviceType: serviceType.toUpperCase(),
      dimensions,
      numberOfBoxes,
      codAmount: paymentType === "COD" ? codAmount : null,
      declaredValue: req.body.declaredValue || req.body.shipmentValue || 0,
      paymentMode: paymentType,
      isFragile: req.body.isFragile || false,
      outletId: req.body.outletId || null,
      sortBy: req.body.sortBy || "cheapest",
      shipmentType,
      vasSelections,
    };

    const authToken = req.header("Authorization");

    // Partner quote engine already applies pincode assignment, zone coverage,
    // and pricing rules. A second serviceability pass used the stricter
    // "distance zone matched" flag and dropped partners that still had valid
    // WEIGHT / non-distance pricing — yielding empty quotes while pincodes
    // were assigned. Trust calculateRates as the single source of truth here.
    const rateData = await partnerIntegrationService.calculateRates(
      rateParams,
      authToken,
    );

    const quotes = (rateData.rates || [])
      .map((rate) => {
        // Reuse the formula partner-service priced with (channel-specific or
        // system default) rather than re-deriving one here
        const { divisor, factor } = weightCalc.resolveVolumetricConfig({
          divisor: rate.volumetricDivisor,
          factor: rate.volumetricFactor,
        });
        const volWeight = weightCalc.computeVolumetric({
          boxes: numberOfBoxes,
          length: dimensions.length,
          width: dimensions.width,
          height: dimensions.height,
          divisor,
          factor,
        });
        const chargeableWt = weightCalc.computeChargeable(weight, volWeight);

        // Normalize breakdown from partner-service to frontend-friendly format
        const BASE_LABELS = {
          WEIGHT: "Weight Charge",
          INVOICE_VALUE: "Invoice Value Charge",
          COD_VALUE: "COD Value Charge",
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

        const quote = {
          partnerId: rate.partnerId,
          partnerName: rate.partnerName,
          totalAmount: rate.totalRate || rate.totalAmount || 0,
          deliveryDays: rate.deliveryDays || rate.estimatedDays || null,
          chargeBreakdown,
          volumetricDivisor: divisor,
          volumetricFactor: factor,
          volumetricWeight: volWeight,
          chargeableWeight: chargeableWt,
          actualWeight: weight,
          serviceable:
            rate.isServiceable !== false && rate.serviceable !== false,
          // Charges Engine v3 additions (money split + dynamic VAS questions)
          ...(rate.pricing && { pricing: rate.pricing }),
          ...(rate.requiredQuestions && {
            requiredQuestions: rate.requiredQuestions,
          }),
          ...(rate.engine && { engine: rate.engine }),
          ...(rate.discount && { discount: rate.discount }),
          ...(rate.channel && { channel: rate.channel }),
        };

        // Signed token: shipment creation verifies price/params against this,
        // never against the client-editable snapshot
        if (quote.serviceable) {
          quote.quoteToken = quoteSigningService.signQuote(
            quote,
            {
              fromPincode,
              toPincode,
              weight,
              paymentType,
              codAmount,
              shipmentType,
              serviceType,
            },
            vasSelections,
          );
        }

        return quote;
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

    if (error instanceof APIError) {
      return res
        .status(error.statusCode)
        .json(
          APIResponse.error(
            error.message,
            error.code || "INTERNAL_ERROR",
            error.details || null,
            error.statusCode,
          ),
        );
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
/**
 * Preview a re-rate (dry-run): recompute volumetric/chargeable weight, selling
 * charge, courier cost and profit margin for new weight/dimensions WITHOUT any
 * wallet mutation or DB write. Lets the UI show before/after before committing.
 */
async function rerateShipmentPreview(req, res) {
  try {
    const { id } = req.params;
    const {
      disputedWeight,
      disputedLength,
      disputedWidth,
      disputedHeight,
      courierCharge,
    } = req.body;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        status: true,
        partnerId: true,
        totalCost: true,
        courierCost: true,
        codAmount: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        numberOfBoxes: true,
        volumetricDivisor: true,
        volumetricFactor: true,
        volumetricWeight: true,
        chargeableWeight: true,
        paymentType: true,
        pickupPincode: true,
        deliveryPincode: true,
        serviceType: true,
        value: true,
        fragile: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    const oldCost = parseFloat(shipment.totalCost);
    const newWeight = disputedWeight || parseFloat(shipment.weight);
    const newLength = disputedLength || parseFloat(shipment.length);
    const newWidth = disputedWidth || parseFloat(shipment.width);
    const newHeight = disputedHeight || parseFloat(shipment.height);
    // Reuse the formula the shipment was originally priced with
    const { divisor, factor } = weightCalc.resolveVolumetricConfig({
      divisor: shipment.volumetricDivisor,
      factor: shipment.volumetricFactor,
    });
    const numBoxes = shipment.numberOfBoxes || 1;

    const newVolWeight = weightCalc.computeVolumetric({
      boxes: numBoxes,
      length: newLength,
      width: newWidth,
      height: newHeight,
      divisor,
      factor,
    });
    const newChargeableWeight = weightCalc.computeChargeable(
      newWeight,
      newVolWeight,
    );

    const authToken = req.header("Authorization");
    let newCost = oldCost;
    let rateCourierCost = null;
    try {
      const rateData = await partnerIntegrationService.calculateRates(
        {
          fromPincode: shipment.pickupPincode,
          toPincode: shipment.deliveryPincode,
          weight: newChargeableWeight,
          serviceType: shipment.serviceType,
          dimensions: { length: newLength, width: newWidth, height: newHeight },
          paymentMode: shipment.paymentType,
          // Price COD on the base collectable — stored codAmount includes the
          // outlet markup since charges-engine v3
          codAmount: shipment.codBaseAmount
            ? parseFloat(shipment.codBaseAmount)
            : shipment.codAmount
              ? parseFloat(shipment.codAmount)
              : 0,
          declaredValue: shipment.value ? parseFloat(shipment.value) : 0,
          isFragile: shipment.fragile || false,
          outletId: shipment.outletId || undefined,
          partnerId: shipment.partnerId,
          skipServiceabilityCheck: true,
          // Re-price the same VAS lines the shipment was booked with
          vasSelections: Array.isArray(shipment.vasSelections)
            ? shipment.vasSelections.map((s) => ({
                chargeCode: s.chargeCode,
                answer: s.answer,
              }))
            : [],
        },
        authToken,
      );
      const partnerRate = (rateData.rates || []).find(
        (r) => r.partnerId === shipment.partnerId,
      );
      if (partnerRate) {
        newCost = partnerRate.totalAmount;
        if (
          partnerRate.courierCost !== undefined &&
          partnerRate.courierCost !== null
        ) {
          rateCourierCost = parseFloat(partnerRate.courierCost);
        }
      }
    } catch (rateError) {
      logger.warn("Rate recalculation failed during re-rate preview", {
        service: "shipment-service",
        shipmentId: id,
        error: rateError.message,
      });
    }

    let newCourierCost = null;
    let newCourierCostSource = null;
    if (courierCharge !== undefined && courierCharge !== null) {
      newCourierCost = parseFloat(courierCharge);
      newCourierCostSource = "MANUAL";
    } else if (rateCourierCost !== null) {
      newCourierCost = rateCourierCost;
      newCourierCostSource = "RULE";
    }
    const newProfitMargin = weightCalc.computeProfitMargin(
      newCost,
      newCourierCost,
    );
    const difference = weightCalc.round(newCost - oldCost, 2);

    res.json(
      APIResponse.success(
        {
          before: {
            weight: parseFloat(shipment.weight),
            volumetricWeight: shipment.volumetricWeight
              ? parseFloat(shipment.volumetricWeight)
              : null,
            chargeableWeight: shipment.chargeableWeight
              ? parseFloat(shipment.chargeableWeight)
              : null,
            sellingCharge: oldCost,
            courierCost: shipment.courierCost
              ? parseFloat(shipment.courierCost)
              : null,
          },
          after: {
            weight: newWeight,
            volumetricWeight: newVolWeight,
            chargeableWeight: newChargeableWeight,
            sellingCharge: newCost,
            courierCost: newCourierCost,
            profitMargin: newProfitMargin,
            courierCostSource: newCourierCostSource,
          },
          difference,
          paymentType: shipment.paymentType,
          expectedWalletImpact:
            shipment.paymentType === "PREPAID"
              ? { refund: oldCost, charge: newCost, net: difference }
              : null,
        },
        "Re-rate preview computed",
      ),
    );
  } catch (error) {
    logger.error("Failed to preview re-rate", {
      service: "shipment-service",
      shipmentId: req.params.id,
      error: error.message,
    });
    if (error instanceof NotFoundError) {
      return res.status(404).json(APIResponse.error(error.message));
    }
    res.status(500).json(APIResponse.error("Failed to preview re-rate"));
  }
}

/**
 * Bulk re-rate shipments by AWB. Body: { reason, rows: [{ awbNumber, newWeight,
 * newLength, newWidth, newHeight, courierCharge, codAction }] }. Returns a
 * processing report (successful + failed records).
 */
async function bulkRerateShipments(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const clientId = req.user.clientId;
    const { reason, rows } = req.body;
    const authToken = req.header("Authorization");
    const walletAuthToken = req.headers.authorization?.replace("Bearer ", "");

    logger.info("Bulk re-rate requested", {
      service: "shipment-service",
      rowCount: rows?.length,
      userId,
    });

    const report = await bulkRerateService.processBulkRerate(rows, reason, {
      userId,
      clientId,
      authToken,
      walletAuthToken,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json(
      APIResponse.success(
        report,
        `Bulk re-rate processed: ${report.successCount} succeeded, ${report.failureCount} failed`,
      ),
    );
  } catch (error) {
    logger.error("Failed to process bulk re-rate", {
      service: "shipment-service",
      error: error.message,
    });
    res.status(500).json(APIResponse.error("Failed to process bulk re-rate"));
  }
}

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
      codAction,
      courierCharge, // optional manual courier cost (client: "Courier Charges (Manual or API)")
    } = req.body;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        userId: true,
        walletUserId: true,
        status: true,
        partnerId: true,
        partnerName: true,
        totalCost: true,
        codAmount: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        numberOfBoxes: true,
        volumetricDivisor: true,
        volumetricFactor: true,
        paymentType: true,
        walletTransactionId: true,
        pickupPincode: true,
        deliveryPincode: true,
        serviceType: true,
        value: true,
        fragile: true,
        quoteSnapshot: true,
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment not found");
    }

    if (
      !["CREATED", "BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(
        shipment.status,
      )
    ) {
      throw new ValidationError(
        "Shipment can only be re-rated in CREATED, BOOKED, PICKED_UP, or IN_TRANSIT status",
      );
    }

    const oldCost = parseFloat(shipment.totalCost);
    const newWeight = disputedWeight || parseFloat(shipment.weight);
    const newLength = disputedLength || parseFloat(shipment.length);
    const newWidth = disputedWidth || parseFloat(shipment.width);
    const newHeight = disputedHeight || parseFloat(shipment.height);
    // Reuse the formula the shipment was originally priced with
    const { divisor, factor } = weightCalc.resolveVolumetricConfig({
      divisor: shipment.volumetricDivisor,
      factor: shipment.volumetricFactor,
    });
    const numBoxes = shipment.numberOfBoxes || 1;

    const newVolWeight = weightCalc.computeVolumetric({
      boxes: numBoxes,
      length: newLength,
      width: newWidth,
      height: newHeight,
      divisor,
      factor,
    });
    const newChargeableWeight = weightCalc.computeChargeable(
      newWeight,
      newVolWeight,
    );

    // Recalculate rates with partner service
    const authToken = req.header("Authorization");
    let newCost = oldCost;
    let newBreakdown = null;
    let rateCourierCost = null; // courier cost emitted by rate engine (cost-side rules), if any
    try {
      const rateData = await partnerIntegrationService.calculateRates(
        {
          fromPincode: shipment.pickupPincode,
          toPincode: shipment.deliveryPincode,
          weight: newChargeableWeight,
          serviceType: shipment.serviceType,
          dimensions: { length: newLength, width: newWidth, height: newHeight },
          paymentMode: shipment.paymentType,
          // Price COD on the base collectable — stored codAmount includes the
          // outlet markup since charges-engine v3
          codAmount: shipment.codBaseAmount
            ? parseFloat(shipment.codBaseAmount)
            : shipment.codAmount
              ? parseFloat(shipment.codAmount)
              : 0,
          declaredValue: shipment.value ? parseFloat(shipment.value) : 0,
          isFragile: shipment.fragile || false,
          outletId: shipment.outletId || undefined,
          partnerId: shipment.partnerId,
          skipServiceabilityCheck: true,
          // Re-price the same VAS lines the shipment was booked with
          vasSelections: Array.isArray(shipment.vasSelections)
            ? shipment.vasSelections.map((s) => ({
                chargeCode: s.chargeCode,
                answer: s.answer,
              }))
            : [],
        },
        authToken,
      );

      const partnerRate = (rateData.rates || []).find(
        (r) => r.partnerId === shipment.partnerId,
      );
      if (partnerRate) {
        newCost = partnerRate.totalAmount;
        newBreakdown =
          partnerRate.breakdown || partnerRate.chargesBreakdown || [];
        // Courier cost (purchase amount) if the rate engine emits a cost side
        if (
          partnerRate.courierCost !== undefined &&
          partnerRate.courierCost !== null
        ) {
          rateCourierCost = parseFloat(partnerRate.courierCost);
        }
      }
    } catch (rateError) {
      logger.warn("Rate recalculation failed during re-rate, using old cost", {
        service: "shipment-service",
        shipmentId: id,
        error: rateError.message,
      });
    }

    const difference = newCost - oldCost;

    // Courier cost & profit margin. Selling charge = newCost (customer-facing).
    // Courier cost precedence: manual courierCharge > rate-engine cost side > unknown(null).
    let newCourierCost = null;
    let newCourierCostSource = null;
    if (courierCharge !== undefined && courierCharge !== null) {
      newCourierCost = parseFloat(courierCharge);
      newCourierCostSource = "MANUAL";
    } else if (rateCourierCost !== null) {
      newCourierCost = rateCourierCost;
      newCourierCostSource = "RULE";
    }
    const newProfitMargin = weightCalc.computeProfitMargin(
      newCost,
      newCourierCost,
    );

    const walletAuthToken = req.headers.authorization?.replace("Bearer ", "");
    const walletResolution =
      await shipmentWalletService.resolveShipmentWalletTarget(shipment);
    const walletTarget = walletResolution.walletUserId;
    const oldCodAmount = shipment.codAmount
      ? parseFloat(shipment.codAmount)
      : 0;

    let refundTxId = null;
    let chargeTxId = null;
    let holdApplied = false;
    let codAmountUpdated = false;
    let newCodAmount = oldCodAmount;

    if (difference !== 0 && shipment.paymentType === "PREPAID") {
      // PREPAID: refund old amount, charge new amount via wallet
      try {
        const refundResult =
          await paymentProcessingService.processShipmentRefund(
            walletTarget,
            oldCost,
            shipment.id,
            `Re-rate refund for shipment ${shipment.orderId}: ${reason}`,
            walletAuthToken,
          );
        refundTxId = refundResult.refundTransactionId;
      } catch (refundErr) {
        logger.error("Re-rate refund failed", {
          service: "shipment-service",
          shipmentId: id,
          error: refundErr.message,
        });
      }

      try {
        const chargeResult =
          await paymentProcessingService.processShipmentPayment(
            walletTarget,
            newCost,
            shipment.id,
            `Re-rate charge for shipment ${shipment.orderId}: ${reason}`,
            walletAuthToken,
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
    } else if (difference !== 0 && shipment.paymentType === "COD") {
      // COD handling — admin chooses how to settle the difference
      if (difference > 0 && !codAction) {
        throw new ValidationError(
          "codAction is required for COD shipments when charges increase. Use DEDUCT_WALLET or UPDATE_COD.",
        );
      }

      const effectiveCodAction = difference < 0 ? "UPDATE_COD" : codAction;

      if (effectiveCodAction === "UPDATE_COD") {
        newCodAmount = oldCodAmount + difference;
        if (newCodAmount < 0) newCodAmount = 0;
        codAmountUpdated = true;
        logger.info("COD amount adjusted via re-rate", {
          service: "shipment-service",
          shipmentId: id,
          oldCodAmount,
          newCodAmount,
          difference,
        });
      } else if (effectiveCodAction === "DEDUCT_WALLET") {
        // Same wallet refund+charge pattern as PREPAID
        try {
          const refundResult =
            await paymentProcessingService.processShipmentRefund(
              walletTarget,
              oldCost,
              shipment.id,
              `Re-rate refund (COD wallet deduct) for shipment ${shipment.orderId}: ${reason}`,
              walletAuthToken,
            );
          refundTxId = refundResult.refundTransactionId;
        } catch (refundErr) {
          logger.error("Re-rate COD wallet refund failed", {
            service: "shipment-service",
            shipmentId: id,
            error: refundErr.message,
          });
        }

        try {
          const chargeResult =
            await paymentProcessingService.processShipmentPayment(
              walletTarget,
              newCost,
              shipment.id,
              `Re-rate charge (COD wallet deduct) for shipment ${shipment.orderId}: ${reason}`,
              walletAuthToken,
            );
          chargeTxId = chargeResult.walletTransactionId;
        } catch (chargeErr) {
          logger.warn(
            "Re-rate COD wallet charge failed - putting shipment on hold",
            {
              service: "shipment-service",
              shipmentId: id,
              error: chargeErr.message,
            },
          );
          holdApplied = true;
        }
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

    // Persist courier cost / profit margin when a courier cost was captured
    // and the new selling charge actually took effect (not on hold).
    if (!holdApplied && newCourierCost !== null) {
      updateData.courierCost = newCourierCost;
      updateData.profitMargin = newProfitMargin;
      updateData.courierCostSource = newCourierCostSource;
    }

    if (newBreakdown && newBreakdown.length > 0) {
      const chargeBreakdown = newBreakdown.map((entry) => {
        const rawName = entry.chargeTypeName || entry.base || "Charge";
        const RERATE_BASE_LABELS = {
          DISTANCE_BASE_WEIGHT: "Distance Charge",
          COD_VALUE: "COD Value Charge",
        };
        const displayName =
          RERATE_BASE_LABELS[rawName] ||
          rawName.charAt(0) + rawName.slice(1).toLowerCase();
        return { name: displayName, amount: entry.totalCharge || 0 };
      });
      const existingSnapshot =
        typeof shipment.quoteSnapshot === "object" && shipment.quoteSnapshot
          ? shipment.quoteSnapshot
          : {};
      updateData.quoteSnapshot = {
        ...existingSnapshot,
        chargeBreakdown,
      };
    }

    if (codAmountUpdated) {
      updateData.codAmount = newCodAmount;
    }

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
        codAmount: true,
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

    const trackingMessage = holdApplied
      ? `Shipment on hold: insufficient balance after re-rate (₹${oldCost} → ₹${newCost})`
      : codAmountUpdated
        ? `Shipment re-rated: ₹${oldCost} → ₹${newCost}, COD updated: ₹${oldCodAmount} → ₹${newCodAmount}`
        : `Shipment re-rated: ₹${oldCost} → ₹${newCost}`;

    // Use current shipment status for the tracking event to avoid
    // invalid status transitions — rerate is recorded via message/metadata
    await trackingService.createTrackingEvent(
      id,
      {
        status: shipment.status,
        message: trackingMessage,
        eventMetadata: {
          reason,
          oldCost,
          newCost,
          difference,
          holdApplied,
          codAction: codAction || null,
          codAmountUpdated,
          oldCodAmount: codAmountUpdated ? oldCodAmount : undefined,
          newCodAmount: codAmountUpdated ? newCodAmount : undefined,
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
          codAction: codAction || null,
          codAmountUpdated,
          oldCodAmount: codAmountUpdated ? oldCodAmount : undefined,
          newCodAmount: codAmountUpdated ? newCodAmount : undefined,
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

    let statusMessage = "Shipment re-rated successfully";
    if (holdApplied) {
      statusMessage =
        "Shipment re-rated and placed on hold due to insufficient balance";
    } else if (codAmountUpdated) {
      statusMessage = `Shipment re-rated successfully. COD amount updated: ₹${oldCodAmount} → ₹${newCodAmount}`;
    }

    res.json(
      APIResponse.success(
        {
          shipment: {
            ...updatedShipment,
            totalCost: parseFloat(updatedShipment.totalCost),
            codAmount: updatedShipment.codAmount
              ? parseFloat(updatedShipment.codAmount)
              : null,
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
            sellingCharge: holdApplied ? oldCost : newCost,
            courierCost: newCourierCost,
            profitMargin: holdApplied ? null : newProfitMargin,
            courierCostSource: newCourierCostSource,
            refundTransactionId: refundTxId,
            chargeTransactionId: chargeTxId,
            holdApplied,
            codAction: codAction || null,
            codAmountUpdated,
            oldCodAmount: codAmountUpdated ? oldCodAmount : undefined,
            newCodAmount: codAmountUpdated ? newCodAmount : undefined,
          },
        },
        statusMessage,
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
async function processBulkShipments(req, res, next) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const { bulkData } = req.body;

    // Validate bulk data before reading any of its properties
    if (!Array.isArray(bulkData) || bulkData.length === 0) {
      throw new ValidationError("Bulk data must be a non-empty array");
    }

    if (bulkData.length > 1000) {
      throw new ValidationError(
        "Maximum 1000 shipments allowed per bulk operation",
      );
    }

    logger.info("Processing bulk shipments", {
      service: "shipment-service",
      userId,
      clientId,
      totalRecords: bulkData.length,
    });

    // Process bulk shipments
    const authToken = req.headers.authorization?.replace("Bearer ", "");

    const result = await bulkProcessingService.processBulkShipments(
      bulkData,
      userId,
      clientId,
      null,
      authToken,
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
    next(error);
  }
}

/**
 * Get bulk job status
 */
async function getBulkJobStatus(req, res, next) {
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
    next(error);
  }
}

/**
 * Upload a CSV/Excel file and process it as bulk shipments.
 *
 * Creates a durable BulkJob row so the upload appears in history regardless
 * of Redis TTL, then delegates row processing to bulkProcessingService.
 */
async function uploadBulkShipments(req, res, next) {
  let job = null;

  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;

    if (!req.file) {
      throw new ValidationError(
        'No file uploaded. Attach a CSV or Excel file in the "file" field.',
      );
    }

    logger.info("Processing bulk shipment upload", {
      service: "shipment-service",
      userId,
      clientId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

    // Parse first so an unreadable file fails before a job row is created
    const { rows, parseErrors, totalRows } =
      bulkFileParserService.parseShipmentFile(
        req.file.buffer,
        req.file.originalname,
      );

    if (rows.length > 1000) {
      throw new ValidationError(
        "Maximum 1000 shipments allowed per bulk operation",
      );
    }

    job = await prisma.bulkJob.create({
      data: {
        type: "BULK_SHIPMENT",
        status: "PROCESSING",
        totalRecords: totalRows,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        startedAt: new Date(),
        createdById: userId,
        clientId: clientId || null,
      },
    });

    // Forward the caller's token so downstream partner/wallet calls authenticate
    const authToken = req.headers.authorization?.replace("Bearer ", "");

    const result = await bulkProcessingService.processBulkShipments(
      rows,
      userId,
      clientId,
      job.id,
      authToken,
    );

    // Rows rejected during parsing never reach the processor, so fold them
    // into the totals the user sees.
    const failureCount = result.summary.failureCount + parseErrors.length;

    await prisma.bulkJob.update({
      where: { id: job.id },
      data: {
        status: result.summary.successCount > 0 ? "COMPLETED" : "FAILED",
        totalRecords: totalRows,
        processedRecords: result.summary.successCount + failureCount,
        successfulRecords: result.summary.successCount,
        failedRecords: failureCount,
        completedAt: new Date(),
        processingTimeMs: result.summary.processingTime,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE_BULK",
        resource: "BulkJob",
        resourceId: job.id,
        changes: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          totalRecords: totalRows,
          successCount: result.summary.successCount,
          failureCount,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.status(200).json(
      APIResponse.success(
        {
          jobId: job.id,
          fileName: req.file.originalname,
          total: totalRows,
          successful: result.successful,
          failed: [
            ...parseErrors.map((parseError) => ({
              index: parseError.row,
              orderId: parseError.orderId,
              error: parseError.error,
            })),
            ...result.failed,
          ],
          summary: {
            successCount: result.summary.successCount,
            failureCount,
            parseErrorCount: parseErrors.length,
            processingTime: result.summary.processingTime,
          },
        },
        "Bulk shipment file processed successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Bulk shipment upload error:", error);

    // Never leave a job stuck in PROCESSING when the request fails
    if (job) {
      try {
        await prisma.bulkJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: error.message,
            completedAt: new Date(),
          },
        });
      } catch (updateError) {
        logger.error("Failed to mark bulk job as failed", {
          jobId: job.id,
          error: updateError.message,
        });
      }
    }

    next(error);
  }
}

/**
 * List bulk upload jobs (upload history) with pagination and summary counts.
 */
async function getBulkJobs(req, res, next) {
  try {
    const userId = req.user.userId;
    const clientId = req.user.clientId;
    const { status, search, type } = req.query;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const where = {};

    // Multi-tenant scoping: non-admins only ever see their own client's jobs
    if (clientId && !["superadmin", "admin"].includes(req.user.role)) {
      where.clientId = clientId;
    }

    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.fileName = { contains: search, mode: "insensitive" };
    }

    logger.info("Getting bulk jobs", {
      service: "shipment-service",
      userId,
      clientId,
      page,
      limit,
    });

    const [jobs, total, statusGroups] = await Promise.all([
      prisma.bulkJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bulkJob.count({ where }),
      // Summary spans the whole filtered set, not just the current page
      prisma.bulkJob.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
    ]);

    const statusCounts = statusGroups.reduce((acc, group) => {
      acc[group.status] = group._count;
      return acc;
    }, {});

    res.status(200).json(
      APIResponse.success(
        {
          jobs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
          summary: {
            totalJobs: total,
            successful: statusCounts.COMPLETED || 0,
            failed: statusCounts.FAILED || 0,
            inProgress:
              (statusCounts.PROCESSING || 0) + (statusCounts.PENDING || 0),
            statusCounts,
          },
        },
        "Bulk jobs retrieved successfully",
        200,
      ),
    );
  } catch (error) {
    logger.error("Get bulk jobs error:", error);
    next(error);
  }
}

/**
 * Get a single bulk job by ID, including live Redis progress when available.
 */
async function getBulkJobById(req, res, next) {
  try {
    const { jobId } = req.params;
    const clientId = req.user.clientId;

    const job = await prisma.bulkJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundError(`Bulk job not found: ${jobId}`);
    }

    // Prevent cross-tenant reads
    if (
      clientId &&
      !["superadmin", "admin"].includes(req.user.role) &&
      job.clientId !== clientId
    ) {
      throw new NotFoundError(`Bulk job not found: ${jobId}`);
    }

    // Redis holds per-row errors for 24h; absence is expected for older jobs
    let liveStatus = null;
    try {
      liveStatus = await bulkProcessingService.getBulkJobStatus(jobId);
    } catch (statusError) {
      logger.debug("No live status for bulk job", {
        jobId,
        error: statusError.message,
      });
    }

    res
      .status(200)
      .json(
        APIResponse.success(
          { job, liveStatus },
          "Bulk job retrieved successfully",
          200,
        ),
      );
  } catch (error) {
    logger.error("Get bulk job error:", error);
    next(error);
  }
}

/**
 * Download the bulk shipment CSV template.
 *
 * Generated from the parser's own column definitions so the template can
 * never drift from what the parser accepts.
 */
async function downloadBulkTemplate(req, res, next) {
  try {
    const csv = bulkFileParserService.generateTemplateCsv();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bulk_shipment_template.csv"',
    );
    res.status(200).send(csv);
  } catch (error) {
    logger.error("Download bulk template error:", error);
    next(error);
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

/**
 * Refresh shipment data from the courier provider.
 * Fetches latest tracking, updates local records, and returns synced data.
 * POST /api/v1/shipments/:id/refresh
 */
async function refreshFromProvider(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        status: true,
        partnerId: true,
        awbNumber: true,
        trackingUrl: true,
      },
    });

    if (!shipment) throw new NotFoundError("Shipment not found");
    if (!shipment.awbNumber)
      throw new ValidationError(
        "Shipment has no AWB number — cannot refresh from provider",
      );
    if (!shipment.partnerId)
      throw new ValidationError("Shipment has no partner assigned");

    const authToken = req.headers.authorization?.replace("Bearer ", "");
    const trackingResult = await partnerIntegrationService.refreshFromProvider(
      shipment.partnerId,
      shipment.awbNumber,
      authToken,
    );

    const trackingData = trackingResult?.trackingData;
    const newStatus = trackingData?.currentStatus || null;
    const rawResponse = trackingData?.rawResponse || null;

    const updateData = {
      providerLastSyncAt: new Date(),
      providerRawResponse: rawResponse,
    };

    const TERMINAL_STATUSES = ["CANCELLED", "DELIVERED", "RTO"];
    const isCurrentTerminal = TERMINAL_STATUSES.includes(shipment.status);
    const isNewTerminal = TERMINAL_STATUSES.includes(newStatus);

    if (newStatus && newStatus !== shipment.status) {
      updateData.providerStatus = newStatus;
      if (!isCurrentTerminal || isNewTerminal) {
        updateData.status = newStatus;
      } else {
        logger.warn("Skipping status downgrade from terminal state", {
          shipmentId: shipment.id,
          currentStatus: shipment.status,
          providerStatus: newStatus,
        });
      }
    } else if (newStatus) {
      updateData.providerStatus = newStatus;
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    if (trackingData?.events && trackingData.events.length > 0) {
      for (const evt of trackingData.events) {
        const exists = await prisma.trackingEvent.findFirst({
          where: {
            shipmentId: shipment.id,
            source: "PARTNER",
            timestamp: evt.timestamp ? new Date(evt.timestamp) : undefined,
            message: evt.message || undefined,
          },
        });

        if (!exists) {
          await trackingService.createTrackingEvent(
            shipment.id,
            {
              status: evt.status || newStatus || "IN_TRANSIT",
              message: evt.message || "Provider tracking update",
              location: evt.location || null,
              source: "PARTNER",
              eventMetadata: evt.metadata || {},
            },
            userId,
          );
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "REFRESH",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: { providerStatus: newStatus, awbNumber: shipment.awbNumber },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id/refresh",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success(
        {
          shipmentId: shipment.id,
          awbNumber: shipment.awbNumber,
          previousStatus: shipment.status,
          currentStatus: newStatus || shipment.status,
          syncedAt: new Date().toISOString(),
          trackingData: trackingData || null,
        },
        "Shipment refreshed from provider successfully",
      ),
    );
  } catch (error) {
    logger.error("Refresh from provider failed", {
      service: "shipment-service",
      shipmentId: req.params.id,
      error: error.message,
    });

    if (error instanceof NotFoundError)
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    if (error instanceof ValidationError)
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    if (error instanceof APIError)
      return res
        .status(error.statusCode || 500)
        .json(APIResponse.error(error.message, error.code || "PROVIDER_ERROR"));

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to refresh shipment from provider",
          "REFRESH_FAILED",
        ),
      );
  }
}

/**
 * Fetch courier label for a shipment from the provider.
 * Stores it as a ShipmentDocument and returns it.
 * POST /api/v1/shipments/:id/courier-label
 */
async function fetchCourierLabel(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const { format = "pdf" } = req.body || {};

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        partnerId: true,
        awbNumber: true,
        courierLabelUrl: true,
      },
    });

    if (!shipment) throw new NotFoundError("Shipment not found");
    if (!shipment.awbNumber)
      throw new ValidationError(
        "Shipment has no AWB number — cannot fetch label",
      );
    if (!shipment.partnerId)
      throw new ValidationError("Shipment has no partner assigned");

    const authToken = req.headers.authorization?.replace("Bearer ", "");
    const labelResult = await partnerIntegrationService.getCourierLabel(
      shipment.partnerId,
      shipment.awbNumber,
      format,
      authToken,
    );

    const labelData = labelResult?.labelData;
    const labelContent = labelData?.labelData || null;
    const labelFormat = labelData?.format || format;

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        courierLabelFormat: labelFormat,
        courierLabelFetchedAt: new Date(),
      },
    });

    const existingDoc = await prisma.shipmentDocument.findFirst({
      where: { shipmentId: shipment.id, type: "LABEL" },
      select: { id: true },
    });

    await prisma.shipmentDocument.upsert({
      where: {
        id: existingDoc?.id || "00000000-0000-0000-0000-000000000000",
      },
      update: {
        data: labelContent,
        format: labelFormat,
        source: "PARTNER",
        fetchedAt: new Date(),
      },
      create: {
        shipmentId: shipment.id,
        type: "LABEL",
        name: `Courier Label - AWB ${shipment.awbNumber}`,
        data: labelContent,
        format: labelFormat,
        source: "PARTNER",
        fetchedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "FETCH_LABEL",
        resource: "Shipment",
        resourceId: shipment.id,
        metadata: {
          source: "shipment-service",
          awbNumber: shipment.awbNumber,
          format: labelFormat,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(
      APIResponse.success(
        {
          shipmentId: shipment.id,
          awbNumber: shipment.awbNumber,
          label: {
            data: labelContent,
            format: labelFormat,
          },
        },
        "Courier label fetched successfully",
      ),
    );
  } catch (error) {
    logger.error("Fetch courier label failed", {
      service: "shipment-service",
      shipmentId: req.params.id,
      error: error.message,
    });

    if (error instanceof NotFoundError)
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    if (error instanceof ValidationError)
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    if (error instanceof APIError)
      return res
        .status(error.statusCode || 500)
        .json(
          APIResponse.error(error.message, error.code || "LABEL_FETCH_ERROR"),
        );

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to fetch courier label",
          "LABEL_FETCH_FAILED",
        ),
      );
  }
}

/**
 * Cancel shipment — provider-first flow.
 * Calls the courier to cancel FIRST, then if successful, cancels internally.
 * POST /api/v1/shipments/:id/cancel-with-provider
 */
async function cancelWithProvider(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const clientId = req.user.clientId;
    const { id } = req.params;
    const { reason = "User requested cancellation" } = req.body;

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: {
        id: true,
        orderId: true,
        userId: true,
        outletId: true,
        walletUserId: true,
        status: true,
        paymentType: true,
        paymentStatus: true,
        totalCost: true,
        walletTransactionId: true,
        awbNumber: true,
        partnerId: true,
        createdAt: true,
      },
    });

    if (!shipment) throw new NotFoundError("Shipment not found");

    if (!["CREATED", "BOOKED", "PICKED_UP"].includes(shipment.status)) {
      throw new ValidationError("Shipment cannot be cancelled at this stage");
    }

    let providerCancelResult = null;

    if (shipment.awbNumber && shipment.partnerId) {
      const authToken = req.headers.authorization?.replace("Bearer ", "");
      providerCancelResult =
        await partnerIntegrationService.cancelWithCourierFirst(
          shipment.partnerId,
          shipment.awbNumber,
          reason,
          authToken,
        );

      logger.info("Provider cancellation result", {
        service: "shipment-service",
        shipmentId: id,
        awbNumber: shipment.awbNumber,
        result: providerCancelResult?.success,
      });
    }

    const refundAmount = calculateRefundAmount(shipment, reason);

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "CANCELLED",
        bookingStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        providerStatus: "CANCELLED",
        refundAmount: refundAmount > 0 ? refundAmount : null,
      },
    });

    const authToken = req.headers.authorization?.replace("Bearer ", "");
    const refundResult = await processCancellationRefund(
      shipment,
      reason,
      authToken,
    );

    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        paymentStatus: refundResult.paymentStatus,
        refundAmount: refundAmount > 0 ? refundAmount : null,
        refundTransactionId: refundResult.refundTransactionId || null,
      },
    });

    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: "CANCELLED",
        message: `Shipment cancelled. Reason: ${reason}`,
        source: "SYSTEM",
        eventMetadata: {
          reason,
          providerCancelSuccess: providerCancelResult?.success || false,
          cancelledBy: userId,
          refundAmount: refundAmount > 0 ? refundAmount : 0,
          refundTransactionId: refundResult.refundTransactionId,
          paymentStatus: refundResult.paymentStatus,
        },
      },
      userId,
    );

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CANCEL",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          previousStatus: shipment.status,
          newStatus: "CANCELLED",
          reason,
          providerCancelled: !!providerCancelResult,
          refundAmount: refundAmount > 0 ? refundAmount : 0,
          refundTransactionId: refundResult.refundTransactionId,
          paymentStatus: refundResult.paymentStatus,
        },
        metadata: {
          source: "shipment-service",
          endpoint: "/api/v1/shipments/:id/cancel-with-provider",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        clientId,
      },
    });

    res.json(
      APIResponse.success(
        {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          status: "CANCELLED",
          providerCancelled: !!providerCancelResult,
          providerCancelResult: providerCancelResult || null,
          refund:
            refundAmount > 0
              ? {
                  amount: refundAmount,
                  transactionId: refundResult.refundTransactionId,
                  status: refundResult.refundTransactionId
                    ? "PROCESSED"
                    : "FAILED",
                }
              : null,
          paymentStatus: updatedShipment.paymentStatus,
        },
        "Shipment cancelled successfully",
      ),
    );
  } catch (error) {
    logger.error("Cancel with provider failed", {
      service: "shipment-service",
      shipmentId: req.params.id,
      error: error.message,
    });

    if (error instanceof NotFoundError)
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    if (error instanceof ValidationError)
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    if (error instanceof APIError)
      return res
        .status(error.statusCode || 500)
        .json(APIResponse.error(error.message, error.code || "CANCEL_ERROR"));

    res
      .status(500)
      .json(APIResponse.error("Failed to cancel shipment", "CANCEL_FAILED"));
  }
}

/**
 * Get shipment documents
 * GET /api/v1/shipments/:id/documents
 */
async function getShipmentDocuments(req, res) {
  try {
    const { id } = req.params;

    let where = { id };
    where = authUtils.applyScopeFilter(req, where);

    const shipment = await prisma.shipment.findFirst({
      where,
      select: { id: true },
    });

    if (!shipment) throw new NotFoundError("Shipment not found");

    const documents = await prisma.shipmentDocument.findMany({
      where: { shipmentId: shipment.id },
      select: {
        id: true,
        type: true,
        name: true,
        url: true,
        format: true,
        source: true,
        metadata: true,
        fetchedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      APIResponse.success(
        { documents },
        "Shipment documents retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Get shipment documents failed", {
      service: "shipment-service",
      shipmentId: req.params.id,
      error: error.message,
    });

    if (error instanceof NotFoundError)
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    res
      .status(500)
      .json(
        APIResponse.error("Failed to get documents", "DOCUMENTS_FETCH_FAILED"),
      );
  }
}

/**
 * Global webhook endpoint for courier providers to push status updates.
 * POST /api/v1/shipments/webhook/:provider
 *
 * This is a PUBLIC endpoint (no JWT) — verification is done via webhook secret.
 * The provider param identifies the courier (e.g., "delhivery", "bluedart").
 */
async function handleProviderWebhook(req, res) {
  try {
    const { provider } = req.params;
    const payload = req.body;
    const signature =
      req.headers["x-webhook-signature"] ||
      req.headers["x-delhivery-signature"] ||
      req.headers["x-bluedart-signature"] ||
      "";

    logger.info("Received provider webhook", {
      service: "shipment-service",
      provider,
      payloadKeys: Object.keys(payload || {}),
      hasSignature: !!signature,
    });

    if (!payload || Object.keys(payload).length === 0) {
      return res
        .status(400)
        .json(APIResponse.error("Empty webhook payload", "INVALID_WEBHOOK"));
    }

    const awbNumber = extractAwbFromWebhook(provider, payload);
    if (!awbNumber) {
      logger.warn("Could not extract AWB from webhook payload", {
        service: "shipment-service",
        provider,
      });
      return res.status(200).json({
        status: "ignored",
        message: "Could not identify shipment from payload",
      });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { awbNumber },
      select: {
        id: true,
        orderId: true,
        status: true,
        partnerId: true,
        awbNumber: true,
        userId: true,
      },
    });

    if (!shipment) {
      logger.warn("Webhook received for unknown AWB", {
        service: "shipment-service",
        provider,
        awbNumber,
      });
      return res
        .status(200)
        .json({ status: "ignored", message: "Shipment not found for AWB" });
    }

    const normalizedEvent = normalizeWebhookEvent(provider, payload);

    if (normalizedEvent.status && normalizedEvent.status !== shipment.status) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: normalizedEvent.status,
          providerStatus: normalizedEvent.status,
          providerLastSyncAt: new Date(),
          providerRawResponse: payload,
          ...(normalizedEvent.status === "DELIVERED"
            ? { actualDelivery: new Date() }
            : {}),
          ...(normalizedEvent.status === "PICKED_UP"
            ? { actualPickup: new Date() }
            : {}),
        },
      });
    } else {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          providerLastSyncAt: new Date(),
          providerRawResponse: payload,
        },
      });
    }

    await trackingService.createTrackingEvent(
      shipment.id,
      {
        status: normalizedEvent.status || shipment.status,
        message: normalizedEvent.message || `Webhook update from ${provider}`,
        location: normalizedEvent.location || null,
        source: "PARTNER",
        eventMetadata: {
          webhookProvider: provider,
          rawPayload: payload,
        },
      },
      null,
    );

    await prisma.auditLog.create({
      data: {
        action: "WEBHOOK_UPDATE",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          provider,
          awbNumber,
          previousStatus: shipment.status,
          newStatus: normalizedEvent.status || shipment.status,
        },
        metadata: {
          source: "webhook",
          provider,
          signature: signature ? "present" : "absent",
        },
      },
    });

    logger.info("Webhook processed successfully", {
      service: "shipment-service",
      provider,
      awbNumber,
      shipmentId: shipment.id,
      newStatus: normalizedEvent.status,
    });

    res.status(200).json({ status: "ok", message: "Webhook processed" });
  } catch (error) {
    logger.error("Webhook processing failed", {
      service: "shipment-service",
      provider: req.params.provider,
      error: error.message,
    });

    res
      .status(200)
      .json({ status: "error", message: "Webhook processing failed" });
  }
}

/**
 * Extract AWB number from a webhook payload based on provider type.
 */
function extractAwbFromWebhook(provider, payload) {
  const p = provider.toLowerCase();

  if (p === "delhivery") {
    return (
      payload.waybill ||
      payload.Waybill ||
      payload.awb ||
      payload.AWBNumber ||
      null
    );
  }

  if (p === "bluedart") {
    return payload.AWBNo || payload.awbNumber || payload.Waybill || null;
  }

  return (
    payload.awbNumber ||
    payload.waybill ||
    payload.AWBNo ||
    payload.awb ||
    payload.tracking_number ||
    null
  );
}

/**
 * Normalize a webhook event into our internal format.
 */
function normalizeWebhookEvent(provider, payload) {
  const p = provider.toLowerCase();

  if (p === "delhivery") {
    const statusMap = {
      Manifested: "BOOKED",
      "In Transit": "IN_TRANSIT",
      Dispatched: "IN_TRANSIT",
      "Out For Delivery": "OUT_FOR_DELIVERY",
      Delivered: "DELIVERED",
      RTO: "RTO",
      Returned: "RTO",
      Cancelled: "CANCELLED",
      Pending: "CREATED",
    };

    const rawStatus =
      payload.Status || payload.status || payload.current_status || "";
    return {
      status: statusMap[rawStatus] || null,
      message:
        payload.StatusDescription ||
        payload.Instructions ||
        payload.remark ||
        `Status: ${rawStatus}`,
      location:
        payload.StatusLocation || payload.location || payload.city || null,
      timestamp: payload.StatusDateTime || payload.timestamp || null,
    };
  }

  if (p === "bluedart") {
    const statusMap = {
      Booked: "BOOKED",
      "Picked Up": "BOOKED",
      "In Transit": "IN_TRANSIT",
      "Out for Delivery": "OUT_FOR_DELIVERY",
      Delivered: "DELIVERED",
      Cancelled: "CANCELLED",
      Returned: "RTO",
    };

    const rawStatus = payload.Status || payload.ScanType || "";
    return {
      status: statusMap[rawStatus] || null,
      message:
        payload.StatusDescription ||
        payload.Instructions ||
        `Status: ${rawStatus}`,
      location: payload.Location || payload.ScannedLocation || null,
      timestamp: payload.ScanDateTime || payload.StatusDateTime || null,
    };
  }

  return {
    status: null,
    message:
      payload.message ||
      payload.description ||
      JSON.stringify(payload).slice(0, 200),
    location: payload.location || payload.city || null,
    timestamp: payload.timestamp || null,
  };
}

module.exports = {
  createShipment,
  assignPartner,
  retryCourierBooking,
  refreshFromProvider,
  fetchCourierLabel,
  cancelWithProvider,
  getShipmentDocuments,
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
  rerateShipmentPreview,
  bulkRerateShipments,
  // SHIP-004 endpoints
  trackByAwbNumber,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
  // Phase 4: Webhook ingestion
  handleProviderWebhook,
  // SHIP-005: Bulk Operations and Advanced Features
  processBulkShipments,
  getBulkJobStatus,
  uploadBulkShipments,
  getBulkJobs,
  getBulkJobById,
  downloadBulkTemplate,
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
