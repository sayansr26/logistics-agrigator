/**
 * Audit Action Constants
 *
 * Centralized definition of all audit log action types across all services.
 * All actions must use UPPERCASE_WITH_UNDERSCORES format.
 *
 * Standard:
 * - All actions are UPPERCASE_WITH_UNDERSCORES
 * - Actions are organized by functional category
 * - Each service should import and use these constants
 *
 * Usage in controllers:
 * const { AUDIT_ACTIONS } = require("../../shared/constants/auditActions");
 * await tx.auditLog.create({
 *   data: { action: AUDIT_ACTIONS.CREATE_PROFILE, ... }
 * });
 */

module.exports = {
  // ============================================
  // CORE CRUD ACTIONS
  // ============================================
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VIEW: "VIEW",
  LIST: "LIST",
  GET: "GET",

  // ============================================
  // AUTH ACTIONS
  // ============================================
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  TOKEN_REFRESH: "TOKEN_REFRESH",
  LOGOUT_ALL_DEVICES: "LOGOUT_ALL_DEVICES",
  SESSION_CLEANUP: "SESSION_CLEANUP",
  TOKEN_BLACKLISTED: "TOKEN_BLACKLISTED",

  // User Management (auth-service)
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  DELETE_USER: "DELETE_USER",
  ACTIVATE_USER: "ACTIVATE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  GET_USER_INFO: "GET_USER_INFO",
  GET_USER_PROFILE: "GET_USER_PROFILE",
  GET_USER_BY_ID: "GET_USER_BY_ID",
  LIST_USERS: "LIST_USERS",

  // ============================================
  // PROFILE ACTIONS (user-service)
  // ============================================
  CREATE_PROFILE: "CREATE_PROFILE",
  UPDATE_PROFILE: "UPDATE_PROFILE",
  DELETE_PROFILE: "DELETE_PROFILE",
  VIEW_PROFILE: "VIEW_PROFILE",
  GET_PROFILE: "GET_PROFILE",
  GET_MY_PROFILE: "GET_MY_PROFILE",
  GET_PROFILE_BY_USER_ID: "GET_PROFILE_BY_USER_ID",
  LIST_PROFILES: "LIST_PROFILES",
  VERIFY_PROFILE: "VERIFY_PROFILE",
  ACTIVATE_PROFILE: "ACTIVATE_PROFILE",
  DEACTIVATE_PROFILE: "DEACTIVATE_PROFILE",
  GET_PROFILE_STATS: "GET_PROFILE_STATS",

  // Bootstrap actions
  BOOTSTRAP_USER_PROFILE: "BOOTSTRAP_USER_PROFILE",
  ROLLBACK_BOOTSTRAP: "ROLLBACK_BOOTSTRAP",

  // ============================================
  // CLIENT ACTIONS (user-service)
  // ============================================
  CREATE_CLIENT: "CREATE_CLIENT",
  UPDATE_CLIENT: "UPDATE_CLIENT",
  DELETE_CLIENT: "DELETE_CLIENT",
  GET_CLIENT: "GET_CLIENT",
  LIST_CLIENTS: "LIST_CLIENTS",
  ACTIVATE_CLIENT: "ACTIVATE_CLIENT",
  DEACTIVATE_CLIENT: "DEACTIVATE_CLIENT",
  GET_CLIENT_STATS: "GET_CLIENT_STATS",
  GET_CLIENT_DETAILED_STATS: "GET_CLIENT_DETAILED_STATS",
  REGISTER_CLIENT: "REGISTER_CLIENT",

  // ============================================
  // OUTLET ACTIONS (user-service)
  // ============================================
  CREATE_OUTLET: "CREATE_OUTLET",
  UPDATE_OUTLET: "UPDATE_OUTLET",
  DELETE_OUTLET: "DELETE_OUTLET",
  GET_OUTLET: "GET_OUTLET",
  LIST_OUTLETS: "LIST_OUTLETS",
  ACTIVATE_OUTLET: "ACTIVATE_OUTLET",
  DEACTIVATE_OUTLET: "DEACTIVATE_OUTLET",
  RESET_OUTLET_PASSWORD: "RESET_OUTLET_PASSWORD",

  // Outlet Address actions
  CREATE_OUTLET_ADDRESS: "CREATE_OUTLET_ADDRESS",
  UPDATE_OUTLET_ADDRESS: "UPDATE_OUTLET_ADDRESS",
  DELETE_OUTLET_ADDRESS: "DELETE_OUTLET_ADDRESS",
  SET_DEFAULT_OUTLET_ADDRESS: "SET_DEFAULT_OUTLET_ADDRESS",

  // ============================================
  // ADDRESS ACTIONS (user-service)
  // ============================================
  CREATE_ADDRESS: "CREATE_ADDRESS",
  UPDATE_ADDRESS: "UPDATE_ADDRESS",
  DELETE_ADDRESS: "DELETE_ADDRESS",
  GET_ADDRESS: "GET_ADDRESS",
  LIST_ADDRESSES: "LIST_ADDRESSES",

  // ============================================
  // USER INVITATION ACTIONS (user-service)
  // ============================================
  CREATE_USER_INVITATION: "CREATE_USER_INVITATION",
  UPDATE_USER_INVITATION: "UPDATE_USER_INVITATION",
  CANCEL_USER_INVITATION: "CANCEL_USER_INVITATION",
  RESEND_USER_INVITATION: "RESEND_USER_INVITATION",
  GET_USER_INVITATION: "GET_USER_INVITATION",
  LIST_USER_INVITATIONS: "LIST_USER_INVITATIONS",
  VALIDATE_INVITATION_TOKEN: "VALIDATE_INVITATION_TOKEN",
  ACCEPT_USER_INVITATION: "ACCEPT_USER_INVITATION",
  GET_INVITATION_STATS: "GET_INVITATION_STATS",

  // ============================================
  // SHIPMENT ACTIONS (shipment-service)
  // ============================================
  CREATE_SHIPMENT: "CREATE", // Legacy: CREATE
  UPDATE_SHIPMENT: "UPDATE", // Legacy: UPDATE
  DELETE_SHIPMENT: "DELETE", // Legacy: DELETE
  GET_SHIPMENT: "VIEW", // Legacy: VIEW
  LIST_SHIPMENTS: "LIST", // Legacy: LIST
  CANCEL_SHIPMENT: "CANCEL",
  TRACK_SHIPMENT: "TRACK",
  CALCULATE_RATES: "CALCULATE_RATES",
  SELECT_PARTNER: "SELECT_PARTNER",
  CHECK_SERVICEABILITY: "CHECK_SERVICEABILITY",
  ADD_TRACKING_EVENT: "ADD_TRACKING_EVENT",
  GET_TRACKING_ANALYTICS: "VIEW_ANALYTICS",
  GET_SHIPMENT_QUOTES: "GET_SHIPMENT_QUOTES",
  RERATE_SHIPMENT: "RERATE_SHIPMENT",

  // Bulk operations
  PROCESS_BULK_SHIPMENTS: "PROCESS_BULK_SHIPMENTS",
  GET_BULK_JOB_STATUS: "GET_BULK_JOB_STATUS",

  // NDR (Non-Delivery Report) actions
  CREATE_NDR_CASE: "CREATE_NDR_CASE",
  GET_NDR_CASES: "GET_NDR_CASES",
  TAKE_NDR_ACTION: "TAKE_NDR_ACTION",

  // Label and Manifest actions
  GENERATE_SHIPPING_LABEL: "GENERATE_SHIPPING_LABEL",
  GENERATE_BULK_LABELS: "GENERATE_BULK_LABELS",
  CREATE_MANIFEST: "CREATE_MANIFEST",

  // Pickup actions
  SCHEDULE_PICKUP: "SCHEDULE_PICKUP",
  GET_PICKUP_SCHEDULES: "GET_PICKUP_SCHEDULES",
  UPDATE_PICKUP_STATUS: "UPDATE_PICKUP_STATUS",
  CANCEL_PICKUP: "CANCEL_PICKUP",
  GET_AVAILABLE_TIME_SLOTS: "GET_AVAILABLE_TIME_SLOTS",

  // Public tracking
  TRACK_BY_AWB: "TRACK_BY_AWB",
  RECORD_DELIVERY_CONFIRMATION: "RECORD_DELIVERY_CONFIRMATION",

  // ============================================
  // PARTNER ACTIONS (partner-service)
  // ============================================
  CREATE_PARTNER: "CREATE_PARTNER", // Was: PARTNER_CREATED
  UPDATE_PARTNER: "UPDATE_PARTNER", // Was: PARTNER_UPDATED
  DELETE_PARTNER: "DELETE_PARTNER", // Was: PARTNER_DELETED
  GET_PARTNER: "GET_PARTNER",
  LIST_PARTNERS: "LIST_PARTNERS",

  // Partner Channel actions
  CREATE_PARTNER_CHANNEL: "CREATE_PARTNER_CHANNEL",
  UPDATE_PARTNER_CHANNEL: "UPDATE_PARTNER_CHANNEL",
  DELETE_PARTNER_CHANNEL: "DELETE_PARTNER_CHANNEL",
  SWITCH_CHANNEL_MODE: "SWITCH_CHANNEL_MODE",

  // Pincode Type actions
  CREATE_PINCODE_TYPE: "CREATE_PINCODE_TYPE",
  UPDATE_PINCODE_TYPE: "UPDATE_PINCODE_TYPE",
  DELETE_PINCODE_TYPE: "DELETE_PINCODE_TYPE",
  IMPORT_PINCODE_DATA: "IMPORT_PINCODE_DATA",

  // ============================================
  // COURIER OPERATIONS (partner-service)
  // ============================================
  BOOK_COURIER_SHIPMENT: "BOOK_COURIER_SHIPMENT",
  CANCEL_COURIER_SHIPMENT: "CANCEL_COURIER_SHIPMENT",
  TRACK_COURIER_SHIPMENT: "TRACK_COURIER_SHIPMENT",
  REQUEST_COURIER_PICKUP: "REQUEST_COURIER_PICKUP",
  GENERATE_COURIER_LABEL: "GENERATE_COURIER_LABEL",
  GENERATE_COURIER_MANIFEST: "GENERATE_COURIER_MANIFEST",
  COURIER_WEBHOOK_RECEIVED: "COURIER_WEBHOOK_RECEIVED",

  // ============================================
  // WALLET ACTIONS (wallet-service)
  // ============================================
  GET_WALLET: "GET_WALLET",
  GET_BALANCE: "GET_BALANCE",
  DEBIT_WALLET: "DEBIT_WALLET",
  CREDIT_WALLET: "CREDIT_WALLET",
  ADMIN_LOAD_BALANCE: "ADMIN_LOAD_BALANCE",
  GET_TRANSACTIONS: "GET_TRANSACTIONS",
  GET_WALLET_DETAILS: "GET_WALLET_DETAILS",
  GET_ALL_WALLETS: "GET_ALL_WALLETS",
  GET_ALL_TRANSACTIONS: "GET_ALL_TRANSACTIONS",
  REQUEST_PAYOUT: "REQUEST_PAYOUT",
  APPROVE_PAYOUT: "APPROVE_PAYOUT",
  REJECT_PAYOUT: "REJECT_PAYOUT",

  // Payment Gateway
  INITIATE_PAYMENT: "INITIATE_PAYMENT",
  HANDLE_PAYMENT_WEBHOOK: "HANDLE_PAYMENT_WEBHOOK",
  GET_PAYMENT_STATUS: "GET_PAYMENT_STATUS",

  // ============================================
  // LICENSE ACTIONS (license-service)
  // ============================================
  GENERATE_LICENSE: "GENERATE_LICENSE",
  VALIDATE_LICENSE: "VALIDATE_LICENSE",
  REVOKE_LICENSE: "REVOKE_LICENSE",
  EXTEND_LICENSE: "EXTEND_LICENSE",
  GET_LICENSE: "GET_LICENSE",
  LIST_LICENSES: "LIST_LICENSES",
  ACTIVATE_LICENSE: "ACTIVATE_LICENSE",
  DEACTIVATE_LICENSE: "DEACTIVATE_LICENSE",

  // License Activation
  CREATE_LICENSE_ACTIVATION: "CREATE_LICENSE_ACTIVATION",
  DEACTIVATE_LICENSE_ACTIVATION: "DEACTIVATE_LICENSE_ACTIVATION",

  // ============================================
  // SUPPORT ACTIONS (support-service) - FUTURE
  // ============================================
  CREATE_TICKET: "CREATE_TICKET",
  UPDATE_TICKET: "UPDATE_TICKET",
  DELETE_TICKET: "DELETE_TICKET",
  GET_TICKET: "GET_TICKET",
  LIST_TICKETS: "LIST_TICKETS",
  ASSIGN_TICKET: "ASSIGN_TICKET",
  RESOLVE_TICKET: "RESOLVE_TICKET",
  CLOSE_TICKET: "CLOSE_TICKET",
  REOPEN_TICKET: "REOPEN_TICKET",

  // ============================================
  // CATEGORIZED ACTION GROUPS
  // For frontend filtering and display
  // ============================================
  ACTION_CATEGORIES: {
    // Core CRUD
    CRUD: ["CREATE", "UPDATE", "DELETE", "VIEW", "LIST", "GET"],

    // Authentication
    AUTH: [
      "LOGIN",
      "LOGOUT",
      "TOKEN_REFRESH",
      "LOGOUT_ALL_DEVICES",
      "SESSION_CLEANUP",
      "TOKEN_BLACKLISTED",
    ],

    // User Management
    USER: [
      "CREATE_USER",
      "UPDATE_USER",
      "DELETE_USER",
      "ACTIVATE_USER",
      "DEACTIVATE_USER",
      "GET_USER_INFO",
      "GET_USER_PROFILE",
      "GET_USER_BY_ID",
      "LIST_USERS",
    ],

    // Profile Management
    PROFILE: [
      "CREATE_PROFILE",
      "UPDATE_PROFILE",
      "DELETE_PROFILE",
      "VIEW_PROFILE",
      "GET_PROFILE",
      "GET_MY_PROFILE",
      "GET_PROFILE_BY_USER_ID",
      "LIST_PROFILES",
      "VERIFY_PROFILE",
      "ACTIVATE_PROFILE",
      "DEACTIVATE_PROFILE",
      "GET_PROFILE_STATS",
    ],

    // Client Management
    CLIENT: [
      "CREATE_CLIENT",
      "UPDATE_CLIENT",
      "DELETE_CLIENT",
      "GET_CLIENT",
      "LIST_CLIENTS",
      "ACTIVATE_CLIENT",
      "DEACTIVATE_CLIENT",
      "GET_CLIENT_STATS",
      "GET_CLIENT_DETAILED_STATS",
      "REGISTER_CLIENT",
    ],

    // Outlet Management
    OUTLET: [
      "CREATE_OUTLET",
      "UPDATE_OUTLET",
      "DELETE_OUTLET",
      "GET_OUTLET",
      "LIST_OUTLETS",
      "ACTIVATE_OUTLET",
      "DEACTIVATE_OUTLET",
      "RESET_OUTLET_PASSWORD",
    ],

    // Address Management
    ADDRESS: [
      "CREATE_ADDRESS",
      "UPDATE_ADDRESS",
      "DELETE_ADDRESS",
      "GET_ADDRESS",
      "LIST_ADDRESSES",
    ],

    // Invitations
    INVITATION: [
      "CREATE_USER_INVITATION",
      "UPDATE_USER_INVITATION",
      "CANCEL_USER_INVITATION",
      "RESEND_USER_INVITATION",
      "GET_USER_INVITATION",
      "LIST_USER_INVITATIONS",
      "VALIDATE_INVITATION_TOKEN",
      "ACCEPT_USER_INVITATION",
      "GET_INVITATION_STATS",
    ],

    // Shipments
    SHIPMENT: [
      "CREATE", // Legacy action name
      "UPDATE", // Legacy action name
      "DELETE", // Legacy action name
      "VIEW", // Legacy action name
      "LIST", // Legacy action name
      "CANCEL",
      "TRACK",
      "CALCULATE_RATES",
      "SELECT_PARTNER",
      "CHECK_SERVICEABILITY",
      "ADD_TRACKING_EVENT",
      "VIEW_ANALYTICS",
      "PROCESS_BULK_SHIPMENTS",
      "GET_BULK_JOB_STATUS",
    ],

    // NDR Management
    NDR: ["CREATE_NDR_CASE", "GET_NDR_CASES", "TAKE_NDR_ACTION"],

    // Labels and Manifests
    LABEL_MANIFEST: [
      "GENERATE_SHIPPING_LABEL",
      "GENERATE_BULK_LABELS",
      "CREATE_MANIFEST",
    ],

    // Pickup Scheduling
    PICKUP: [
      "SCHEDULE_PICKUP",
      "GET_PICKUP_SCHEDULES",
      "UPDATE_PICKUP_STATUS",
      "CANCEL_PICKUP",
      "GET_AVAILABLE_TIME_SLOTS",
    ],

    // Partner/Courier Management
    PARTNER: [
      "CREATE_PARTNER",
      "UPDATE_PARTNER",
      "DELETE_PARTNER",
      "GET_PARTNER",
      "LIST_PARTNERS",
      "CREATE_PARTNER_CHANNEL",
      "UPDATE_PARTNER_CHANNEL",
      "DELETE_PARTNER_CHANNEL",
      "SWITCH_CHANNEL_MODE",
    ],

    // Courier Operations
    COURIER: [
      "BOOK_COURIER_SHIPMENT",
      "CANCEL_COURIER_SHIPMENT",
      "TRACK_COURIER_SHIPMENT",
      "REQUEST_COURIER_PICKUP",
      "GENERATE_COURIER_LABEL",
      "GENERATE_COURIER_MANIFEST",
      "COURIER_WEBHOOK_RECEIVED",
    ],

    // Pincode Management
    PINCODE: [
      "CREATE_PINCODE_TYPE_SERVICE_CHARGE",
      "UPDATE_PINCODE_TYPE_SERVICE_CHARGE",
      "DELETE_PINCODE_TYPE_SERVICE_CHARGE",
      "GET_PINCODE_TYPE_SERVICE_CHARGE",
      "LIST_PINCODE_TYPE_SERVICE_CHARGES",
      "CREATE_PINCODE_TYPE",
      "UPDATE_PINCODE_TYPE",
      "DELETE_PINCODE_TYPE",
      "IMPORT_PINCODE_DATA",
      "ASSIGN_PINCODE_TYPE",
      "UNASSIGN_PINCODE_TYPE",
    ],

    // Wallet & Payments
    WALLET: [
      "GET_WALLET",
      "GET_BALANCE",
      "DEBIT_WALLET",
      "CREDIT_WALLET",
      "ADMIN_LOAD_BALANCE",
      "GET_TRANSACTIONS",
      "GET_WALLET_DETAILS",
      "GET_ALL_WALLETS",
      "GET_ALL_TRANSACTIONS",
      "REQUEST_PAYOUT",
      "APPROVE_PAYOUT",
      "REJECT_PAYOUT",
      "INITIATE_PAYMENT",
      "HANDLE_PAYMENT_WEBHOOK",
      "GET_PAYMENT_STATUS",
    ],

    // Licensing
    LICENSE: [
      "GENERATE_LICENSE",
      "VALIDATE_LICENSE",
      "REVOKE_LICENSE",
      "EXTEND_LICENSE",
      "GET_LICENSE",
      "LIST_LICENSES",
      "ACTIVATE_LICENSE",
      "DEACTIVATE_LICENSE",
    ],

    // Support Tickets
    SUPPORT: [
      "CREATE_TICKET",
      "UPDATE_TICKET",
      "DELETE_TICKET",
      "GET_TICKET",
      "LIST_TICKETS",
      "ASSIGN_TICKET",
      "RESOLVE_TICKET",
      "CLOSE_TICKET",
      "REOPEN_TICKET",
    ],

    // Bootstrap/System
    SYSTEM: ["BOOTSTRAP_USER_PROFILE", "ROLLBACK_BOOTSTRAP"],
  },

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Get all unique action values as a flat array
   * Used for frontend dropdown options
   */
  getAllActions: function () {
    const actions = new Set();

    Object.values(this).forEach((value) => {
      if (typeof value === "string" && value === value.toUpperCase()) {
        actions.add(value);
      }
    });

    return Array.from(actions).sort();
  },

  /**
   * Get actions for a specific category
   * @param {string} category - Category name (e.g., 'SHIPMENT', 'WALLET')
   * @returns {string[]} Array of action names
   */
  getActionsByCategory: function (category) {
    return this.ACTION_CATEGORIES[category] || [];
  },

  /**
   * Check if an action belongs to a category
   * @param {string} action - Action name
   * @param {string} category - Category name
   * @returns {boolean}
   */
  isActionInCategory: function (action, category) {
    const categoryActions = this.ACTION_CATEGORIES[category] || [];
    return categoryActions.includes(action);
  },
};
