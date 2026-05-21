# External Wallet API Integration Guide

A self-contained guide for integrating with the **websiteduniya Wallet API** (`https://wapi.websiteduniya.com/api/v1`) from any backend project. Includes auth scheme (HMAC-SHA256), all endpoints, payloads, query params, headers, and sample responses.

Source of truth: `backend/wallet-service/services/externalWalletClient.js` in the logistics-aggregator project.

---

## 1. Base Configuration

| Setting      | Value                                             |
| ------------ | ------------------------------------------------- |
| Base URL     | `https://wapi.websiteduniya.com/api/v1`           |
| Auth scheme  | HMAC-SHA256 signed headers                        |
| Content-Type | `application/json` (only on requests with a body) |
| Timeout      | 30s recommended                                   |
| Currency     | `INR`                                             |

### Environment variables

```env
EXTERNAL_WALLET_API_URL=https://wapi.websiteduniya.com/api/v1
EXTERNAL_WALLET_SECRET_KEY=<256-bit HMAC secret shared with provider>
EXTERNAL_WALLET_USER_ID=         # MUST be empty — non-empty value triggers NPE upstream
EXTERNAL_WALLET_JWT_TOKEN=       # Not used; kept empty
```

> ⚠️ **Do NOT send an `Authorization` header.** The upstream `UserAuthorizationServiceImpl` crashes with a NullPointerException when `X-User-ID` is non-empty or `Authorization` is present. Only the four HMAC headers below are accepted.

---

## 2. Authentication — HMAC-SHA256

Every request must carry four headers. The signature binds the HTTP method, path, timestamp, and (if present) a SHA-256 hash of the raw body.

### Headers sent on every request

| Header               | Value                                         |
| -------------------- | --------------------------------------------- |
| `X-Wallet-Signature` | `t=<timestamp>,v1=<base64-signature>`         |
| `X-Timestamp`        | Unix epoch seconds (string)                   |
| `X-Request-ID`       | Unique per request, e.g. `req_<ms>_<rand>`    |
| `X-User-ID`          | Empty string `""`                             |
| `Content-Type`       | `application/json` (only when sending a body) |

### Signature algorithm

```
timestamp = floor(now() / 1000)         # Unix seconds
bodyHash  = sha256_hex_lower(rawBody)   # only if body non-empty, else ""
payload   = METHOD + ":" + path + ":" + timestamp
            + (bodyHash ? ":" + bodyHash : "")
signed    = timestamp + ":" + payload
signature = base64( HMAC_SHA256(secretKey, signed) )
header    = "t=" + timestamp + ",v1=" + signature
```

- `METHOD` is uppercase (`GET`, `POST`, `PATCH`).
- `path` is the **full URL path including `/api/v1` prefix**, e.g. `/api/v1/wallets/client/TEST`.
- `rawBody` is the exact JSON string sent (no whitespace tweaks after signing).
- If there is no body, omit the `:bodyHash` segment entirely.

### Reference implementation (Node.js)

```js
const crypto = require("crypto");

function signRequest(method, path, rawBody, secretKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  let payload = `${method.toUpperCase()}:${path}:${timestamp}`;
  if (rawBody && rawBody.trim()) {
    const bodyHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex")
      .toLowerCase();
    payload += `:${bodyHash}`;
  }
  const signed = `${timestamp}:${payload}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(signed)
    .digest("base64");
  return {
    "X-Wallet-Signature": `t=${timestamp},v1=${signature}`,
    "X-Timestamp": String(timestamp),
    "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    "X-User-ID": "",
  };
}
```

---

## 3. Resilience Recommendations

- **Circuit breaker**: open at 50% failure rate over a 10-request window, reset after 60s (logistics-aggregator uses `opossum`).
- **Retries**: do NOT retry POST debit/credit/topup/refund automatically — they are not idempotent on the server side. Use `reference_id` to dedupe client-side.
- **Caching** (Redis suggested TTLs):
  - Balance: 5 min
  - Transaction history: 1 min
  - Create-wallet response: 1 h (dedupe duplicate creations)
- **Clock skew**: keep client time within ±60s of UTC, otherwise the signature timestamp will be rejected.

---

## 4. Endpoints

All paths are relative to `https://wapi.websiteduniya.com/api/v1`.

### 4.1 Health

`GET /health`

No body. Returns provider health.

---

### 4.2 Client-scoped wallet operations

These are the **primary** endpoints used in production. `clientCode` is the tenant identifier issued by the provider (e.g. `TEST`, `LOGISTICS01`). `userId` is the end-user identifier (we use phone number).

#### List wallets for a client

`GET /wallets/client/{clientCode}`

Query params:

