/**
 * Admin Logs Controller for Partner Service
 * Partner Service has a different AuditLog schema:
 * - Uses `timestamp` instead of `createdAt`
 * - Uses `resourceType` instead of `resource`
 * - Has `requestData` and `responseData` instead of `changes` and `metadata`
 */

const { prisma } = require("../config/database");
const {
  AuditEventDTO,
  RuntimeLogLineDTO,
  LogCursor,
} = require("../shared/dtos/logsDto");
const {
  readLogFile,
  listLogFiles,
  redactLogLines,
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
        ? LogCursor.decode(cursor).getCursor("partner-service")
        : null;

      // Parse cursor for pagination
      let parsedCursor = null;
      if (serviceCursor) {
        parsedCursor = LogCursor.parseTimestampCursor(serviceCursor);
      }

      // Build Prisma query with filters
      const where = {};
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }
      if (action) where.action = action;
      if (resource) where.resourceType = resource; // Note: different field name
      if (userId) where.userId = userId;
      if (search) {
        where.OR = [
          { action: { contains: search, mode: "insensitive" } },
          { resourceType: { contains: search, mode: "insensitive" } },
        ];
      }

      const take = Math.min(parseInt(limit), 500);
      const query = {
        where,
        take,
        orderBy: { timestamp: "desc" }, // Note: different field name
      };

      // Add cursor pagination
      if (parsedCursor && parsedCursor.timestamp) {
        query.cursor = {
          timestamp: parsedCursor.timestamp,
          id: parsedCursor.id,
        };
        query.skip = 1;
      }

      // Fetch audit logs
      const logs = await prisma.auditLog.findMany(query);

      // Convert to DTOs
      const auditEvents = logs.map((log) =>
        AuditEventDTO.fromPartnerService(log).toJSON(),
      );

      // Extract next cursor
      const nextCursorData = extractNextCursor(logs, "timestamp"); // Note: different field name
      let nextCursor = null;
      if (nextCursorData) {
        const gatewayCursor = new LogCursor();
        gatewayCursor.setCursor(
          "partner-service",
          LogCursor.createTimestampCursor(
            nextCursorData.timestamp,
            nextCursorData.id,
          ),
        );
        nextCursor = gatewayCursor.encode();
      }

      const hasMore = logs.length === take;

      // Log access
      logger.info(`Admin accessed partner-service audit logs`, {
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
          service: "partner-service",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error fetching partner-service audit logs:", error);
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

      const maxLines = Math.min(parseInt(limit), 500);
      const logFiles = listLogFiles("partner-service");

      if (logFiles.length === 0) {
        return res.json({
          status: "success",
          data: [],
          meta: {
            service: "partner-service",
            message: "No log files available",
            timestamp: new Date().toISOString(),
          },
        });
      }

      const targetFile = file || logFiles[0];

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

      let startLine = null;
      if (cursor) {
        const serviceCursor =
          LogCursor.decode(cursor).getCursor("partner-service");
        if (serviceCursor) {
          const parsedCursor = LogCursor.parseRuntimeCursor(serviceCursor);
          if (parsedCursor && parsedCursor.file === targetFile) {
            startLine = parsedCursor.line;
          }
        }
      }

      const result = readLogFile(
        "partner-service",
        targetFile,
        maxLines,
        startLine,
      );

      let logLines = result.lines.map((lineData) =>
        RuntimeLogLineDTO.parseLogLine(
          "partner-service",
          targetFile,
          lineData.text,
          lineData.line,
        ),
      );

      if (level) {
        logLines = logLines.filter(
          (log) => log.parsed && log.parsed.level === level,
        );
      }

      logLines = logLines.map((log) => {
        if (log.raw) {
          log.raw = redactLogLines([{ text: log.raw }])[0].text;
        }
        return log;
      });

      let nextCursor = null;
      if (result.hasMore && result.nextLine) {
        const gatewayCursor = new LogCursor();
        gatewayCursor.setCursor(
          "partner-service",
          LogCursor.createRuntimeCursor(targetFile, result.nextLine),
        );
        nextCursor = gatewayCursor.encode();
      }

      logger.info(`Admin accessed partner-service runtime logs`, {
        requestingUserId: req.user?.userId,
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
          service: "partner-service",
          file: targetFile,
          availableFiles: logFiles,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error fetching partner-service runtime logs:", error);
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
      const logFiles = listLogFiles("partner-service");

      res.json({
        status: "success",
        data: {
          files: logFiles,
          logDirectory: "logs/partner-service",
        },
        meta: {
          service: "partner-service",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error listing partner-service log files:", error);
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
