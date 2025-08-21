// Proper logger with winston fallback
let winston;
let logger;

try {
  // Try to use winston if available
  winston = require("winston");

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(
        ({ timestamp, level, message, service = "app", ...meta }) => {
          const metaStr =
            Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
          return `[${timestamp}] ${level.toUpperCase()} [${service}] ${message}${metaStr}`;
        }
      )
    ),
    defaultMeta: {
      service: process.env.SERVICE_NAME || "logistics-service",
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, service = "app", ...meta }) => {
              const metaStr =
                Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
              return `[${timestamp}] ${level} [${service}] ${message}${metaStr}`;
            }
          )
        ),
      }),
    ],
  });

  // Add file transport in production
  if (process.env.NODE_ENV === "production") {
    logger.add(
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    logger.add(
      new winston.transports.File({
        filename: "logs/combined.log",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  // Add HTTP middleware
  logger.httpLogger = (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const url = req.url;
      const userAgent = req.get("User-Agent") || "-";
      const ip = req.ip || req.connection.remoteAddress || "-";

      const level = status >= 400 ? "warn" : "info";
      logger[level](`${method} ${url} ${status} ${duration}ms`, {
        method,
        url,
        status,
        duration,
        userAgent,
        ip,
      });
    });

    next();
  };
} catch (error) {
  // Fallback to console logger if winston is not available
  console.warn("Winston not available, using console logger fallback");

  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
  };

  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  class ConsoleLogger {
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

      const metaStr =
        Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
      return `${color}[${timestamp}] ${level.toUpperCase()} [${this.service}]${colors.reset} ${message}${metaStr}`;
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

    get httpLogger() {
      return (req, res, next) => {
        const start = Date.now();

        res.on("finish", () => {
          const duration = Date.now() - start;
          const status = res.statusCode;
          const method = req.method;
          const url = req.url;
          const userAgent = req.get("User-Agent") || "-";
          const ip = req.ip || req.connection.remoteAddress || "-";

          const level = status >= 400 ? "warn" : "info";
          this[level](`${method} ${url} ${status} ${duration}ms`, {
            method,
            url,
            status,
            duration,
            userAgent,
            ip,
          });
        });

        next();
      };
    }
  }

  logger = new ConsoleLogger();
}

module.exports = logger;
