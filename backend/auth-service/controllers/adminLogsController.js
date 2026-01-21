/**
 * Admin Logs Controller for Auth Service
 * Provides audit logs (DB) and runtime logs (file tail) for admin access
 */

const { prisma } = require("../config/database");
const {
  AuditEventDTO,
  RuntimeLogLineDTO,
  LogCursor,
  PaginatedLogsResponse,
} = require("../shared/dtos/logsDto");
const {
  readLogFile,
  listLogFiles,
  redactLogLines,
  buildAuditLogQuery,
  extractNextCursor,
} = require("../shared/utils/logsUtils");
const logger = require("../shared/lib/logger");

class AdminLogsController {
  /**
   * GET /admin/audit-logs
   * Get audit logs from database with cursor pagination
   */
  static async getAuditLogs(req, res) {
    try {
      const {
        limit = 200,
        cursor,
        startDate,
        endDate,
        action,
        resource,
        userId,
        search,
      } = req.query;

      // Decode cursor if provided
      const serviceCursor = cursor
        ? LogCursor.decode(cursor).getCursor("auth-service")
        : null;

      // Parse cursor for pagination
      let parsedCursor = null;
      if (serviceCursor) {
        parsedCursor = LogCursor.parseTimestampCursor(serviceCursor);
      }

      // Build Prisma query with filters
      const where = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }
      if (action) where.action = action;
      if (resource) where.resource = resource;
      if (userId) where.userId = userId;
      if (search) {
        where.OR = [
          { action: { contains: search, mode: "insensitive" } },
          { resource: { contains: search, mode: "insensitive" } },
        ];
      }

      const take = Math.min(parseInt(limit), 500);
      const query = {
        where,
        take,
        orderBy: { createdAt: "desc" },
      };

      // Add cursor pagination
      if (parsedCursor && parsedCursor.timestamp) {
        query.cursor = {
          createdAt: parsedCursor.timestamp,
          id: parsedCursor.id,
        };
        query.skip = 1;
      }

      // Fetch audit logs
      const logs = await prisma.auditLog.findMany({
        ...query,
        select: {
          id: true,
          userId: true,
          action: true,
          resource: true,
          resourceId: true,
          changes: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      });

      // Convert to DTOs
      const auditEvents = logs.map((log) =>
        AuditEventDTO.fromAuthService(log).toJSON(),
      );

      // Extract next cursor
      const nextCursorData = extractNextCursor(logs, "createdAt");
      let nextCursor = null;
      if (nextCursorData) {
        const gatewayCursor = new LogCursor();
        gatewayCursor.setCursor(
          "auth-service",
          LogCursor.createTimestampCursor(
            nextCursorData.timestamp,
            nextCursorData.id,
          ),
        );
        nextCursor = gatewayCursor.encode();
      }

      const hasMore = logs.length === take;

      // Log access
      logger.info(`Admin accessed auth-service audit logs`, {
        requestingUserId: req.user?.userId,
        requestingRole: req.user?.role,
        resultCount: logs.length,
      });

      res.json({
        status: "success",
        data: auditEvents,
        pagination: {
          nextCursor,
          hasMore,
        },
        meta: {
          service: "auth-service",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error fetching auth-service audit logs:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch audit logs",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /admin/runtime-logs
   * Get runtime logs from Winston log files with tail support
   */
  static async getRuntimeLogs(req, res) {
    try {
      const { file, level = null, limit = 200, cursor } = req.query;

      // Validate limit
      const maxLines = Math.min(parseInt(limit), 500);

      // Get available log files
      const logFiles = listLogFiles("auth-service");

      if (logFiles.length === 0) {
        return res.json({
          status: "success",
          data: [],
          meta: {
            service: "auth-service",
            message: "No log files available",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Determine which file to read
      const targetFile = file || logFiles[0];

      // Validate file name
      const validFilePattern = /^\d{4}-\d{2}-\d{2}(-error)?\.log$/;
      if (!validFilePattern.test(targetFile)) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "INVALID_FILE",
            message:
              "Invalid log file name. Must be in format YYYY-MM-DD.log or YYYY-MM-DD-error.log",
          },
        });
      }

      // Parse cursor for runtime logs
      let startLine = null;
      if (cursor) {
        const serviceCursor =
          LogCursor.decode(cursor).getCursor("auth-service");
        if (serviceCursor) {
          const parsedCursor = LogCursor.parseRuntimeCursor(serviceCursor);
          if (parsedCursor && parsedCursor.file === targetFile) {
            startLine = parsedCursor.line;
          }
        }
      }

      // Read log file
      const result = readLogFile(
        "auth-service",
        targetFile,
        maxLines,
        startLine,
      );

      // Parse and filter log lines
      let logLines = result.lines.map((lineData) =>
        RuntimeLogLineDTO.parseLogLine(
          "auth-service",
          targetFile,
          lineData.text,
          lineData.line,
        ),
      );

      // Filter by level if specified
      if (level) {
        logLines = logLines.filter(
          (log) => log.parsed && log.parsed.level === level,
        );
      }

      // Redact sensitive data
      logLines = logLines.map((log) => {
        if (log.raw) {
          log.raw = redactLogLines([{ text: log.raw }])[0].text;
        }
        return log;
      });

      // Build next cursor
      let nextCursor = null;
      if (result.hasMore && result.nextLine) {
        const gatewayCursor = new LogCursor();
        gatewayCursor.setCursor(
          "auth-service",
          LogCursor.createRuntimeCursor(targetFile, result.nextLine),
        );
        nextCursor = gatewayCursor.encode();
      }

      // Log access
      logger.info(`Admin accessed auth-service runtime logs`, {
        requestingUserId: req.user?.userId,
        requestingRole: req.user?.role,
        file: targetFile,
        linesReturned: logLines.length,
      });

      res.json({
        status: "success",
        data: logLines.map((log) => log.toJSON()),
        pagination: {
          nextCursor,
          hasMore: result.hasMore,
        },
        meta: {
          service: "auth-service",
          file: targetFile,
          availableFiles: logFiles,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error fetching auth-service runtime logs:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch runtime logs",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /admin/log-files
   * List available log files
   */
  static async listLogFiles(req, res) {
    try {
      const logFiles = listLogFiles("auth-service");

      res.json({
        status: "success",
        data: {
          files: logFiles,
          logDirectory: "logs/auth-service",
        },
        meta: {
          service: "auth-service",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error listing auth-service log files:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list log files",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

module.exports = AdminLogsController;
