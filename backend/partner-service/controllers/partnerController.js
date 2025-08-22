const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { ValidationError, NotFoundError } = require("../shared/lib/errors");

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
 * @returns {Promise<Object>} Created partner
 */
async function createPartner(data) {
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

  return prisma.partner.create({
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
}

/**
 * Update a partner
 * @param {string} id - Partner ID
 * @param {Object} data - Updated partner data
 * @returns {Promise<Object>} Updated partner
 */
async function updatePartner(id, data) {
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

  return prisma.partner.update({
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
}

/**
 * Delete a partner
 * @param {string} id - Partner ID
 * @returns {Promise<Object>} Deleted partner
 */
async function deletePartner(id) {
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

  return prisma.partner.delete({ where: { id } });
}

/**
 * Calculate shipping rates for given parameters
 * @param {Object} params - Rate calculation parameters
 * @returns {Promise<Array>} Calculated rates from partners
 */
async function calculateRates(params) {
  const { fromPincode, toPincode, weight, serviceType, codAmount, partnerId } =
    params;

  // Validate required parameters
  if (!fromPincode || !toPincode || !weight) {
    throw new ValidationError(
      "fromPincode, toPincode, and weight are required",
    );
  }

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
  const { fromPincode, toPincode, partnerId } = params;

  // Validate required parameters
  if (!fromPincode || !toPincode) {
    throw new ValidationError("fromPincode and toPincode are required");
  }

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
