/**
 * Charge Definition Controller (Charges Engine v3)
 *
 * HTTP layer for the dynamic charge catalog. Business logic lives in
 * chargeDefinitionService.
 */

const chargeDefinitionService = require("../services/chargeDefinitionService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

function getReqContext(req) {
  return {
    userId: req.user?.userId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get?.("User-Agent") || null,
  };
}

async function createDefinition(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Creating charge definition", {
      code: req.body.code,
      userId: reqContext.userId,
    });

    const definition = await chargeDefinitionService.createDefinition(
      req.body,
      reqContext,
    );

    res
      .status(201)
      .json(
        APIResponse.success(
          { definition },
          { message: "Charge definition created successfully" },
        ),
      );
  } catch (error) {
    logger.error("Error creating charge definition:", error);
    next(error);
  }
}

async function listDefinitions(req, res, next) {
  try {
    const { page, limit, category, applyStage, isActive, search } = req.query;

    const filters = { page, limit, category, applyStage, search };
    if (typeof isActive === "string") filters.isActive = isActive === "true";
    if (typeof isActive === "boolean") filters.isActive = isActive;

    const result = await chargeDefinitionService.listDefinitions(filters);
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing charge definitions:", error);
    next(error);
  }
}

async function getDefinitionById(req, res, next) {
  try {
    const definition = await chargeDefinitionService.getDefinitionById(
      req.params.id,
    );
    res.json(APIResponse.success({ definition }));
  } catch (error) {
    logger.error("Error getting charge definition:", error);
    next(error);
  }
}

async function updateDefinition(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Updating charge definition", {
      id: req.params.id,
      fields: Object.keys(req.body),
      userId: reqContext.userId,
    });

    const definition = await chargeDefinitionService.updateDefinition(
      req.params.id,
      req.body,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { definition },
        { message: "Charge definition updated successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error updating charge definition:", error);
    next(error);
  }
}

async function deleteDefinition(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Deleting charge definition", {
      id: req.params.id,
      userId: reqContext.userId,
    });

    const definition = await chargeDefinitionService.deleteDefinition(
      req.params.id,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { definition },
        { message: "Charge definition deleted successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error deleting charge definition:", error);
    next(error);
  }
}

async function getDefinitionVersions(req, res, next) {
  try {
    const versions = await chargeDefinitionService.getDefinitionVersions(
      req.params.id,
    );
    res.json(APIResponse.success({ versions }));
  } catch (error) {
    logger.error("Error getting charge definition versions:", error);
    next(error);
  }
}

async function getBookingQuestions(req, res, next) {
  try {
    const { partnerId } = req.query;
    const questions = await chargeDefinitionService.getBookingQuestions({
      partnerId,
    });
    res.json(APIResponse.success({ questions }));
  } catch (error) {
    logger.error("Error getting booking questions:", error);
    next(error);
  }
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
