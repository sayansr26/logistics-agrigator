const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const APIResponse = require("../shared/lib/response");
const {
  getExternalPartnerClient,
} = require("../services/externalPartnerClient");
const { DiscountService } = require("../services/discountService");
const quoteCalculationService = require("../services/quoteCalculationService");
const logger = require("../shared/lib/logger");

/**
 * Get all partners with optional filtering, search, pagination, and sorting
 * @param {Object} filters - Filter criteria
 * @param {Object} user - Authenticated user (from req.user)
 * @returns {Promise<Object>} List of partners with pagination info
 */
async function getAllPartners(filters = {}, user = null) {
  const {
    isActive,
    supportsCOD,
    supportsReverse,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build base where clause
  const where = {
    ...(typeof isActive === "boolean" && { isActive }),
    ...(typeof supportsCOD === "boolean" && { supportsCOD }),
    ...(typeof supportsReverse === "boolean" && { supportsReverse }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            shipments: true,
            rates: true,
          },
        },
      },
    }),
    prisma.partner.count({ where }),
  ]);

  return {
    partners,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a partner by ID
 * @param {string} id - Partner ID
 * @returns {Promise<Object>} Partner details
 */
async function getPartnerById(id) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          shipments: true,
          rates: true,
          pincodeAssigns: true,
          chargePackages: true,
          channelConfigs: true,
          chargesTypes: true,
        },
      },
    },
  });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  return partner;
}

/**
 * Create a new partner
 * @param {Object} data - Partner data
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Created partner
 */