| Param     | Default     | Notes           |
| --------- | ----------- | --------------- |
| `page`    | `0`         | Zero-indexed    |
| `size`    | `20`        | Page size       |
| `sortBy`  | `createdAt` |                 |
| `sortDir` | `desc`      | `asc` / `desc`  |
| `status`  | –           | Optional filter |
| `search`  | –           | Optional        |

Response (shape):

```json
{
  "content": [
    {
      "walletId": "wal_...",
      "userId": "9999999999",
      "clientCode": "TEST",
      "balance": 1500.0,
      "currency": "INR",
      "status": "ACTIVE",
      "createdAt": "2026-05-20T10:00:00Z"
    }
  ],
  "totalElements": 42,
  "totalPages": 3,
  "page": 0,
  "size": 20,
  "stats": {
    "totalWallets": 42,
    "activeWallets": 40,
    "totalBalance": 152340.5
  }
}
```

#### Get or auto-create wallet for a user

`GET /wallets/client/{clientCode}/user/{userId}`

No body / no params. Returns the user's wallet, creating it if missing.

```json
{
  "walletId": "wal_abc123",
  "userId": "9999999999",
  "clientCode": "TEST",
  "balance": 0.0,
  "currency": "INR",
  "status": "ACTIVE",
  "createdAt": "2026-05-21T08:12:33Z"
}
```

#### Top up a user wallet (credit)

`POST /wallets/client/{clientCode}/user/{userId}/topup`

Body:

```json
{
  "amount": 500.0,
  "currency": "INR",
  "reference_id": "TOPUP-2026-05-21-0001",
  "description": "Wallet recharge via Razorpay",
  "remarks": "Order #INV-9921",
  "metadata": {
    "source": "logistics-wallet-service",
    "gateway": "razorpay",
    "gatewayTxnId": "pay_NXXxxxx"
  }
}
```

Response:

```json
{
  "transactionId": "txn_01HXYZ...",
  "walletId": "wal_abc123",
  "type": "CREDIT",
  "amount": 500.0,
  "currency": "INR",
  "balanceAfter": 500.0,
  "reference_id": "TOPUP-2026-05-21-0001",
  "status": "SUCCESS",
  "createdAt": "2026-05-21T08:15:01Z"
}
```

#### Debit a user wallet

`POST /wallets/client/{clientCode}/user/{userId}/debit`

Body: same shape as topup. `reference_id` MUST be unique per debit (used for idempotency / dedupe).

```json
{
  "amount": 120.5,
  "currency": "INR",
  "reference_id": "SHIP-AWB123456-FRT",
  "description": "Freight charge for AWB123456",
  "remarks": "Delhivery Surface",
  "metadata": { "awb": "AWB123456", "courier": "delhivery" }
}
```

Error on insufficient balance:

```json
{
  "status": 400,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Wallet balance 50.00 is less than requested 120.50"
}
```

#### Refund to a user wallet

`POST /wallets/client/{clientCode}/user/{userId}/refund`

Body identical to topup/debit. `reference_id` typically mirrors the original debit reference with a `-REFUND` suffix.

```json
{
  "amount": 120.5,
  "currency": "INR",
  "reference_id": "SHIP-AWB123456-FRT-REFUND",
  "description": "Refund for cancelled shipment AWB123456",
  "metadata": { "originalDebitRef": "SHIP-AWB123456-FRT" }
}
```

---

### 4.3 User wallet detail / status

#### Get detailed user wallet info

`GET /users/{clientCode}/{userId}/wallet`

Returns wallet + recent activity summary.

#### Update user status

`PATCH /users/{clientCode}/{userId}/status?status={STATUS}`

Query param `status` ∈ `ACTIVE | SUSPENDED | BLOCKED`. No body.

---

### 4.4 Transactions

#### List transactions for a client

`GET /transactions/client/{clientCode}`

Query params:

| Param          | Default                       |
| -------------- | ----------------------------- |
| `page`         | `0`                           |
| `size`         | `20`                          |
| `sortBy`       | `createdAt`                   |
| `sortDir`      | `desc`                        |
| `type`         | – (`CREDIT`/`DEBIT`/`REFUND`) |
| `from`         | – (ISO date)                  |
| `to`           | – (ISO date)                  |
| `userId`       | –                             |
| `reference_id` | –                             |

Response: paginated `content[]` with `stats` block (totalCredit, totalDebit, totalRefund, netFlow).

#### User transaction history

`GET /transactions/users/{userId}/history?page=0&size=20`

#### User transaction statistics

`GET /transactions/users/{userId}/statistics`

```json
{
  "userId": "9999999999",
  "totalCredit": 12500.0,
  "totalDebit": 9810.5,
  "totalRefund": 240.0,
  "netBalance": 2929.5,
  "transactionCount": 87,
  "lastTransactionAt": "2026-05-21T08:15:01Z"
}
```

---

### 4.5 Legacy / direct-wallet endpoints

