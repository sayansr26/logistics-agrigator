// Standard API response utilities

class APIResponse {
  static success(data, meta = {}) {
    const normalizedMeta =
      typeof meta === "string" ? { message: meta } : meta || {};
    return {
      status: "success",
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...normalizedMeta,
      },
    };
  }

  static error(
    message,
    code = "INTERNAL_ERROR",
    details = null,
    statusCode = 500,
  ) {
    return {
      status: "error",
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
      statusCode,
    };
  }

  static paginated(data, pagination) {
    return {
      status: "success",
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination,
      },
    };
  }
}

module.exports = APIResponse;
