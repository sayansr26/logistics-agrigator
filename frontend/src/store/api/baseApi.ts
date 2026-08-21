import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { API_CONFIG } from "@/constants/api";
import type { RootState } from "../index";
import { logout, setTokens } from "../slices/authSlice";
import { addNotification } from "../slices/uiSlice";
import { isTokenExpired, isTokenValid } from "@/lib/auth/token";

const REFRESH_URL = "/api/v1/auth/refresh";

/**
 * Endpoints that must never trigger a refresh-and-retry.
 * A 401 from these IS the answer (bad credentials / dead refresh token),
 * not a recoverable expired-access-token situation.
 */
const NO_REAUTH_ENDPOINTS = new Set([
  "login",
  "register",
  "refreshToken",
  "forgotPassword",
  "resetPassword",
]);

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_CONFIG.BASE_URL,

  // Prepare headers with authentication token
  prepareHeaders: (headers, { getState }) => {
    // Get token from auth state, falling back to localStorage for the
    // brief window before `hydrate` has landed in Redux.
    const state = getState() as RootState;
    const token =
      state.auth.token ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Set content type.
    // File-upload endpoints opt out by setting the "x-multipart" marker,
    // because a FormData body must carry a browser-generated multipart
    // boundary - forcing application/json here would corrupt the upload.
    if (headers.get("x-multipart") === "true") {
      headers.delete("x-multipart");
      headers.delete("Content-Type");
    } else {
      headers.set("Content-Type", "application/json");
    }

    return headers;
  },

  // Timeout configuration
  timeout: API_CONFIG.TIMEOUT,
});

/**
 * In-flight refresh, shared by every caller.
 *
 * The dashboard fires several queries at once; without this they would each
 * POST /auth/refresh and rotate the refresh token out from under one another,
 * invalidating the session they were trying to save.
 */
let refreshPromise: Promise<string | null> | null = null;

/** Fired once when the session is definitively gone, so we redirect only once. */
let sessionEnded = false;

function endSession(api: Parameters<BaseQueryFn>[1]) {
  if (sessionEnded) return;

  // Only meaningful if there was a session to lose. An anonymous visitor
  // hitting a 401 is expected - don't tell them their session expired.
  const state = api.getState() as RootState;
  const hadSession =
    !!state.auth.token ||
    !!state.auth.refreshToken ||
    (typeof window !== "undefined" && !!localStorage.getItem("refreshToken"));

  if (!hadSession) return;

  sessionEnded = true;

  api.dispatch(logout());
  api.dispatch(
    addNotification({
      type: "error",
      message: "Your session has expired. Please log in again",
      duration: 5000,
    }),
  );

  if (typeof window !== "undefined") {
    const { pathname, search } = window.location;
    // Already on an auth page - no need to navigate.
    if (pathname.startsWith("/auth/")) return;

    const redirect = encodeURIComponent(`${pathname}${search}`);
    // `replace` so the dead page never comes back via the Back button.
    window.location.replace(`/auth/login?expired=1&redirect=${redirect}`);
  }
}

/**
 * Exchange the refresh token for a new access token.
 * Uses rawBaseQuery directly - routing this through the wrapper would recurse.
 */
async function refreshAccessToken(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: Record<string, unknown>,
): Promise<string | null> {
  const state = api.getState() as RootState;
  const refreshToken =
    state.auth.refreshToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("refreshToken")
      : null);

  if (!isTokenValid(refreshToken)) return null;

  const result = await rawBaseQuery(
    {
      url: REFRESH_URL,
      method: "POST",
      body: { refreshToken },
    },
    api,
    extraOptions,
  );

  // Backend shape: { status, data: { accessToken, refreshToken, expiresIn } }
  const data = result.data as
    { data?: { accessToken?: string; refreshToken?: string } } | undefined;
  const accessToken = data?.data?.accessToken;

  if (!accessToken) return null;

  api.dispatch(
    setTokens({
      token: accessToken,
      refreshToken: data?.data?.refreshToken ?? null,
    }),
  );

  return accessToken;
}

/** Coalesce concurrent refresh attempts into a single request. */
function refreshOnce(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: Record<string, unknown>,
): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(api, extraOptions).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Base query with transparent token refresh.
 *
 * - Pre-emptive: refreshes before firing when the access token has expired
 *   but the refresh token is still alive.
 * - Reactive: on a 401, refreshes once and retries the original request.
 * - On definitive failure, ends the session with a single clean redirect.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const skipReauth = NO_REAUTH_ENDPOINTS.has(api.endpoint);

  if (!skipReauth) {
    const state = api.getState() as RootState;
    const token =
      state.auth.token ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    // Access token already dead but the session is still recoverable -
    // refresh first rather than spending a guaranteed 401.
    if (isTokenExpired(token)) {
      const refreshToken =
        state.auth.refreshToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("refreshToken")
          : null);

      if (isTokenValid(refreshToken)) {
        const newToken = await refreshOnce(api, extraOptions);
        if (!newToken) {
          endSession(api);
          return {
            error: {
              status: 401,
              data: { message: "Session expired" },
            } as FetchBaseQueryError,
          };
        }
      }
    }
  }

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !skipReauth) {
    const newToken = await refreshOnce(api, extraOptions);

    if (newToken) {
      // Retry exactly once with the fresh token.
      result = await rawBaseQuery(args, api, extraOptions);
      if (result.error?.status !== 401) {
        sessionEnded = false;
        return result;
      }
    }

    endSession(api);
  }

  // A successful call means the session is healthy again.
  if (!result.error) sessionEnded = false;

  return result;
};

// Define a service using a base URL and expected endpoints
export const baseApi = createApi({
  reducerPath: "api",

  baseQuery: baseQueryWithReauth,

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
    "ServiceChannel",
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
    "ChargeCatalog",
    "ChargeDefinition",
    "ChargeConfig",
    "AiSuggestion",
    "BulkJob",
    "NDR",
    "ApiCredential",
  ],

  // Define endpoints in separate API slices
  endpoints: () => ({}),
});

// Export hooks for usage in functional components
// Hooks will be exported from individual endpoint slices (e.g., authApi, userApi)