Used only by older flows. Prefer the `client/user` endpoints above for new integrations.

| Method | Path                                       | Purpose                                             |
| ------ | ------------------------------------------ | --------------------------------------------------- |
| `POST` | `/wallets`                                 | Create wallet by `{ userId, clientCode, metadata }` |
| `GET`  | `/wallets/{externalWalletId}/balance`      | Balance lookup                                      |
| `POST` | `/wallets/{externalWalletId}/debit`        | Debit by wallet id                                  |
| `POST` | `/wallets/{externalWalletId}/credit`       | Credit by wallet id                                 |
| `GET`  | `/wallets/{externalWalletId}/transactions` | Wallet-scoped txn history                           |

`POST /wallets` body:

```json
{
  "userId": "9999999999",
  "clientCode": "TEST",
  "metadata": {
    "source": "logistics-wallet-service",
    "createdAt": "2026-05-21T08:10:00Z"
  }
}
```

`POST /wallets/{id}/debit` and `/credit` body:

```json
{
  "amount": 100.0,
  "reference": "ORDER-12345",
  "description": "Optional text",
  "metadata": {
    "source": "logistics-wallet-service",
    "timestamp": "2026-05-21T08:10:00Z"
  }
}
```

---

## 5. Error Format

All non-2xx responses follow:

```json
{
  "status": 400,
  "error": "VALIDATION_FAILED",
  "message": "amount must be > 0",
  "validation_errors": [{ "field": "amount", "message": "amount must be > 0" }],
  "timestamp": "2026-05-21T08:12:00Z",
  "path": "/api/v1/wallets/client/TEST/user/9999999999/debit"
}
```

| HTTP | Meaning                                                | Action                                     |
| ---- | ------------------------------------------------------ | ------------------------------------------ |
| 400  | Validation / business rule (e.g. insufficient balance) | Surface `message` to caller                |
| 401  | Bad signature / clock skew                             | Re-sign; check secret and timestamp        |
| 403  | Forbidden (client not provisioned)                     | Contact provider                           |
| 404  | Wallet / user not found                                | Use `GET .../user/{userId}` to auto-create |
| 409  | Duplicate `reference_id`                               | Treat as success (idempotent replay)       |
| 5xx  | Provider issue                                         | Circuit-break, retry after backoff         |

---

## 6. End-to-end cURL examples

> Replace `$TS`, `$SIG`, `$REQ` with values produced by the signer.

### Get-or-create wallet

```bash
TS=$(date +%s)
PATH_="/api/v1/wallets/client/TEST/user/9999999999"
PAYLOAD="GET:${PATH_}:${TS}"
SIGNED="${TS}:${PAYLOAD}"
SIG=$(printf '%s' "$SIGNED" | openssl dgst -sha256 -hmac "$EXTERNAL_WALLET_SECRET_KEY" -binary | base64)

curl -sS "https://wapi.websiteduniya.com${PATH_}" \
  -H "X-Wallet-Signature: t=${TS},v1=${SIG}" \
  -H "X-Timestamp: ${TS}" \
  -H "X-Request-ID: req_$(date +%s%N)" \
  -H "X-User-ID: "
```

### Debit with body

```bash
TS=$(date +%s)
PATH_="/api/v1/wallets/client/TEST/user/9999999999/debit"
BODY='{"amount":120.5,"currency":"INR","reference_id":"SHIP-AWB123456-FRT","description":"Freight"}'
BODY_HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 | awk '{print tolower($2)}')
PAYLOAD="POST:${PATH_}:${TS}:${BODY_HASH}"
SIGNED="${TS}:${PAYLOAD}"
SIG=$(printf '%s' "$SIGNED" | openssl dgst -sha256 -hmac "$EXTERNAL_WALLET_SECRET_KEY" -binary | base64)

curl -sS -X POST "https://wapi.websiteduniya.com${PATH_}" \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Signature: t=${TS},v1=${SIG}" \
  -H "X-Timestamp: ${TS}" \
  -H "X-Request-ID: req_$(date +%s%N)" \
  -H "X-User-ID: " \
  -d "$BODY"
```

---

## 7. Integration Checklist

- [ ] Secret key stored in env / secrets manager, never logged
- [ ] System clock synced via NTP (signature uses Unix seconds)
- [ ] `X-User-ID` left empty; no `Authorization` header
- [ ] HMAC `path` includes the `/api/v1` prefix
- [ ] Body hashed AFTER serialization, signed BEFORE sending; same string sent on the wire
- [ ] `reference_id` generated as unique, deterministic per business event (for idempotency)
- [ ] Circuit breaker around all calls
- [ ] Balance / history responses cached briefly; caches busted on debit/credit/topup/refund
- [ ] 4xx surfaced to caller with `message`; 5xx retried by orchestrator only
- [ ] Audit log every debit / credit / refund on the client side
