### Postman Environment Variables

```bash
baseUrl=https://wapi.websiteduniya.com/api/v1
hmacSecretKey=production-hmac-secret-key-256-bit-minimum-ultra-secure-change-me
CLINET_CODE=TEST

```

### Postman Pre-Script

```javascript
// ----- Configuration -----
const secretKey = pm.variables.get("HMAC_SECRET_KEY") || "";
const username = pm.variables.get("HMAC_USER_ID") || "";
const token = pm.variables.get("HMAC_JWT_TOKEN") || "";
let requestId = pm.variables.get("HMAC_REQUEST_ID");

// ----- Prepare Request Info -----
const method = pm.request.method.toUpperCase();

// Resolve {{baseUrl}} and other variables if present
let fullUrl = pm.request.url.toString();
if (fullUrl.includes("{{")) {
  fullUrl = fullUrl.replace(/{{(\w+)}}/g, (_, k) => pm.variables.get(k) || "");
}

let path = "/";
try {
  const parsedUrl = new URL(fullUrl);
  path = parsedUrl.pathname;
} catch (err) {
  console.error("❌ Failed to parse path from URL:", err);
}

// ----- Generate Timestamp -----
const timestamp = Math.floor(Date.now() / 1000);

// ----- Optional Body Hash -----
let rawBody = pm.request.body?.raw || "";
let bodyHash = "";
if (rawBody && rawBody.trim()) {
  bodyHash = CryptoJS.SHA256(rawBody).toString(CryptoJS.enc.Hex).toLowerCase();
}

// ----- Construct HMAC Payload -----
let payload = `${method}:${path}:${timestamp}`;
if (bodyHash) {
  payload += `:${bodyHash}`;
}
const signedPayload = `${timestamp}:${payload}`;

// ----- Generate Signature -----
const hmac = CryptoJS.HmacSHA256(signedPayload, secretKey);
const base64Signature = CryptoJS.enc.Base64.stringify(hmac);
const formattedSignature = `t=${timestamp},v1=${base64Signature}`;

// ----- Set or Generate Request ID -----
if (!requestId) {
  requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  pm.variables.set("HMAC_REQUEST_ID", requestId);
}

// ----- Attach Headers -----
pm.request.headers.upsert({
  key: "X-Wallet-Signature",
  value: formattedSignature,
});
pm.request.headers.upsert({ key: "X-Timestamp", value: String(timestamp) });
pm.request.headers.upsert({ key: "X-Request-ID", value: requestId });
pm.request.headers.upsert({ key: "X-User-ID", value: username });

if (token) {
  pm.request.headers.upsert({ key: "Authorization", value: `Bearer ${token}` });
}

// ----- Debug Output -----
console.log("✅ HMAC Payload Prepared", {
  method,
  path,
  timestamp,
  signedPayload,
  signature: base64Signature.slice(0, 32) + "...",
  requestId,
});
```

## 1. Wallet apis

1.1 Get all the wallets for the speific client

```bash
curl --location 'http://localhost:8080/api/v1/wallets/client/TEST?page=0&size=20&sortBy=createdAt&sortDir=desc&userId=null&minBalance=null&maxBalance=null&status=null'
```

response:

```json
{
  "pagination": {
    "total_elements": 1,
    "has_previous": false,
    "has_next": false,
    "total_pages": 1,
    "current_page": 0,
    "page_size": 20
  },
  "data": [
    {
      "id": 1,
      "user_id": "9876543211",
      "client_code": "TEST",
      "balance": 10000.0,
      "currency": "INR",
      "status": "ACTIVE",
      "created_at": "2026-02-20T12:48:02",
      "updated_at": "2026-02-20T13:41:49"
    }
  ],
  "stats": {
    "total_balance": 10000.0,
    "active_balance": 10000.0,
    "min_balance": 10000.0,
    "max_balance": 10000.0,
    "closed_wallets": 0,
    "suspended_wallets": 0,
    "total_wallets": 1,
    "blocked_wallets": 0,
    "active_wallets": 1,
    "average_balance": 10000.0
  },
  "success": true,
  "filters": {
    "clientCode": "TEST",
    "userId": "",
    "status": ""
  }
}
```

1.2 Get or create wallet for the specific user

```bash
curl --location 'http://localhost:8080/api/v1/wallets/client/TEST/user/9876543211' \
--header 'Accept: */*'
```

