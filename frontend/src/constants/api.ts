// API Configuration Constants
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://103.17.193.231",

  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTRIES: 3,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: ":3002/auth/login",
    REGISTER: ":3002/auth/register",
    LOGOUT: ":3002/auth/logout",
    REFRESH: ":3002/auth/refresh",
    ME: ":3002/auth/me",
    PROFILE: ":3002/auth/profile",
  },
  USERS: {
    BASE: ":3003/users",
    PROFILE: ":3003/users/profiles",
    SETTINGS: ":3003/users/settings",
  },
  SHIPMENTS: {
    BASE: ":3004/shipments",
    CREATE: ":3004/shipments/create",
    TRACK: ":3004/shipments/track",
  },
  PARTNERS: {
    BASE: ":3005/partners",
    RATES: ":3005/partners/rates",
  },
  WALLET: {
    BASE: ":3006/wallet",
    BALANCE: ":3006/wallet/balance",
    TRANSACTIONS: ":3006/wallet/transactions",
  },
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;