async function createPartner(data, req = {}) {
  // Validate required fields
  const requiredFields = ["name", "code", "displayName", "apiUrl"];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(", ")}`,
    );
  }

  // Check for unique constraints
  const existing = await prisma.partner.findFirst({
    where: {
      OR: [{ name: data.name }, { code: data.code }],
    },
  });

  if (existing) {
    throw new ValidationError("Partner with this name or code already exists");
  }

  const partner = await prisma.partner.create({
    data,
    include: {
      _count: {
        select: {
          shipments: true,
          rates: true,
        },
      },
    },
  });

  // Log partner creation
  await prisma.auditLog.create({
    data: {
      action: "CREATE_PARTNER",
      resourceType: "PARTNER",
      resourceId: partner.id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: {
        name: data.name,
        code: data.code,
        displayName: data.displayName,
        isActive: data.isActive,
      },
      responseData: {
        partnerId: partner.id,
        success: true,
      },
    },
  });

  return partner;
}

/**
 * Update a partner
 * @param {string} id - Partner ID
 * @param {Object} data - Updated partner data
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Updated partner
 */
async function updatePartner(id, data, req = {}) {
  const partner = await prisma.partner.findUnique({ where: { id } });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  // Check unique constraints if name/code is being updated
  if (data.name || data.code) {
    const existing = await prisma.partner.findFirst({
      where: {
        OR: [
          data.name ? { name: data.name } : null,
          data.code ? { code: data.code } : null,
        ].filter(Boolean),
        NOT: { id },
      },
    });

    if (existing) {
      throw new ValidationError(
        "Partner with this name or code already exists",
      );
    }
  }

  const updatedPartner = await prisma.partner.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          shipments: true,
          rates: true,
        },
      },
    },
  });

  // Log partner update
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_PARTNER",
      resourceType: "PARTNER",
      resourceId: id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: data,
      responseData: {
        partnerId: id,
        success: true,
        changes: Object.keys(data),
      },
    },
  });

  return updatedPartner;
}

/**
 * Delete a partner
 * @param {string} id - Partner ID
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Deleted partner
 */
async function deletePartner(id, req = {}) {
  const partner = await prisma.partner.findUnique({ where: { id } });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  // Check if partner has any active shipments
  const activeShipments = await prisma.partnerShipment.count({
    where: {
      partnerId: id,
      status: {
        notIn: ["DELIVERED", "CANCELLED", "RETURNED"],
      },
    },
  });

  if (activeShipments > 0) {
    throw new ValidationError("Cannot delete partner with active shipments");
  }

  const deletedPartner = await prisma.partner.delete({ where: { id } });

  // Log partner deletion
  await prisma.auditLog.create({
    data: {
      action: "DELETE_PARTNER",
      resourceType: "PARTNER",
      resourceId: id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: { partnerId: id },
      responseData: {
        partnerId: id,
        partnerName: partner.name,
        success: true,
      },
    },
  });

  return deletedPartner;
}

/**
 * Calculate shipping rates for given parameters
 * Uses new Zone System v2 with charge packages
 * Falls back to external API or local rates if quote engine fails
 *
 * @param {Object} params - Rate calculation parameters
 * @returns {Promise<Object>} Calculated rates with breakdown
 */
async function calculateRates(params) {
  const {
    fromPincode,
    toPincode,
    weight,
    serviceType,
    codAmount,
    partnerId,
    dimensions,
    paymentMode,
    shipmentValue,
    sortBy,
  } = params;

  // Validate required parameters
  if (!fromPincode || !toPincode || !weight) {
    throw new ValidationError(
      "fromPincode, toPincode, and weight are required",
    );
  }

  // Determine payment type from paymentMode or codAmount
  const paymentType =
    paymentMode?.toUpperCase() ||
    (codAmount && codAmount > 0 ? "COD" : "PREPAID");

  try {
    // Use new Zone System v2 quote calculation
    const quoteResult = await quoteCalculationService.calculateRates({
      fromPincode,
      toPincode,
      weight: parseFloat(weight),
      dimensions,
      paymentType,
      codAmount: codAmount ? parseFloat(codAmount) : 0,
      declaredValue: shipmentValue ? parseFloat(shipmentValue) : 0,
      partnerId,
      sortBy: sortBy || "cheapest",
    });

    // Transform to expected response format (maintaining backward compatibility)
    const rates = quoteResult.rates.map((rate) => ({
      partnerId: rate.partnerId,
      partnerName: rate.partnerName,
      serviceable: rate.serviceable,
      rate: rate.baseRate,
      totalRate: rate.totalRate,
      totalAmount: rate.totalRate, // Alias for backward compatibility
      deliveryDays: rate.estimatedDays,
      estimatedDays: rate.estimatedDays,
      distanceKm: rate.distanceKm,
      zoneSuffix: rate.zoneSuffix,
      zoneName: rate.zoneName,
      breakdown: rate.breakdown,
      // Legacy fields for compatibility
      serviceType: serviceType || "standard",
      isServiceable: rate.serviceable,
    }));

    logger.info("Quote calculation successful", {
      fromPincode,
      toPincode,
      weight,
      ratesCount: rates.length,
      cheapestRate: quoteResult.cheapestRate?.totalRate,
    });

    // Return enriched response
    return {
      rates,
      cheapestRate: quoteResult.cheapestRate,
      fastestRate: quoteResult.fastestRate,
      summary: quoteResult.summary,
    };
  } catch (quoteError) {
    logger.warn("Quote engine failed, falling back to external API", {
      error: quoteError.message,
      fromPincode,
      toPincode,
    });

    // Fallback to external API
    try {
      const externalClient = getExternalPartnerClient();
      const externalParams = {
        origin: fromPincode,
        destination: toPincode,
        weight: parseFloat(weight),
        dimensions: dimensions || { length: 10, width: 10, height: 10 },
        serviceType: serviceType || "standard",
        partnerId: partnerId || "partner_001",
      };

      const externalResponse =
        await externalClient.calculateRates(externalParams);

      if (
        externalResponse.success &&
        externalResponse.data &&
        externalResponse.data.rates
      ) {
        let rates = externalResponse.data.rates;

        if (partnerId) {
          rates = rates.filter((rate) => rate.partnerId === partnerId);
        }

        if (codAmount) {
          rates = rates.map((rate) => {
            if (rate.cod) {
              const codCharge = codAmount * 0.02;
              return {
                ...rate,
                rate: rate.rate + codCharge,
                codCharge: codCharge,
                totalAmount: rate.rate + codCharge,
              };
            }
            return { ...rate, totalAmount: rate.rate };
          });
        } else {
          rates = rates.map((rate) => ({ ...rate, totalAmount: rate.rate }));
        }

        return { rates };
      }
    } catch (externalError) {
      logger.warn("External API also failed, using local rates", {
        error: externalError.message,
      });
    }

    // Final fallback to local rate calculation
    const localRates = await calculateLocalRates(params);
    return { rates: localRates };
  }
}

/**
 * Calculate shipping rates with discount application
 * @param {Object} params - Rate calculation parameters
 * @param {Object} discountParams - Discount calculation parameters
 * @returns {Promise<Array>} Calculated rates with discounts applied
 */
async function calculateRatesWithDiscounts(params, discountParams = {}) {
  try {
    // First get the base rates using existing calculation
    const baseRates = await calculateRates(params);

    if (!baseRates || baseRates.length === 0) {
      return baseRates;
    }

    // Initialize discount service
    const discountService = new DiscountService();

    // Process each rate with discount calculation
    const ratesWithDiscounts = await Promise.all(
      baseRates.map(async (rate) => {
        try {
          // Prepare discount calculation data
          const calculationData = {
            partnerId: rate.partnerId,
            baseAmount: rate.totalAmount,
            applicableOn: discountParams.applicableOn || "TOTAL",
            conditions: {
              customerType: discountParams.customerType,
              zoneId: discountParams.zoneId,
              orderDate: new Date().toISOString(),
              serviceType: rate.serviceType,
              weight: params.weight,
              ...discountParams.conditions,
            },
          };

          // Calculate applicable discounts
          const discountResult =
            await discountService.calculateDiscount(calculationData);

          // Apply discount to the rate
          const finalAmount = discountResult.finalAmount || rate.totalAmount;
          const discountAmount = discountResult.totalDiscount || 0;

          return {
            ...rate,
            originalAmount: rate.totalAmount,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            savings: rate.totalAmount - finalAmount,
            discountPercentage:
              rate.totalAmount > 0
                ? ((discountAmount / rate.totalAmount) * 100).toFixed(2)
                : 0,
            appliedDiscounts: discountResult.applicableDiscounts || [],
            discountBreakdown: discountResult.discountBreakdown || {},
          };
        } catch (discountError) {
          // If discount calculation fails, return original rate
          console.warn(
            `Discount calculation failed for partner ${rate.partnerId}:`,
            discountError.message,
          );
          return {
            ...rate,
            originalAmount: rate.totalAmount,
            discountAmount: 0,
            finalAmount: rate.totalAmount,
            savings: 0,
            discountPercentage: 0,
            appliedDiscounts: [],
            discountError: discountError.message,
          };
        }
      }),
    );

    // Sort by final amount (lowest first)
    ratesWithDiscounts.sort((a, b) => a.finalAmount - b.finalAmount);

    return ratesWithDiscounts;
  } catch (error) {
    console.error("Error in calculateRatesWithDiscounts:", error);
    // Fallback to regular rate calculation if discount integration fails
    return await calculateRates(params);
  }
}

/**
 * Fallback local rate calculation (existing logic)
 * @param {Object} params - Rate calculation parameters
 * @returns {Promise<Array>} Calculated rates from local database
 */
async function calculateLocalRates(params) {
  const { fromPincode, toPincode, weight, serviceType, codAmount, partnerId } =
    params;

  const where = {
    isActive: true,
    ...(partnerId && { id: partnerId }),
    servicePincodes: {
      hasEvery: [fromPincode, toPincode],
    },
  };

  const partners = await prisma.partner.findMany({ where });

  const rates = await Promise.all(
    partners.map(async (partner) => {
      // Get partner rate from rate card
      const rate = await prisma.partnerRate.findFirst({
        where: {
          partnerId: partner.id,
          fromPincode,
          toPincode,
          minWeight: { lte: weight },
          maxWeight: { gte: weight },
          ...(serviceType && { serviceType }),
        },
      });

      if (!rate) return null;

      const baseCharge = rate.rate;
      const codCharge =
        codAmount && partner.supportsCOD
          ? (codAmount * (partner.codChargePercent || 0)) / 100
          : 0;
      const fuelSurcharge = baseCharge * (rate.fuelSurcharge || 0);
      const totalAmount = baseCharge + codCharge + fuelSurcharge;

      return {
        partnerId: partner.id,
        partnerName: partner.displayName,
        serviceType: rate.serviceType,
        rate: baseCharge,
        codCharge,
        fuelSurcharge,
        totalAmount,
        deliveryDays: rate.deliveryDays,
        isServiceable: true,
      };
    }),
  );

  return rates.filter(Boolean);
}

/**
 * Check serviceability for given parameters
 * Uses new Zone System v2 with distance zones
 * Falls back to external API if quote engine fails
 *
 * @param {Object} params - Serviceability check parameters
 * @returns {Promise<Object>} Serviceability results
 */
async function checkServiceability(params) {
  const { fromPincode, toPincode, partnerId, serviceType } = params;

  // Validate required parameters
  if (!fromPincode || !toPincode) {
    throw new ValidationError("fromPincode and toPincode are required");
  }

  try {
    // Use new Zone System v2 quote serviceability check
    const serviceabilityResult =
      await quoteCalculationService.checkServiceability({
        fromPincode,
        toPincode,
        partnerId,
      });

    // Transform to expected response format
    const results = serviceabilityResult.serviceability.map((item) => ({
      partnerId: item.partnerId,
      partnerName: item.partnerName,
      isServiceable: item.serviceable,
      serviceable: item.serviceable,
      distanceKm: item.distanceKm,
      zoneSuffix: item.zoneSuffix,
      zoneId: item.zoneId,
      zoneName: item.zoneName,
      estimatedDays: item.estimatedDays,
      deliveryDays: item.estimatedDays,
      serviceTypes: ["standard"], // Default for now
      cod: true, // Will be configured per partner in future
      prepaid: true,
      error: item.error,
    }));

    logger.info("Serviceability check successful", {
      fromPincode,
      toPincode,
      serviceableCount: serviceabilityResult.serviceableCount,
      totalPartners: serviceabilityResult.totalPartners,
    });

    return {
      serviceability: results,
      summary: {
        fromPincode,
        toPincode,
        serviceableCount: serviceabilityResult.serviceableCount,
        totalPartners: serviceabilityResult.totalPartners,
      },
    };
  } catch (quoteError) {
    logger.warn(
      "Quote engine serviceability check failed, falling back to external API",
      {
        error: quoteError.message,
        fromPincode,
        toPincode,
      },
    );

    // Fallback to external API
    try {
      const externalClient = getExternalPartnerClient();

      const externalResponse = await externalClient.checkServiceability({
        pincode: toPincode,
        serviceType: serviceType || "standard",
      });

      if (externalResponse.success && externalResponse.data) {
        const { serviceable, partners, services, cod, prepaid } =
          externalResponse.data;

        if (!serviceable) {
          return {
            serviceability: [
              {
                partnerId: null,
                partnerName: "No Service Available",
                isServiceable: false,
                serviceTypes: [],
                deliveryDays: {},
                cod: false,
                prepaid: false,
              },
            ],
          };
        }

        let availablePartners = partners;
        if (partnerId) {
          availablePartners = partners.filter((p) => p === partnerId);
        }

        const serviceabilityResults = availablePartners.map((partnerCode) => ({
          partnerId: partnerCode,
          partnerName: getPartnerDisplayName(partnerCode),
          isServiceable: true,
          serviceTypes: services || ["standard"],
          deliveryDays: getEstimatedDeliveryDays(partnerCode, services),
          cod,
          prepaid,
        }));

        logger.info("External API serviceability check successful", {
          fromPincode,
          toPincode,
          serviceable,
          partnersCount: availablePartners.length,
        });

        return { serviceability: serviceabilityResults };
      } else {
        throw new Error("Invalid response from external Partner Micro service");
      }
    } catch (externalError) {
      logger.warn("External API also failed, using local serviceability", {
        error: externalError.message,
      });

      // Final fallback to local serviceability check
      const localResults = await checkLocalServiceability(params);
      return { serviceability: localResults };
    }
  }
}

/**
 * Get partner display name from partner code
 */
function getPartnerDisplayName(partnerCode) {
  const partnerNames = {
    delhivery: "Delhivery",
    bluedart: "Blue Dart",
    dtdc: "DTDC",
    ecom: "Ecom Express",
    xpressbees: "Xpressbees",
  };
  return (
    partnerNames[partnerCode] ||
    partnerCode.charAt(0).toUpperCase() + partnerCode.slice(1)
  );
}

/**
 * Get estimated delivery days for partner and service type
 */
function getEstimatedDeliveryDays(partnerCode, services) {
  const deliveryEstimates = {
    delhivery: { standard: "3-5", express: "1-2" },
    bluedart: { standard: "2-4", express: "1-2" },
    dtdc: { standard: "4-6", express: "2-3" },
    ecom: { standard: "3-5", express: "1-3" },
    xpressbees: { standard: "3-6", express: "2-4" },
  };

  const partnerEstimates = deliveryEstimates[partnerCode] || {
    standard: "3-5",
    express: "1-3",
  };
  const result = {};

  services.forEach((service) => {
    result[service] = partnerEstimates[service] || partnerEstimates["standard"];
  });

  return result;
}

/**
 * Fallback local serviceability check
 */
async function checkLocalServiceability(params) {
  const { fromPincode, toPincode, partnerId } = params;

  // Check cache first
  const cachedResults = await prisma.serviceabilityCache.findMany({
    where: {
      fromPincode,
      toPincode,
      ...(partnerId && { partnerId }),
      expiresAt: { gt: new Date() },
    },
    include: { partner: true },
  });

  if (cachedResults.length > 0) {
    return cachedResults.map((result) => ({
      partnerId: result.partnerId,
      partnerName: result.partner.displayName,
      isServiceable: result.isServiceable,
      serviceTypes: result.serviceType ? [result.serviceType] : [],
      deliveryDays: result.deliveryDays
        ? { [result.serviceType]: result.deliveryDays }
        : {},
    }));
  }

  // If not in cache, check partner rate cards
  const where = {
    isActive: true,
    ...(partnerId && { id: partnerId }),
  };

  const partners = await prisma.partner.findMany({ where });

  const serviceability = await Promise.all(
    partners.map(async (partner) => {
      const rates = await prisma.partnerRate.findMany({
        where: {
          partnerId: partner.id,
          fromPincode,
          toPincode,
        },
        distinct: ["serviceType"],
        select: {
          serviceType: true,
          deliveryDays: true,
        },
      });

      const isServiceable = rates.length > 0;
      const serviceTypes = rates.map((r) => r.serviceType);
      const deliveryDays = rates.reduce(
        (acc, r) => ({
          ...acc,
          [r.serviceType]: r.deliveryDays,
        }),
        {},
      );

      // Cache the result
      await prisma.serviceabilityCache.create({
        data: {
          partnerId: partner.id,
          fromPincode,
          toPincode,
          isServiceable,
          serviceType: serviceTypes[0], // Cache primary service type
          deliveryDays: deliveryDays[serviceTypes[0]], // Cache primary delivery days
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour cache
        },
      });

      return {
        partnerId: partner.id,
        partnerName: partner.displayName,
        isServiceable,
        serviceTypes,
        deliveryDays,
      };
    }),
  );

  return serviceability;
}

module.exports = {
  getAllPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  deletePartner,
  calculateRates,
  calculateRatesWithDiscounts,
  checkServiceability,
};