Response:

```json
{
  "success": true,
  "wallet_id": 1,
  "user_id": "9876543211",
  "balance": 10000.0,
  "currency": "INR",
  "status": "ACTIVE",
  "created_at": "2026-02-20T12:48:02.675217",
  "updated_at": "2026-02-20T13:41:49.518066",
  "message": "Wallet retrieved successfully"
}
```

1.3 Top up wallet

```bash
curl --location 'http://localhost:8080/api/v1/wallets/client/TEST/user/9876543211/topup' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data '{
  "amount": 10000,
  "currency": "INR",
  "reference_id": "121211111111111111111111",
  "description": "deserunt voluptate in",
  "metadata": "mollit laboris magna ullamco",
  "remarks": {
    "tempor4b3": {},
    "dolor_754": {},
    "Lorem37c": {}
  }
}'
```

Response:

```json
{
  "success": true,
  "transaction_id": 2,
  "wallet_id": 1,
  "user_id": "9876543211",
  "type": "TOP_UP",
  "amount": 10000,
  "currency": "INR",
  "balance_before": 10000.0,
  "balance_after": 20000.0,
  "reference_id": "1212111111111111111111111",
  "description": "deserunt voluptate in",
  "remarks": {
    "dolor_754": {},
    "clientContext": true,
    "tempor4b3": {},
    "currency": "INR",
    "clientCode": "TEST",
    "Lorem37c": {}
  },
  "status": "COMPLETED",
  "timestamp": "2026-02-20T14:04:47.206498",
  "message": "Transaction completed successfully"
}
```

1.4 Debit wallet

```bash
curl --location 'http://localhost:8080/api/v1/wallets/client/TEST/user/6289572156/debit' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data '{
  "amount": 200,
  "currency": "INR",
  "reference_id": "0fY_B",
  "description": "deserunt voluptate in",
  "metadata": "mollit laboris magna ullamco",
  "remarks": {
    "tempor4b3": {},
    "dolor_754": {},
    "Lorem37c": {}
  }
}'
```

Response:

```json
{
  "success": true,
  "transaction_id": 3,
  "wallet_id": 1,
  "user_id": "9876543211",
  "type": "DEBIT",
  "amount": 200,
  "currency": "INR",
  "balance_before": 20000.0,
  "balance_after": 19800.0,
  "reference_id": "0fY_B",
  "description": "deserunt voluptate in",
  "remarks": {
    "dolor_754": {},
    "clientContext": true,
    "tempor4b3": {},
    "currency": "INR",
    "clientCode": "TEST",
    "Lorem37c": {}
  },
  "status": "COMPLETED",
  "timestamp": "2026-02-20T14:05:34.445033",
  "message": "Transaction completed successfully"
}
```

1.5 Refund wallet

```bash
curl --location 'http://localhost:8080/api/v1/wallets/client/TEST/user/9876543211/refund' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data '{
  "amount": 200,
  "currency": "INR",
  "reference_id": "1212111111111111111111111",
  "transaction_id": 3,
  "description": "et",
  "metadata": "pariatur labore",
  "remarks": {
    "consequatb11": {},
    "ut_9e": {},
    "dolore8": {}
  }
}'
```

Response:

```json
{
  "amount": 200,
  "currency": "INR",
  "reference_id": "1212111111111111111111111",
  "transaction_id": 3,
  "description": "et",
  "metadata": "pariatur labore",
  "remarks": {
    "consequatb11": {},
    "ut_9e": {},
    "dolore8": {}
  }
}
```

1.6 Get user wallet info

```bash
curl --location 'http://localhost:8080/api/v1/users/TEST/9876543211/wallet' \
--header 'Accept: */*'
```

Response:

```json
{
  "data": {
    "createdAt": "2026-02-20T12:48:02.667142",
    "wallet": {
      "updatedAt": "2026-02-20T14:05:34.451474",
      "createdAt": "2026-02-20T12:48:02.675217",
      "currency": "INR",
      "balance": 19800.0,
      "id": 1,
      "status": "ACTIVE"
    },
    "clientName": "TEST",
    "clientCode": "TEST",
    "id": 1,
    "userId": "9876543211",
    "status": "ACTIVE",
    "updatedAt": "2026-02-20T12:48:02.667161"
  },
  "success": true,
  "message": "User with wallet info retrieved successfully"
}
```

