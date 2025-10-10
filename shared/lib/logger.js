// Enhanced logger with service-specific daily log rotation
const path = require("path");
let winston;
let DailyRotateFile;
let logger;

try {
  // Try to use winston and winston-daily-rotate-file if available
  winston = require("winston");

  // Enhanced module resolution for winston-daily-rotate-file
  try {
    DailyRotateFile = require("winston-daily-rotate-file");
  } catch (rotateError) {
    // Try alternative resolution paths for Docker/PNPM environment
    const possiblePaths = [
      // Direct path to pnpm symlink
      path.resolve(__dirname, "../node_modules/winston-daily-rotate-file"),
      // Absolute container path
      "/app/shared/node_modules/winston-daily-rotate-file",
      // Resolve through pnpm structure
      path.resolve(
        __dirname,
        "../node_modules/.pnpm/winston-daily-rotate-file@4.7.1_winston@3.17.0/node_modules/winston-daily-rotate-file",
      ),
    ];

    let moduleLoaded = false;
    for (const modulePath of possiblePaths) {
      try {
        if (require("fs").existsSync(modulePath)) {
          DailyRotateFile = require(modulePath);
          moduleLoaded = true;
          console.log(
            `Successfully loaded winston-daily-rotate-file from: ${modulePath}`,
          );
          break;
        }
      } catch (pathError) {
        continue; // Try next path
      }
    }

    if (!moduleLoaded) {
      throw new Error(
        "winston-daily-rotate-file not found in any expected location",
      );
    }
  }

  // Get service name from environment or default
  const serviceName = process.env.SERVICE_NAME || "logistics-service";

  // Get project root path - go up from shared/lib/ to project root
  const projectRoot = path.resolve(__dirname, "../..");
  const logsDir = path.join(projectRoot, "logs", serviceName);

  // Ensure log directory exists with permission error handling
  const fs = require("fs");
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (mkdirError) {
    // If we can't create logs directory (permission issue in Docker), throw to trigger fallback
    throw new Error(
      `Cannot create logs directory: ${mkdirError.message}. Will use console fallback.`,
    );
  }

  // Custom format for better readability and audit trail
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({
        timestamp,
        level,
        message,
        service,
        userId,
        action,
        resource,
        ip,
        ...meta
      }) => {
        // Enhanced format for audit logging
        let logEntry = `[${timestamp}] ${level.toUpperCase()} [${service || serviceName}]`;

        // Add audit information if available
        if (userId || action || resource) {
          logEntry += ` [AUDIT: userId=${userId || "anonymous"}, action=${action || "unknown"}, resource=${resource || "unknown"}]`;
        }

        // Add IP address if available
        if (ip) {
          logEntry += ` [IP: ${ip}]`;
        }

        logEntry += ` ${message}`;

        // Add metadata if present
        const metaKeys = Object.keys(meta).filter(
          (key) =>
            ![
              "timestamp",
              "level",
              "service",
              "userId",
              "action",
              "resource",
              "ip",
            ].includes(key),
        );
        if (metaKeys.length > 0) {
          const sanitizedMeta = {};
          metaKeys.forEach((key) => {
            // Sanitize sensitive data for file logs (but keep detailed logs locally)
            if (
              key.toLowerCase().includes("password") ||
              key.toLowerCase().includes("token") ||
              key.toLowerCase().includes("secret")
            ) {
              sanitizedMeta[key] = "[REDACTED]";
            } else {
              sanitizedMeta[key] = meta[key];
            }
          });
          logEntry += ` ${JSON.stringify(sanitizedMeta)}`;
        }

        return logEntry;
      },
    ),
  );

  // Console format (more colorful for development)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message, service, userId, action, ...meta }) => {
        let logEntry = `[${timestamp}] ${level} [${service || serviceName}]`;

        if (userId) logEntry += ` [User: ${userId}]`;
        if (action) logEntry += ` [${action}]`;

        logEntry += ` ${message}`;

        const metaKeys = Object.keys(meta).filter(
          (key) =>
            !["timestamp", "level", "service", "userId", "action"].includes(
              key,
            ),
        );
        if (metaKeys.length > 0) {
          const filteredMeta = {};
          metaKeys.forEach((key) => {
            if (
              !key.toLowerCase().includes("password") &&
              !key.toLowerCase().includes("token")
            ) {
              filteredMeta[key] = meta[key];
            }
          });
          if (Object.keys(filteredMeta).length > 0) {
            logEntry += ` ${JSON.stringify(filteredMeta)}`;
          }
        }

        return logEntry;
      },
    ),
  );

  // Create daily rotate file transport for all logs
  const dailyRotateTransport = new DailyRotateFile({
    filename: path.join(logsDir, "%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "30d", // Keep 30 days of logs
    format: logFormat,
    auditFile: path.join(logsDir, "audit.json"),
  });

  // Create daily rotate file transport for errors only
  const errorRotateTransport = new DailyRotateFile({
    filename: path.join(logsDir, "%DATE%-error.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "30d",
    level: "error",
    format: logFormat,
    auditFile: path.join(logsDir, "error-audit.json"),
  });

  // Create the enhanced logger
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: {
      service: serviceName,
    },
    transports: [
      // Console transport for development
      new winston.transports.Console({
        format: consoleFormat,
        silent: process.env.NODE_ENV === "test", // Silence console in tests
      }),
      // Daily rotating file transport for all logs
      dailyRotateTransport,
      // Daily rotating file transport for errors only
      errorRotateTransport,
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(logsDir, "%DATE%-exceptions.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
        format: logFormat,
      }),
    ],
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(logsDir, "%DATE%-rejections.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
        format: logFormat,
      }),
    ],
  });

  // Add event listeners for log rotation events
  // NOTE: Commenting out to prevent logger recursion issues
  // dailyRotateTransport.on("rotate", (oldFilename, newFilename) => {
  //   logger.info(`Log rotated from ${oldFilename} to ${newFilename}`);
  // });

  // dailyRotateTransport.on("new", (newFilename) => {
  //   logger.info(`New log file created: ${newFilename}`);
  // });

  // Enhanced HTTP middleware with comprehensive request logging
  logger.httpLogger = (req, res, next) => {
    const start = Date.now();
    const originalUrl = req.originalUrl || req.url;

    // Log incoming request
    logger.info(`Incoming request: ${req.method} ${originalUrl}`, {
      method: req.method,
      url: originalUrl,
      userAgent: req.get("User-Agent") || "unknown",
      ip: req.ip || req.connection.remoteAddress || "unknown",
      userId: req.user?.id,
      contentLength: req.get("Content-Length") || 0,
    });

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const url = originalUrl;
      const userAgent = req.get("User-Agent") || "unknown";
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const userId = req.user?.id;

      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

      logger[level](`${method} ${url} ${status} ${duration}ms`, {
        method,
        url,
        status,
        duration,
        userAgent,
        ip,
        userId,
        responseTime: duration,
        statusCode: status,
      });

      // Log slow requests (> 1000ms) as warnings
      if (duration > 1000) {
        logger.warn(
          `Slow request detected: ${method} ${url} took ${duration}ms`,
          {
            method,
            url,
            duration,
            userId,
            ip,
          },
        );
      }
    });

    next();
  };

  // Enhanced audit logging method
  logger.audit = (action, resource, userId, metadata = {}) => {
    logger.info(`Audit: ${action} on ${resource}`, {
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  };

  // Performance logging method
  logger.performance = (operation, duration, metadata = {}) => {
    const level = duration > 5000 ? "warn" : duration > 1000 ? "info" : "debug";
    logger[level](`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      performanceMetric: true,
      ...metadata,
    });
  };

  // Database query logging method
  logger.query = (query, duration, metadata = {}) => {
    logger.debug(
      `Database query: ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}`,
      {
        queryType: "database",
        duration,
        query: query.length > 500 ? query.substring(0, 500) + "..." : query,
        ...metadata,
      },
    );

    // Log slow queries as warnings
    if (duration > 1000) {
      logger.warn(`Slow database query detected: ${duration}ms`, {
        queryType: "database",
        duration,
        query: query.substring(0, 200),
        ...metadata,
      });
    }
  };

  // Service startup information
  logger.info(`Enhanced logging initialized for service: ${serviceName}`, {
    service: serviceName,
    logDirectory: logsDir,
    logLevel: process.env.LOG_LEVEL || "info",
    nodeEnv: process.env.NODE_ENV || "development",
    dailyRotation: true,
    auditLogging: true,
  });
} catch (error) {
  // Fallback to enhanced console logger if winston is not available
  console.warn("Winston not available, using enhanced console logger fallback");
  console.warn("Actual error:", error.message);
  console.warn("Error stack:", error.stack);

  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    magenta: "\x1b[35m",
  };

  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  class EnhancedConsoleLogger {
    constructor() {
      this.level = process.env.LOG_LEVEL || "info";
      this.service = process.env.SERVICE_NAME || "app";
    }

    _shouldLog(level) {
      return levels[level] <= levels[this.level];
    }

    _formatMessage(level, message, meta = {}) {
      const timestamp = new Date().toISOString();
      const color =
        {
          error: colors.red,
          warn: colors.yellow,
          info: colors.blue,
          debug: colors.gray,
        }[level] || colors.reset;

      let logEntry = `${color}[${timestamp}] ${level.toUpperCase()} [${this.service}]${colors.reset}`;

      if (meta.userId) logEntry += ` [User: ${meta.userId}]`;
      if (meta.action) logEntry += ` [${meta.action}]`;

      logEntry += ` ${message}`;

      const metaKeys = Object.keys(meta).filter(
        (key) =>
          !["userId", "action", "timestamp", "level", "service"].includes(key),
      );
      if (metaKeys.length > 0) {
        const filteredMeta = {};
        metaKeys.forEach((key) => {
          if (
            !key.toLowerCase().includes("password") &&
            !key.toLowerCase().includes("token")
          ) {
            filteredMeta[key] = meta[key];
          }
        });
        if (Object.keys(filteredMeta).length > 0) {
          logEntry += ` ${JSON.stringify(filteredMeta)}`;
        }
      }

      return logEntry;
    }

    error(message, meta = {}) {
      if (this._shouldLog("error")) {
        console.error(this._formatMessage("error", message, meta));
      }
    }

    warn(message, meta = {}) {
      if (this._shouldLog("warn")) {
        console.warn(this._formatMessage("warn", message, meta));
      }
    }

    info(message, meta = {}) {
      if (this._shouldLog("info")) {
        console.log(this._formatMessage("info", message, meta));
      }
    }

    debug(message, meta = {}) {
      if (this._shouldLog("debug")) {
        console.log(this._formatMessage("debug", message, meta));
      }
    }

    audit(action, resource, userId, metadata = {}) {
      this.info(`Audit: ${action} on ${resource}`, {
        action,
        resource,
        userId,
        ...metadata,
      });
    }

    performance(operation, duration, metadata = {}) {
      const level = duration > 5000 ? "warn" : "info";
      this[level](`Performance: ${operation} took ${duration}ms`, {
        operation,
        duration,
        ...metadata,
      });
    }

    query(query, duration, metadata = {}) {
      this.debug(`Database query: ${query.substring(0, 100)}`, {
        duration,
        ...metadata,
      });
    }

    get httpLogger() {
      return (req, res, next) => {
        const start = Date.now();
        const originalUrl = req.originalUrl || req.url;

        res.on("finish", () => {
          const duration = Date.now() - start;
          const status = res.statusCode;
          const method = req.method;
          const level =
            status >= 500 ? "error" : status >= 400 ? "warn" : "info";

          this[level](`${method} ${originalUrl} ${status} ${duration}ms`, {
            method,
            url: originalUrl,
            status,
            duration,
            ip: req.ip || "unknown",
            userId: req.user?.id,
          });
        });

        next();
      };
    }
  }

  logger = new EnhancedConsoleLogger();

  // Log fallback initialization
  logger.info(
    `Enhanced console logger fallback initialized for service: ${process.env.SERVICE_NAME || "app"}`,
    {
      fallback: true,
      logLevel: process.env.LOG_LEVEL || "info",
    },
  );
}

module.exports = logger;
