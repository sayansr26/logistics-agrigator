/**
 * Error Handler Utilities
 *
 * Centralized error parsing and user-friendly message mapping
 * for API responses and RTK Query errors
 */

import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * API Error Response Structure (from backend)
 */
interface APIErrorResponse {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Parsed Error Result
 */
export interface ParsedError {
  message: string;
  code: string;
  details?: any;
  statusCode?: number;
}

/**
 * Error Code to User-Friendly Message Mapping
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication Errors (401)
  NO_TOKEN: "Please log in to continue",
  INVALID_TOKEN: "Your session has expired. Please log in again",
  TOKEN_EXPIRED: "Your session has expired. Please log in again",
  UNAUTHORIZED: "You are not authorized to perform this action",

  // Authorization Errors (403)
  FORBIDDEN: "You don't have permission to access this resource",
  INSUFFICIENT_PERMISSIONS: "You don't have the required permissions",
  ACCESS_DENIED: "Access denied. Contact your administrator for access",

  // Validation Errors (400)
  VALIDATION_ERROR: "Please check your input and try again",
  INVALID_INPUT: "Invalid input provided",
  MISSING_REQUIRED_FIELDS: "Please fill in all required fields",
  INVALID_EMAIL: "Please provide a valid email address",
  INVALID_PASSWORD: "Password does not meet requirements",
  DUPLICATE_EMAIL: "This email is already registered",

  // Resource Errors (404)
  NOT_FOUND: "The requested resource was not found",
  USER_NOT_FOUND: "User not found",
  SHIPMENT_NOT_FOUND: "Shipment not found",
  PARTNER_NOT_FOUND: "Partner not found",

  // Server Errors (500)
  INTERNAL_ERROR: "An unexpected error occurred. Please try again",
  DATABASE_ERROR: "Database error. Please contact support",
  SERVICE_UNAVAILABLE:
    "Service temporarily unavailable. Please try again later",

  // Network Errors
  NETWORK_ERROR: "Network error. Please check your connection",
  TIMEOUT: "Request timed out. Please try again",

  // Business Logic Errors
  INSUFFICIENT_BALANCE: "Insufficient wallet balance",
  SHIPMENT_ALREADY_CANCELLED: "This shipment is already cancelled",
  INVALID_STATUS_TRANSITION: "Invalid status transition",
};

/**
 * Check if error is FetchBaseQueryError
 */
function isFetchBaseQueryError(error: any): error is FetchBaseQueryError {
  return error && typeof error === "object" && "status" in error;
}

/**
 * Check if error is SerializedError
 */
function isSerializedError(error: any): error is SerializedError {
  return error && typeof error === "object" && "message" in error;
}

/**
 * Parse RTK Query Error
 *
 * Handles errors from RTK Query mutations and queries
 */
export function parseRTKError(
  error: FetchBaseQueryError | SerializedError | undefined,
): ParsedError {
  // Default error
  const defaultError: ParsedError = {
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
  };

  if (!error) {
    return defaultError;
  }

  // Handle FetchBaseQueryError (HTTP errors)
  if (isFetchBaseQueryError(error)) {
    const statusCode = typeof error.status === "number" ? error.status : 500;

    // Network/CORS errors
    if (error.status === "FETCH_ERROR") {
      return {
        message: ERROR_MESSAGES.NETWORK_ERROR,
        code: "NETWORK_ERROR",
        statusCode: 0,
      };
    }

    // Timeout errors
    if (error.status === "TIMEOUT_ERROR") {
      return {
        message: ERROR_MESSAGES.TIMEOUT,
        code: "TIMEOUT",
        statusCode: 0,
      };
    }

    // Parse error data (from backend API)
    if (error.data && typeof error.data === "object") {
      const apiError = error.data as APIErrorResponse;

      if (apiError.error) {
        const userMessage =
          ERROR_MESSAGES[apiError.error.code] || apiError.error.message;

        return {
          message: userMessage,
          code: apiError.error.code,
          details: apiError.error.details,
          statusCode,
        };
      }
    }

    // Fallback based on status code
    return getErrorByStatusCode(statusCode);
  }

  // Handle SerializedError (runtime errors)
  if (isSerializedError(error)) {
    return {
      message: error.message || defaultError.message,
      code: error.code || "RUNTIME_ERROR",
    };
  }

  return defaultError;
}

/**
 * Get error message based on HTTP status code
 */
function getErrorByStatusCode(statusCode: number): ParsedError {
  switch (statusCode) {
    case 400:
      return {
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        code: "VALIDATION_ERROR",
        statusCode,
      };
    case 401:
      return {
        message: ERROR_MESSAGES.UNAUTHORIZED,
        code: "UNAUTHORIZED",
        statusCode,
      };
    case 403:
      return {
        message: ERROR_MESSAGES.FORBIDDEN,
        code: "FORBIDDEN",
        statusCode,
      };
    case 404:
      return {
        message: ERROR_MESSAGES.NOT_FOUND,
        code: "NOT_FOUND",
        statusCode,
      };
    case 409:
      return {
        message: "A conflict occurred. Please refresh and try again",
        code: "CONFLICT",
        statusCode,
      };
    case 429:
      return {
        message: "Too many requests. Please try again later",
        code: "RATE_LIMIT",
        statusCode,
      };
    case 500:
      return {
        message: ERROR_MESSAGES.INTERNAL_ERROR,
        code: "INTERNAL_ERROR",
        statusCode,
      };
    case 503:
      return {
        message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
        code: "SERVICE_UNAVAILABLE",
        statusCode,
      };
    default:
      return {
        message: "An unexpected error occurred",
        code: "UNKNOWN_ERROR",
        statusCode,
      };
  }
}

/**
 * Get user-friendly error message
 *
 * @param error - Error from RTK Query
 * @returns User-friendly error message string
 */
export function getErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  const parsedError = parseRTKError(error);
  return parsedError.message;
}

