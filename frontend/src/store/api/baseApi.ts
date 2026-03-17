import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_CONFIG } from "@/constants/api";
import type { RootState } from "../index";

// Define a service using a base URL and expected endpoints
export const baseApi = createApi({
  reducerPath: "api",

  baseQuery: fetchBaseQuery({
    baseUrl: API_CONFIG.BASE_URL,

    // Prepare headers with authentication token
    prepareHeaders: (headers, { getState }) => {
      // Get token from auth state
      const state = getState() as RootState;
      const token = state.auth.token;

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      // Set content type
      headers.set("Content-Type", "application/json");

      return headers;
    },

    // Timeout configuration
    timeout: API_CONFIG.TIMEOUT,
  }),

  // Tag types for cache invalidation
  tagTypes: [
    "Auth",
    "User",
    "Client",
    "Customer",
    "Outlet",
    "Shipment",
    "Partner",
    "PartnerChannel",
    "PartnerPincode",
    "Pincode",
    "Wallet",
    "Zone",
    "Geo",
    "Geographical",
    "License",
    "Permission",
    "PincodeType",
    "ChargesType",
    "ChargeRule",
    "ServiceHealth",
    "ServiceStatistics",
    "ServiceConfiguration",
    "AuditLog",
    "RuntimeLog",
    "ChargeDiscountPackage",
  ],

  // Define endpoints in separate API slices
  endpoints: () => ({}),
});

// Export hooks for usage in functional components
// Hooks will be exported from individual endpoint slices (e.g., authApi, userApi)