1.7 Update user wallet status

```bash
curl --location --request PATCH 'http://localhost:8080/api/v1/users/TEST/9876543211/status?status=ACTIVE' \
--header 'Accept: */*'
```

Response:

```json
{
  "data": {
    "clientCode": "TEST",
    "updatedAt": "2026-02-20T12:48:02.667161",
    "userId": "9876543211",
    "status": "ACTIVE"
  },
  "success": true,
  "message": "User status updated successfully"
}
```

2. Transaction apis

2.1 Get all the transactions for the client

```bash
curl --location 'http://localhost:8080/api/v1/transactions/client/TEST?page=0&size=20&sortBy=createdAt&sortDir=desc'
```

Response:

```json
{
  "pagination": {
    "has_previous": false,
    "has_next": false,
    "page_size": 20,
    "total_elements": 3,
    "current_page": 0,
    "total_pages": 1
  },
  "data": [
    {
      "id": 3,
      "type": "DEBIT",
      "amount": 200.0,
      "balanceBefore": 20000.0,
      "balanceAfter": 19800.0,
      "currency": "INR",
      "referenceId": "0fY_B",
      "clientCode": "TEST",
      "description": "deserunt voluptate in",
      "metadata": null,
      "remarks": "{\"Lorem37c\": {}, \"currency\": \"INR\", \"dolor_754\": {}, \"tempor4b3\": {}, \"clientCode\": \"TEST\", \"clientContext\": true}",
      "status": "COMPLETED",
      "createdAt": "2026-02-20T14:05:34.445033",
      "wallet_id": 1,
      "walletId": 1,
      "remarksAsMap": {
        "Lorem37c": {},
        "currency": "INR",
        "dolor_754": {},
        "tempor4b3": {},
        "clientCode": "TEST",
        "clientContext": true
      },
      "userId": "9876543211"
    },
    {
      "id": 2,
      "type": "TOP_UP",
      "amount": 10000.0,
      "balanceBefore": 10000.0,
      "balanceAfter": 20000.0,
      "currency": "INR",
      "referenceId": "1212111111111111111111111",
      "clientCode": "TEST",
      "description": "deserunt voluptate in",
      "metadata": null,
      "remarks": "{\"Lorem37c\": {}, \"currency\": \"INR\", \"dolor_754\": {}, \"tempor4b3\": {}, \"clientCode\": \"TEST\", \"clientContext\": true}",
      "status": "COMPLETED",
      "createdAt": "2026-02-20T14:04:47.206498",
      "wallet_id": 1,
      "walletId": 1,
      "remarksAsMap": {
        "Lorem37c": {},
        "currency": "INR",
        "dolor_754": {},
        "tempor4b3": {},
        "clientCode": "TEST",
        "clientContext": true
      },
      "userId": "9876543211"
    },
    {
      "id": 1,
      "type": "TOP_UP",
      "amount": 10000.0,
      "balanceBefore": 0.0,
      "balanceAfter": 10000.0,
      "currency": "INR",
      "referenceId": "121211111111111111111111",
      "clientCode": "TEST",
      "description": "deserunt voluptate in",
      "metadata": null,
      "remarks": "{\"Lorem37c\": {}, \"currency\": \"INR\", \"dolor_754\": {}, \"tempor4b3\": {}, \"clientCode\": \"TEST\", \"clientContext\": true}",
      "status": "COMPLETED",
      "createdAt": "2026-02-20T13:41:49.437221",
      "wallet_id": 1,
      "walletId": 1,
      "remarksAsMap": {
        "Lorem37c": {},
        "currency": "INR",
        "dolor_754": {},
        "tempor4b3": {},
        "clientCode": "TEST",
        "clientContext": true
      },
      "userId": "9876543211"
    }
  ],
  "stats": {
    "total_completed_amount": 20200.0,
    "reversed_transactions": 0,
    "total_transactions": 3,
    "completed_transactions": 3,
    "total_debit_amount": 200.0,
    "cancelled_transactions": 0,
    "failed_transactions": 0,
    "total_refund_amount": 0,
    "pending_transactions": 0,
    "total_topup_amount": 20000.0
  },
  "success": true,
  "filters": {
    "clientCode": "TEST"
  }
}
```
