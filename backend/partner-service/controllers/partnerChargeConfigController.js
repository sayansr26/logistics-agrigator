/**
 * Partner Charge Config Controller (Charges Engine v3)
 *
 * HTTP layer for per-partner charge config values. Business logic lives in
 * partnerChargeConfigService.
 */

const partnerChargeConfigService = require("../services/partnerChargeConfigService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

function getReqContext(req) {
  return {
    userId: req.user?.userId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get?.("User-Agent") || null,
  };
}

async function createConfig(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Creating partner charge config", {
      partnerId: req.body.partnerId,
      chargeDefinitionId: req.body.chargeDefinitionId,
      userId: reqContext.userId,
    });

    const config = await partnerChargeConfigService.createConfig(
      req.body,
      reqContext,
    );

    res
      .status(201)
      .json(
        APIResponse.success(
          { config },
          { message: "Partner charge config created successfully" },
        ),
      );
  } catch (error) {
    logger.error("Error creating partner charge config:", error);
    next(error);
  }
}

async function listConfigs(req, res, next) {
  try {
    const { page, limit, partnerId, chargeDefinitionId, channelId, isActive } =
      req.query;

    const filters = { page, limit, partnerId, chargeDefinitionId, channelId };
    if (typeof isActive === "string") filters.isActive = isActive === "true";
    if (typeof isActive === "boolean") filters.isActive = isActive;

    const result = await partnerChargeConfigService.listConfigs(filters);
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing partner charge configs:", error);
    next(error);
  }
}

async function getConfigById(req, res, next) {
  try {
    const config = await partnerChargeConfigService.getConfigById(
      req.params.id,
    );
    res.json(APIResponse.success({ config }));
  } catch (error) {
    logger.error("Error getting partner charge config:", error);
    next(error);
  }
}

async function updateConfig(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Updating partner charge config", {
      id: req.params.id,
      fields: Object.keys(req.body),
      userId: reqContext.userId,
    });

    const config = await partnerChargeConfigService.updateConfig(
      req.params.id,
      req.body,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { config },
        { message: "Partner charge config updated successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error updating partner charge config:", error);
    next(error);
  }
}

async function deleteConfig(req, res, next) {
  try {
    const reqContext = getReqContext(req);
    logger.info("Deleting partner charge config", {
      id: req.params.id,
      userId: reqContext.userId,
    });

    const config = await partnerChargeConfigService.deleteConfig(
      req.params.id,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { config },
        { message: "Partner charge config deleted successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error deleting partner charge config:", error);
    next(error);
  }
}

async function validateAllConfigs(req, res, next) {
  try {
    const result = await partnerChargeConfigService.validateAllConfigs();
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error validating partner charge configs:", error);
    next(error);
  }
}

module.exports = {
  createConfig,
  listConfigs,
  getConfigById,
  updateConfig,
  deleteConfig,
  validateAllConfigs,
};