/**
 * Get error code
 *
 * @param error - Error from RTK Query
 * @returns Error code string
 */
export function getErrorCode(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  const parsedError = parseRTKError(error);
  return parsedError.code;
}

/**
 * Check if error is authentication error (401)
 */
export function isAuthError(
  error: FetchBaseQueryError | SerializedError | undefined,
): boolean {
  if (!error || !isFetchBaseQueryError(error)) {
    return false;
  }
  return error.status === 401;
}

/**
 * Check if error is authorization error (403)
 */
export function isAuthorizationError(
  error: FetchBaseQueryError | SerializedError | undefined,
): boolean {
  if (!error || !isFetchBaseQueryError(error)) {
    return false;
  }
  return error.status === 403;
}

/**
 * Check if error is validation error (400)
 */
export function isValidationError(
  error: FetchBaseQueryError | SerializedError | undefined,
): boolean {
  if (!error || !isFetchBaseQueryError(error)) {
    return false;
  }
  return error.status === 400;
}

/**
 * Check if error is server error (500+)
 */
export function isServerError(
  error: FetchBaseQueryError | SerializedError | undefined,
): boolean {
  if (!error || !isFetchBaseQueryError(error)) {
    return false;
  }
  const status = typeof error.status === "number" ? error.status : 0;
  return status >= 500;
}

/**
 * Check if error is network error
 */
export function isNetworkError(
  error: FetchBaseQueryError | SerializedError | undefined,
): boolean {
  if (!error || !isFetchBaseQueryError(error)) {
    return false;
  }
  return error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR";
}

/**
 * Format validation errors from backend
 *
 * @param details - Validation error details from backend
 * @returns Formatted error messages array
 */
export function formatValidationErrors(details: any): string[] {
  if (!details) {
    return [];
  }

  // If details is an array of validation errors
  if (Array.isArray(details)) {
    return details.map((err) => {
      if (typeof err === "string") {
        return err;
      }
      if (err.message) {
        return err.message;
      }
      return JSON.stringify(err);
    });
  }

  // If details is an object with field errors
  if (typeof details === "object") {
    return Object.entries(details).map(([field, message]) => {
      return `${field}: ${message}`;
    });
  }

  return [String(details)];
}

/**
 * Log error for debugging (development only)
 *
 * @param error - Error object
 * @param context - Optional context string
 */
export function logError(error: any, context?: string): void {
  if (process.env.NODE_ENV === "development") {
    const prefix = context ? `[${context}]` : "[Error]";
    console.error(prefix, error);

    // Log parsed error for RTK Query errors
    if (isFetchBaseQueryError(error) || isSerializedError(error)) {
      const parsed = parseRTKError(error);
      console.error(`${prefix} Parsed:`, parsed);
    }
  }
}

/**
 * Create error report for support
 *
 * @param error - Error object
 * @param userContext - User context (id, email, etc.)
 * @returns Error report object
 */
export function createErrorReport(error: any, userContext?: any): object {
  const parsed = parseRTKError(error);

  return {
    timestamp: new Date().toISOString(),
    error: {
      message: parsed.message,
      code: parsed.code,
      statusCode: parsed.statusCode,
      details: parsed.details,
    },
    userContext,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    url: typeof window !== "undefined" ? window.location.href : "unknown",
  };
}
