/**
 * Charge Definition Service (Charges Engine v3)
 *
 * CRUD for the dynamic charge catalog. Every write records a version snapshot
 * and bumps the global config revision (implicit quote-cache invalidation).
 * System definitions (isSystem) cannot be deleted, only deactivated.
 */

const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const {
  recordVersion,
  bumpConfigRevision,
  createAuditLog,
} = require("./chargeConfigShared");

const VALID_METHODS = [
  "FLAT",
  "PERCENT_WITH_MIN",
  "PER_UNIT",
  "SLAB",
  "MATRIX",
  "PER_UNIT_TIME",
  "RATE_ADJUSTMENT",
  "OPTION_RATE",
  "DISCOUNT",
];

function assertComputationShape(computation) {
  if (!computation || typeof computation !== "object") {
    throw new ValidationError("computation must be an object");
  }
  if (!VALID_METHODS.includes(computation.method)) {
    throw new ValidationError(
      `computation.method must be one of ${VALID_METHODS.join(", ")}`,
    );
  }
}

async function createDefinition(data, reqContext = {}) {
  assertComputationShape(data.computation);

  const existing = await prisma.chargeDefinition.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) {
    throw new ValidationError(
      `Charge definition code already exists: ${data.code}`,
    );
  }

  const definition = await prisma.chargeDefinition.create({ data });

  await recordVersion(
    "DEFINITION",
    definition.id,
    definition.version,
    definition,
    {
      changeSource: reqContext.changeSource || "MANUAL",
      changedById: reqContext.userId || null,
    },
  );
  await bumpConfigRevision();
  await createAuditLog(
    "CREATE_CHARGE_DEFINITION",
    "CHARGE_DEFINITION",
    definition.id,
    { request: data, response: { id: definition.id, code: definition.code } },
    reqContext,
  );

  return definition;
}

async function listDefinitions(filters = {}) {
  const {
    page = 1,
    limit = 50,
    category,
    applyStage,
    isActive,
    search,
  } = filters;

  const where = {};
  if (category) where.category = category;
  if (applyStage) where.applyStage = applyStage;
  if (typeof isActive === "boolean") where.isActive = isActive;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [definitions, total] = await Promise.all([
    prisma.chargeDefinition.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: [{ phase: "asc" }, { code: "asc" }],
    }),
    prisma.chargeDefinition.count({ where }),
  ]);

  return {
    definitions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

async function getDefinitionById(id) {
  const definition = await prisma.chargeDefinition.findUnique({
    where: { id },
    include: {
      partnerConfigs: {
        where: { isActive: true },
        select: { id: true, partnerId: true, channelId: true },
      },
    },
  });
  if (!definition) throw new NotFoundError("ChargeDefinition", id);
  return definition;
}

async function updateDefinition(id, updateData, reqContext = {}) {
  const existing = await prisma.chargeDefinition.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("ChargeDefinition", id);

  if (updateData.computation) assertComputationShape(updateData.computation);
  if (updateData.code && updateData.code !== existing.code) {
    if (existing.isSystem) {
      throw new ValidationError("System charge definitions cannot be re-coded");
    }
    const dupe = await prisma.chargeDefinition.findUnique({
      where: { code: updateData.code },
      select: { id: true },
    });
    if (dupe) {
      throw new ValidationError(
        `Charge definition code already exists: ${updateData.code}`,
      );
    }
  }

  const definition = await prisma.chargeDefinition.update({
    where: { id },
    data: { ...updateData, version: { increment: 1 } },
  });

  await recordVersion("DEFINITION", id, definition.version, definition, {
    changeSource: reqContext.changeSource || "MANUAL",
    changedById: reqContext.userId || null,
  });
  await bumpConfigRevision();
  await createAuditLog(
    "UPDATE_CHARGE_DEFINITION",
    "CHARGE_DEFINITION",
    id,
    { request: updateData, response: { id, version: definition.version } },
    reqContext,
  );

  return definition;
}

async function deleteDefinition(id, reqContext = {}) {
  const existing = await prisma.chargeDefinition.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("ChargeDefinition", id);

  if (existing.isSystem) {
    throw new ValidationError(
      "System charge definitions cannot be deleted; deactivate instead",
    );
  }

  const definition = await prisma.chargeDefinition.delete({ where: { id } });

  await bumpConfigRevision();
  await createAuditLog(
    "DELETE_CHARGE_DEFINITION",
    "CHARGE_DEFINITION",
    id,
    { request: { id }, response: { id, code: existing.code } },
    reqContext,
  );

  return definition;
}

async function getDefinitionVersions(id) {
  const definition = await prisma.chargeDefinition.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!definition) throw new NotFoundError("ChargeDefinition", id);

  return prisma.chargeConfigVersion.findMany({
    where: { entityType: "DEFINITION", entityId: id },
    orderBy: { version: "desc" },
  });
}

/**
 * Booking-question specs for the dynamic VAS section of the booking form.
 * Optionally filtered to a partner: only questions whose definition has an
 * active PartnerChargeConfig for that partner (a question without configured
 * pricing is noise).
 */
async function getBookingQuestions({ partnerId } = {}) {
  const where = {
    applyStage: "BOOKING_OPTION",
    isActive: true,
    bookingQuestion: { not: null },
  };

  if (partnerId) {
    where.partnerConfigs = { some: { partnerId, isActive: true } };
  }

  const definitions = await prisma.chargeDefinition.findMany({
    where,
    orderBy: [{ phase: "asc" }, { code: "asc" }],
    select: {
      code: true,
      name: true,
      description: true,
      category: true,
      phase: true,
      bookingQuestion: true,
    },
  });

  return definitions.map((d) => ({
    chargeCode: d.code,
    name: d.name,
    description: d.description,
    category: d.category,
    question: d.bookingQuestion,
  }));
}

module.exports = {
  createDefinition,
  listDefinitions,
  getDefinitionById,
  updateDefinition,
  deleteDefinition,
  getDefinitionVersions,
  getBookingQuestions,
};
