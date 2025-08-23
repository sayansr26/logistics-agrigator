const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const APIResponse = require("../shared/lib/response");
const {
  getExternalPartnerClient,
} = require("../services/externalPartnerClient");

/**
 * Get all partners with optional filtering
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} List of partners
 */
async function getAllPartners(filters = {}) {
  const { isActive, supportsCOD, supportsReverse } = filters;

  const where = {
    ...(typeof isActive === "boolean" && { isActive }),
    ...(typeof supportsCOD === "boolean" && { supportsCOD }),
    ...(typeof supportsReverse === "boolean" && { supportsReverse }),
  };

  return prisma.partner.findMany({
    where,
    include: {
      _count: {
        select: {
          shipments: true,
          rates: true,
        },
      },
    },
  });
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
      action: "PARTNER_CREATED",
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
      action: "PARTNER_UPDATED",
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
      action: "PARTNER_DELETED",
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
 * @param {Object} params - Rate calculation parameters
 * @returns {Promise<Array>} Calculated rates from partners
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
  } = params;

  // Validate required parameters
  if (!fromPincode || !toPincode || !weight) {
    throw new ValidationError(
      "fromPincode, toPincode, and weight are required",
    );
  }

  try {
    // Get external API client
    const externalClient = getExternalPartnerClient();

    // Prepare parameters for external API
    const externalParams = {
      origin: fromPincode,
      destination: toPincode,
      weight: parseFloat(weight),
      dimensions: dimensions || { length: 10, width: 10, height: 10 },
      serviceType: serviceType || "standard",
      partnerId: partnerId || "partner_001", // Use requested partner or default
    };

    // Call external Partner Micro service for real-time rates
    const externalResponse =
      await externalClient.calculateRates(externalParams);

    if (
      externalResponse.success &&
      externalResponse.data &&
      externalResponse.data.rates
    ) {
      let rates = externalResponse.data.rates;

      // Filter by specific partner if requested
      if (partnerId) {
        rates = rates.filter((rate) => rate.partnerId === partnerId);
      }

      // Add COD charges if applicable
      if (codAmount) {
        rates = rates.map((rate) => {
          if (rate.cod) {
            // Add 2% COD charge (configurable)
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

      // Log successful rate calculation
      console.log("External API rate calculation successful", {
        fromPincode,
        toPincode,
        weight,
        ratesCount: rates.length,
      });

      return rates;
    } else {
      throw new Error("Invalid response from external Partner Micro service");
    }
  } catch (externalError) {
    console.error(
      "External API rate calculation failed, falling back to local rates:",
      externalError.message,
    );

    // Fallback to local rate calculation if external API fails
    return await calculateLocalRates(params);
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
 * @param {Object} params - Serviceability check parameters
 * @returns {Promise<Array>} Serviceability results
 */
async function checkServiceability(params) {
  const { fromPincode, toPincode, partnerId, serviceType } = params;

  // Validate required parameters
  if (!fromPincode || !toPincode) {
    throw new ValidationError("fromPincode and toPincode are required");
  }

  try {
    // Get external API client
    const externalClient = getExternalPartnerClient();

    // Check serviceability for destination pincode
    const externalResponse = await externalClient.checkServiceability({
      pincode: toPincode,
      serviceType: serviceType || "standard",
    });

    if (externalResponse.success && externalResponse.data) {
      const { serviceable, partners, services, cod, prepaid } =
        externalResponse.data;

      if (!serviceable) {
        return [
          {
            partnerId: null,
            partnerName: "No Service Available",
            isServiceable: false,
            serviceTypes: [],
            deliveryDays: {},
            cod: false,
            prepaid: false,
          },
        ];
      }

      // Filter by specific partner if requested
      let availablePartners = partners;
      if (partnerId) {
        availablePartners = partners.filter((p) => p === partnerId);
      }

      // Map to expected format
      const serviceabilityResults = availablePartners.map((partnerCode) => ({
        partnerId: partnerCode,
        partnerName: getPartnerDisplayName(partnerCode),
        isServiceable: true,
        serviceTypes: services || ["standard"],
        deliveryDays: getEstimatedDeliveryDays(partnerCode, services),
        cod,
        prepaid,
      }));

      // Log successful serviceability check
      console.log("External API serviceability check successful", {
        fromPincode,
        toPincode,
        serviceable,
        partnersCount: availablePartners.length,
      });

      return serviceabilityResults;
    } else {
      throw new Error("Invalid response from external Partner Micro service");
    }
  } catch (externalError) {
    console.error(
      "External API serviceability check failed, falling back to local check:",
      externalError.message,
    );

    // Fallback to local serviceability check
    return await checkLocalServiceability(params);
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
  checkServiceability,
};
