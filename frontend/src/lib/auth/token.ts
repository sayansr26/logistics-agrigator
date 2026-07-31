/**
 * Token utilities
 *
 * Single source of truth for reading JWT expiry and for keeping the
 * `token` / `userRole` cookies (read by src/middleware.ts on the edge)
 * in sync with localStorage.
 *
 * The cookies deliberately track the *refresh* token's lifetime, not the
 * access token's: they only mean "a session may still exist". The real
 * check happens client-side once Redux has hydrated.
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

const DEFAULT_SKEW_SECONDS = 30;

/** Fallback cookie lifetime when a refresh token has no usable `exp` (30 days). */
const FALLBACK_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Decode a JWT payload without verifying the signature.
 * Verification is the gateway's job - we only need `exp` to decide when
 * to refresh. Returns null for anything malformed.
 */
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    // base64url -> base64, then pad to a multiple of 4
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Expiry as epoch milliseconds, or null if the token has no readable `exp`. */
export function getTokenExpiryMs(
  token: string | null | undefined,
): number | null {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000;
}

/**
 * True when the token is missing, unreadable, or expires within `skewSeconds`.
 * The skew makes us refresh slightly early rather than racing the expiry.
 */
export function isTokenExpired(
  token: string | null | undefined,
  skewSeconds: number = DEFAULT_SKEW_SECONDS,
): boolean {
  if (!token) return true;

  const expiryMs = getTokenExpiryMs(token);
  // A token we cannot read is treated as expired - safer than trusting it.
  if (expiryMs === null) return true;

  return Date.now() >= expiryMs - skewSeconds * 1000;
}

/** True when the token is present and still usable. */
export function isTokenValid(
  token: string | null | undefined,
  skewSeconds: number = DEFAULT_SKEW_SECONDS,
): boolean {
  return !isTokenExpired(token, skewSeconds);
}

/**
 * Write the auth cookies the edge middleware reads.
 *
 * max-age comes from the refresh token so a merely-expired access token
 * never evicts the user at the edge - the API layer refreshes instead.
 */
export function setAuthCookies(
  token: string | null | undefined,
  role: string | null | undefined,
  refreshToken?: string | null,
): void {
  if (typeof document === "undefined" || !token) return;

  const refreshExpiryMs = getTokenExpiryMs(refreshToken);
  const maxAge =
    refreshExpiryMs !== null
      ? Math.max(0, Math.floor((refreshExpiryMs - Date.now()) / 1000))
      : FALLBACK_COOKIE_MAX_AGE;

  document.cookie = `token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (role) {
    document.cookie = `userRole=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

/** Expire both auth cookies. Must run on every logout / dead session. */
export function clearAuthCookies(): void {
  if (typeof document === "undefined") return;

  document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

/** Remove every persisted auth artifact - localStorage and cookies. */
export function clearStoredAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }
  clearAuthCookies();
}
