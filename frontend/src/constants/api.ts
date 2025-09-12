// API Configuration Constants
export const API_CONFIG = {
  // BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://103.17.193.231",
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost",
  TIMEOUT: 36000, // 30 seconds
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
    CREATE: ":3004/api/v1/shipments",
    GET_BY_ID: ":3004/api/v1/shipments",
    UPDATE: ":3004/api/v1/shipments",
    CANCEL: ":3004/api/v1/shipments",
    TRACKING: ":3004/api/v1/shipments",
    TRACKING_EVENTS: ":3004/api/v1/shipments",
  },
  PARTNERS: {
    BASE: ":3005/api/partners",
    RATES: ":3005/api/partners/rates",
    CREATE: ":3005/api/partners",
    UPDATE: ":3005/api/partners",
    DELETE: ":3005/api/partners",
    GET: ":3005/api/partners",
    LIST: ":3005/api/partners",
    SERVICEABILITY: ":3005/api/partners/serviceability",
    CALCULATE: ":3005/api/partners/calculate",
  },
  WALLET: {
    BASE: ":3006/wallet",
    BALANCE: ":3006/wallet/balance",
    TRANSACTIONS: ":3006/wallet/transactions",
  },
  ZONES: {
    CREATE: ":3005/api/zones",
    EDIT: ":3005/api/zones",
    DELETE: ":3005/api/zones",
    GET: ":3005/api/zones",
    LIST: ":3005/api/zones",
    SERVICE_TYPES: ":3005/api/service-types",
    VALIDATE_COVERAGE: ":3005/api/zones/coverage/validate",
    PARTNER_ZONES: ":3005/api/partner-zones",
  },
  GEOGRAPHICAL: {
    BASE: ":3005/api/geographical",
    CREATE: ":3005/api/geographical",
    EDIT: ":3005/api/geographical",
    DELETE: ":3005/api/geographical",
    GET: ":3005/api/geographical",
    STATS: ":3005/api/geographical/stats",
    STATES: ":3005/api/geographical/states",
    CITIES: ":3005/api/geographical/cities",
    AREAS: ":3005/api/geographical/areas",
    PINCODES: ":3005/api/geographical/pincodes",
    SEARCH: ":3005/api/geographical/search",
    DETAILS: ":3005/api/geographical/details",
    HIERARCHY: ":3005/api/geographical/hierarchy",
    HIERARCHY_DETAILS: ":3005/api/geographical/hierarchy/details",
    HIERARCHY_SEARCH: ":3005/api/geographical/hierarchy/search",
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
