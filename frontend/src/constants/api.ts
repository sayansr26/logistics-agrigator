// API Configuration Constants
// All requests route through Next.js rewrites (server-side proxy)
// This avoids CORS issues - requests go: Browser → Next.js → API Gateway
export const API_CONFIG = {
  // Use empty string for Next.js rewrites (relative paths)
  // Next.js will proxy /api/v1/* requests to the API Gateway
  BASE_URL: "", // Relative path - Next.js rewrite handles proxying
  API_VERSION: "/api/v1",
  TIMEOUT: 36000, // 30 seconds
  RETRY_ATTRIES: 3,
} as const;

// API Endpoints - All routes go through API Gateway
// Gateway handles routing to microservices internally
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/v1/auth/login",
    REGISTER: "/api/v1/auth/register",
    LOGOUT: "/api/v1/auth/logout",
    REFRESH: "/api/v1/auth/refresh",
    ME: "/api/v1/auth/me",
    PROFILE: "/api/v1/auth/profile",
  },
  USERS: {
    BASE: "/api/v1/users",
    PROFILE: "/api/v1/users/profiles",
    SETTINGS: "/api/v1/users/settings",
  },
  OUTLETS: {
    BASE: "/api/v1/outlets",
    CREATE: "/api/v1/outlets",
    LIST: "/api/v1/outlets",
    ME: "/api/v1/outlets/me",
    GET_BY_ID: "/api/v1/outlets",
    UPDATE: "/api/v1/outlets",
    ADDRESSES: "/api/v1/outlets/me/addresses",
    MY_ADDRESSES: "/api/v1/outlets/me/addresses",
    OUTLET_ADDRESSES: "/api/v1/outlets",
  },
  CLIENTS: {
    BASE: "/api/v1/clients",
    CREATE: "/api/v1/clients",
    LIST: "/api/v1/clients",
    GET_BY_ID: "/api/v1/clients",
    UPDATE: "/api/v1/clients",
    DELETE: "/api/v1/clients",
    ACTIVATE: "/api/v1/clients",
    STATS: "/api/v1/clients/stats",
    PROFILES: "/api/v1/clients",
  },
  CLIENT_SETTINGS: {
    BASE: "/api/v1/client-settings",
    CREATE: "/api/v1/client-settings",
    GET_BY_CLIENT_ID: "/api/v1/client-settings",
  },
  SHIPMENTS: {
    CREATE: "/api/v1/shipments",
    GET_BY_ID: "/api/v1/shipments",
    UPDATE: "/api/v1/shipments",
    CANCEL: "/api/v1/shipments",
    TRACKING: "/api/v1/shipments",
    TRACKING_EVENTS: "/api/v1/shipments",
    NDR: "/api/v1/shipments/ndr",
    BULK: "/api/v1/shipments/bulk",
    LABELS: "/api/v1/shipments/labels",
    PICKUP: "/api/v1/shipments/pickup",
    PICKUP_SCHEDULES: "/api/v1/shipments/pickup/schedules",
    PICKUP_STATUS: "/api/v1/shipments/pickup/status",
    PICKUP_SLOTS: "/api/v1/shipments/pickup/slots",
    PICKUP_CANCEL: "/api/v1/shipments/pickup/cancel",
    PICKUP_CREATE: "/api/v1/shipments/pickup/create",
    PICKUP_GET: "/api/v1/shipments/pickup/get",
    PICKUP_UPDATE: "/api/v1/shipments/pickup/update",
    PICKUP_DELETE: "/api/v1/shipments/pickup/delete",
    PICKUP_GET_SLOTS: "/api/v1/shipments/pickup/get/slots",
    PICKUP_GET_STATUS: "/api/v1/shipments/pickup/get/status",
    PICKUP_GET_ALL: "/api/v1/shipments/pickup/get/all",
    PICKUP_GET_BY_ID: "/api/v1/shipments/pickup/get/by/id",
    PICKUP_GET_BY_SHIPMENT_ID: "/api/v1/shipments/pickup/get/by/shipment/id",
    PICKUP_GET_BY_PARTNER_ID: "/api/v1/shipments/pickup/get/by/partner/id",
  },
  PARTNERS: {
    BASE: "/api/v1/partners",
    RATES: "/api/v1/partners/rates",
    CREATE: "/api/v1/partners",
    UPDATE: "/api/v1/partners",
    DELETE: "/api/v1/partners",
    GET: "/api/v1/partners",
    LIST: "/api/v1/partners",
    SERVICEABILITY: "/api/v1/partners/serviceability",
    CALCULATE: "/api/v1/partners/calculate",
  },
  WALLET: {
    BASE: "/api/v1/wallet",
    BALANCE: "/api/v1/wallet/balance",
    TRANSACTIONS: "/api/v1/wallet/transactions",
  },
  ZONES: {
    CREATE: "/api/v1/zones",
    EDIT: "/api/v1/zones",
    DELETE: "/api/v1/zones",
    GET: "/api/v1/zones",
    LIST: "/api/v1/zones",
    MILESTONES: "/api/v1/zones/milestones",
    CALCULATE_DISTANCE: "/api/v1/zones/calculate-distance",
    MATCH: "/api/v1/zones/match",
    VALIDATE_COVERAGE: "/api/v1/zones/coverage/validate",
    PARTNER_ZONES: "/api/v1/partner-zones",
  },
  PINCODE_TYPES: {
    BASE: "/api/v1/pincode-types",
    CREATE: "/api/v1/pincode-types",
    EDIT: "/api/v1/pincode-types",
    DELETE: "/api/v1/pincode-types",
    GET: "/api/v1/pincode-types",
    LIST: "/api/v1/pincode-types",
    ASSIGN: "/api/v1/pincode-types/assign",
    UNASSIGN: "/api/v1/pincode-types/unassign",
    PINCODES: "/api/v1/pincode-types/pincodes",
  },
  GEOGRAPHICAL: {
    BASE: "/api/v1/geography",
    CREATE: "/api/v1/geography",
    EDIT: "/api/v1/geography",
    DELETE: "/api/v1/geography",
    GET: "/api/v1/geography",
    STATS: "/api/v1/geography/stats",
    STATES: "/api/v1/geography/states",
    CITIES: "/api/v1/geography/cities",
    AREAS: "/api/v1/geography/areas",
    PINCODES: "/api/v1/geography/pincodes",
    SEARCH: "/api/v1/geography/search",
    DETAILS: "/api/v1/geography/details",
    HIERARCHY: "/api/v1/geography/hierarchy",
    HIERARCHY_DETAILS: "/api/v1/geography/hierarchy/details",
    HIERARCHY_SEARCH: "/api/v1/geography/hierarchy/search",
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
