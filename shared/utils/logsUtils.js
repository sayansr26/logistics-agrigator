/**
 * Shared Utilities for Logs API
 * Log file reading, cursor pagination, and sensitive data redaction
 */

const fs = require("fs");
const path = require("path");

/**
 * Get log directory for a service
 */
function getLogDirectory(serviceName) {
  const projectRoot = path.resolve(__dirname, "../..");
  return path.join(projectRoot, "logs", serviceName);
}

/**
 * List available log files for a service
 */
function listLogFiles(serviceName) {
  const logsDir = getLogDirectory(serviceName);

  if (!fs.existsSync(logsDir)) {
    return [];
  }

  const files = fs.readdirSync(logsDir);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}(-error)?\.log$/.test(f))
    .sort()
    .reverse();
}

/**
 * Read log file with tail support
 * @param {string} serviceName - Service name
 * @param {string} fileName - Log file name (YYYY-MM-DD.log or YYYY-MM-DD-error.log)
 * @param {number} maxLines - Maximum lines to read (default 200, max 500)
 * @param {number} startLine - Start from line number (for cursor pagination)
 */
function readLogFile(serviceName, fileName, maxLines = 200, startLine = null) {
  const logsDir = getLogDirectory(serviceName);
  const filePath = path.join(logsDir, fileName);

  // Validate file exists and prevent path traversal
  if (!filePath.startsWith(logsDir)) {
    throw new Error("Invalid log file path");
  }

  if (!fs.existsSync(filePath)) {
    return { lines: [], totalLines: 0, fileName };
  }

  // Read file
  const content = fs.readFileSync(filePath, "utf-8");
  const allLines = content.split("\n").filter((l) => l.trim());

  // Apply cursor pagination
  const startIndex = startLine !== null ? parseInt(startLine, 10) : 0;
  const endIndex = Math.min(startIndex + maxLines, allLines.length);
  const lines = allLines.slice(startIndex, endIndex).map((line, index) => ({
    line: startIndex + index + 1,
    text: line,
  }));

  return {
    lines,
    totalLines: allLines.length,
    fileName,
    hasMore: endIndex < allLines.length,
    nextLine: endIndex < allLines.length ? endIndex : null,
  };
}

/**
 * Sensitive data redaction patterns
 */
const REDACTION_PATTERNS = [
  // Bearer tokens
  {
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: "Bearer [REDACTED]",
  },
  // API keys in headers
  {
    pattern:
      /(?:api[_-]?key|apikey|authorization)["']?\s*[:=]\s*["']?([A-Za-z0-9\-._~+/]{20,})["']?/gi,
    replacement: "[REDACTED_API_KEY]",
  },
  // Passwords
  {
    pattern: /(?:password|passwd|pwd)["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi,
    replacement: "password=[REDACTED]",
  },
  // JWT tokens
  {
    pattern: /eyJ[A-Za-z0-9\-_.]+\.eyJ[A-Za-z0-9\-_.]+\.[A-Za-z0-9\-_.]+/g,
    replacement: "[JWT_REDACTED]",
  },
  // Email addresses (optional - GDPR)
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL_REDACTED]",
  },
  // Credit card numbers (basic pattern)
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
];

/**
 * Redact sensitive data from log line
 */
function redactSensitiveData(logLine) {
  let redacted = logLine;

  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Batch redact multiple log lines
 */
function redactLogLines(lines) {
  return lines.map((line) => ({
    ...line,
    text: redactSensitiveData(line.text),
  }));
}

/**
 * Build Prisma query with cursor pagination for audit logs
 */
function buildAuditLogQuery(filters = {}, cursor = null) {
  const where = {};

  // Date range filter
  if (filters.startDate || filters.endDate) {
    where.timestamp = filters.createdAt || {};
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate;
    }
  }

  // Service-specific field mapping
  const timestampField = filters.timestampField || "createdAt";

  // Action filter
  if (filters.action) {
    where.action = filters.action;
  }

  // Resource filter
  if (filters.resource) {
    where.resource = filters.resource;
  }

  // User ID filter
  if (filters.userId) {
    where.userId = filters.userId;
  }

  // Client ID filter (for user-service)
  if (filters.clientId) {
    where.clientId = filters.clientId;
  }

  // Search filter (case-insensitive search in changes/metadata)
  if (filters.search) {
    where.OR = [
      { action: { contains: filters.search, mode: "insensitive" } },
      { resource: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Cursor pagination
  const take = Math.min(filters.limit || 200, 500);
  let cursorQuery = {};

  if (cursor) {
    const { timestamp, id } = cursor;
    cursorQuery = {
      cursor: {
        [timestampField]: timestamp,
        id,
      },
      skip: 1,
    };
  }

  return {
    where,
    take,
    orderBy: { [timestampField]: "desc" },
    ...cursorQuery,
  };
}

/**
 * Extract next cursor from audit log results
 */
function extractNextCursor(logs, timestampField = "createdAt") {
  if (logs.length === 0) return null;

  const lastLog = logs[logs.length - 1];
  return {
    timestamp: lastLog[timestampField],
    id: lastLog.id,
  };
}

/**
 * Merge audit logs from multiple services
 * Sorts by timestamp and applies pagination
 */
function mergeAuditLogs(serviceLogs, limit = 200) {
  // Flatten all logs
  const allLogs = Object.values(serviceLogs).flat();

  // Sort by timestamp descending
  allLogs.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });

  // Apply limit
  const paginatedLogs = allLogs.slice(0, limit);

  // Extract next cursor
  const nextCursor =
    paginatedLogs.length > 0 && paginatedLogs.length === allLogs.length
      ? extractNextCursor(paginatedLogs)
      : null;

  return {
    logs: paginatedLogs,
    hasMore: paginatedLogs.length < allLogs.length,
    nextCursor,
  };
}

/**
 * Get available log dates for a service
 */
function getAvailableLogDates(serviceName) {
  const files = listLogFiles(serviceName);
  const dates = new Set();

  for (const file of files) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      dates.add(match[1]);
    }
  }

  return Array.from(dates).sort().reverse();
}

/**
 * Validate service has logs enabled
 */
function serviceHasLogs(serviceName) {
  const logsDir = getLogDirectory(serviceName);
  return fs.existsSync(logsDir);
}

module.exports = {
  getLogDirectory,
  listLogFiles,
  readLogFile,
  redactSensitiveData,
  redactLogLines,
  buildAuditLogQuery,
  extractNextCursor,
  mergeAuditLogs,
  getAvailableLogDates,
  serviceHasLogs,
  REDACTION_PATTERNS,
};
