const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { errorUtils } = require("../shared/lib/errors");

const errorHandler = (error, req, res, next) => {
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  if (error.isOperational) {
    return res
      .status(error.statusCode)
      .json(APIResponse.error(error.message, error.code, error.details));
  }

  // Unknown error - don't leak details
  return res
    .status(500)
    .json(APIResponse.error("Internal server error", "INTERNAL_ERROR"));
};

module.exports = { errorHandler };
