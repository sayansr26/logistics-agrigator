/**
 * Thin HTTP client for the Logistics External Shipment API.
 *
 * Handles the credential exchange and token lifecycle so the tool layer never
 * thinks about auth: a token is fetched on demand, cached until shortly before
 * it expires, and re-fetched exactly once if the API still answers 401.
 */

const TOKEN_SAFETY_WINDOW_MS = 60_000; // refresh a minute before expiry

export class LogisticsClient {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - e.g. "https://api.example.com"
   * @param {string} config.clientId - lgk_live_...
   * @param {string} config.clientSecret - sk_live_...
   */
  constructor({ baseUrl, clientId, clientSecret }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
    this.tokenExpiresAt = 0;
    // Coalesce concurrent refreshes so parallel tool calls mint one token.
    this.pendingAuth = null;
  }

  async authenticate() {
    if (this.pendingAuth) return this.pendingAuth;

    this.pendingAuth = (async () => {
      const response = await fetch(
        `${this.baseUrl}/api/v1/external/auth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
          }),
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body?.data?.accessToken) {
        const message =
          body?.error?.message || `Authentication failed (${response.status})`;
        throw new Error(message);
      }

      this.token = body.data.accessToken;
      this.tokenExpiresAt =
        Date.now() + body.data.expiresIn * 1000 - TOKEN_SAFETY_WINDOW_MS;
      return this.token;
    })().finally(() => {
      this.pendingAuth = null;
    });

    return this.pendingAuth;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    return this.authenticate();
  }

  /**
   * Perform an API request, retrying once on a 401 with a fresh token.
   *
   * @param {string} method
   * @param {string} path - e.g. "/api/v1/external/shipments"
   * @param {Object} [options]
   * @param {Object} [options.body]
   * @param {Object} [options.query]
   * @param {string} [options.idempotencyKey]
   */
  async request(method, path, { body, query, idempotencyKey } = {}) {
    const send = async (token) => {
      const url = new URL(`${this.baseUrl}${path}`);
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      if (body) headers["Content-Type"] = "application/json";
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = await response.json().catch(() => null);
      return { response, payload };
    };

    let { response, payload } = await send(await this.getToken());

    if (response.status === 401) {
      // Token may have been revoked or rotated mid-session; try once more.
      this.token = null;
      ({ response, payload } = await send(await this.authenticate()));
    }

    if (!response.ok) {
      const error = payload?.error;
      const detail = error
        ? `${error.code}: ${error.message}`
        : `HTTP ${response.status}`;
      const err = new Error(detail);
      err.status = response.status;
      err.code = error?.code;
      err.details = error?.details;
      err.requestId = payload?.request_id;
      throw err;
    }

    return payload;
  }
}
