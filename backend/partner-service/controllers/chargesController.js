/**
 * Charges Rule Controller
 *
 * Handles HTTP request/response for charge rule operations.
 * All business logic is delegated to chargesService.
 * Following auth-service patterns (function-based, no inline route logic).
 */

const chargesService = require("../services/chargesService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Extract request context for audit logging
 */
function getReqContext(req) {
  return {
    userId: req.user?.userId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get?.("User-Agent") || null,
  };
}

// ========================================
// CONTROLLER FUNCTIONS
// ========================================

/**
 * Create a charge rule
 * POST /api/v1/charges
 */
async function createChargeRule(req, res, next) {
  try {
    const ruleData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Creating charge rule", {
      partnerId: ruleData.partnerId,
      kind: ruleData.kind,
      base: ruleData.base,
      userId: reqContext.userId,
    });

    const chargeRule = await chargesService.createChargeRule(
      ruleData,
      reqContext,
    );

    res
      .status(201)
      .json(
        APIResponse.success(
          { chargeRule },
          { message: "Charge rule created successfully" },
        ),
      );
  } catch (error) {
    logger.error("Error creating charge rule:", error);
    next(error);
  }
}

/**
 * List charge rules with filters and pagination
 * GET /api/v1/charges
 */
async function listChargeRules(req, res, next) {
  try {
    const {
      page,
      limit,
      partnerId,
      kind,
      chargesTypeId,
      base,
      isActive,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      partnerId,
      kind,
      chargesTypeId,
      base,
      search,
      sortBy: sortBy || "createdAt",
      sortOrder: sortOrder || "desc",
    };

    if (typeof isActive === "string") {
      filters.isActive = isActive === "true";
    }

    logger.info("Listing charge rules", {
      filters,
      userId: req.user?.userId,
    });

    const result = await chargesService.listChargeRules(filters);

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing charge rules:", error);
    next(error);
  }
}

/**
 * Get charge rule by ID
 * GET /api/v1/charges/:id
 */
async function getChargeRuleById(req, res, next) {
  try {
    const { id } = req.params;

    const chargeRule = await chargesService.getChargeRuleById(id);

    res.json(APIResponse.success({ chargeRule }));
  } catch (error) {
    logger.error("Error getting charge rule:", error);
    next(error);
  }
}

/**
 * Update charge rule
 * PUT /api/v1/charges/:id
 */
async function updateChargeRule(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Updating charge rule", {
      chargeRuleId: id,
      updateFields: Object.keys(updateData),
      userId: reqContext.userId,
    });

    const updatedChargeRule = await chargesService.updateChargeRule(
      id,
      updateData,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { chargeRule: updatedChargeRule },
        { message: "Charge rule updated successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error updating charge rule:", error);
    next(error);
  }
}

/**
 * Delete (soft-delete) charge rule
 * DELETE /api/v1/charges/:id
 */
async function deleteChargeRule(req, res, next) {
  try {
    const { id } = req.params;
    const reqContext = getReqContext(req);

    logger.info("Deleting charge rule", {
      chargeRuleId: id,
      userId: reqContext.userId,
    });

    const deletedChargeRule = await chargesService.deleteChargeRule(
      id,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { chargeRule: deletedChargeRule },
        { message: "Charge rule disabled successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error deleting charge rule:", error);
    next(error);
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createChargeRule,
  listChargeRules,
  getChargeRuleById,
  updateChargeRule,
  deleteChargeRule,
};
