import type { CodeSample } from "@/components/developers/code-block";

/**
 * The External Shipment API reference, authored as data.
 *
 * The docs page renders sections and its side navigation from this array, so
 * adding an endpoint here is all that is needed to document it.
 */

export interface EndpointParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface EndpointDoc {
  id: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  title: string;
  description: string;
  params?: EndpointParam[];
  samples: CodeSample[];
  responseSample?: string;
  notes?: string[];
}

export interface DocSection {
  id: string;
  title: string;
  endpoints: EndpointDoc[];
}

export const API_BASE = "https://ops.subsolution.in";

const curl = (label: string, code: string): CodeSample => ({
  label,
  language: "bash",
  code,
});

// ---------------------------------------------------------------------------
// Sample generation
//
// Every endpoint's cURL, Node.js and Python samples are generated from one
// request description, so the three can never drift apart as endpoints change.
// ---------------------------------------------------------------------------

interface RequestSpec {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path after the host, e.g. "/api/v1/external/shipments". */
  path: string;
  /** JSON request body, if any. */
  body?: Record<string, unknown>;
  /** Query string parameters, if any. */
  query?: Record<string, string | number>;
  /** Extra headers beyond Authorization / Content-Type. */
  headers?: Record<string, string>;
  /** Trailing line for the Node/Python samples, e.g. "console.log(data)". */
  resultHint?: { node: string; python: string };
}

/** Pretty-print JSON, re-indenting continuation lines to sit under the caller. */
function jsonBlock(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

/** Same, but with JSON literals rewritten to their Python spellings. */
function pyBlock(value: unknown, indent: number): string {
  return jsonBlock(value, indent)
    .replace(/: true\b/g, ": True")
    .replace(/: false\b/g, ": False")
    .replace(/: null\b/g, ": None");
}

function queryString(query?: Record<string, string | number>): string {
  if (!query || Object.keys(query).length === 0) return "";
  return `?${Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")}`;
}

function curlSample(spec: RequestSpec): CodeSample {
  const url = `${API_BASE}${spec.path}${queryString(spec.query)}`;
  const lines: string[] = [];

  // GET needs no -X, and quoting the URL matters once it has a query string.
  lines.push(
    spec.method === "GET"
      ? `curl "${url}" \\`
      : `curl -X ${spec.method} ${url} \\`,
  );
  lines.push(
    `  -H "Authorization: Bearer $TOKEN"${spec.body || spec.headers ? " \\" : ""}`,
  );

  const extra = Object.entries(spec.headers || {});
  extra.forEach(([k, v], i) => {
    const last = i === extra.length - 1 && !spec.body;
    lines.push(`  -H "${k}: ${v}"${last ? "" : " \\"}`);
  });

  if (spec.body) {
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${jsonBlock(spec.body, 2)}'`);
  }

  return { label: "cURL", language: "bash", code: lines.join("\n") };
}

function nodeSample(spec: RequestSpec): CodeSample {
  const url = `${API_BASE}${spec.path}${queryString(spec.query)}`;
  const headers: string[] = ["    Authorization: `Bearer ${token}`,"];

  for (const [k, v] of Object.entries(spec.headers || {})) {
    headers.push(`    "${k}": "${v}",`);
  }
  if (spec.body) headers.push(`    "Content-Type": "application/json",`);

  const lines = [
    `const res = await fetch("${url}", {`,
    `  method: "${spec.method}",`,
    `  headers: {`,
    ...headers,
    `  },`,
    ...(spec.body
      ? [`  body: JSON.stringify(${jsonBlock(spec.body, 2)}),`]
      : []),
    `});`,
    ``,
    `const { data } = await res.json();`,
    ...(spec.resultHint ? [spec.resultHint.node] : []),
  ];

  return { label: "Node.js", language: "javascript", code: lines.join("\n") };
}

function pythonSample(spec: RequestSpec): CodeSample {
  const url = `${API_BASE}${spec.path}`;
  const fn = spec.method.toLowerCase();

  const headerEntries = [`"Authorization": f"Bearer {token}"`];
  for (const [k, v] of Object.entries(spec.headers || {})) {
    headerEntries.push(`"${k}": "${v}"`);
  }

  const lines = [
    `import requests`,
    ``,
    `res = requests.${fn}(`,
    `    "${url}",`,
    `    headers={${headerEntries.join(", ")}},`,
    ...(spec.query ? [`    params=${pyBlock(spec.query, 4)},`] : []),
    ...(spec.body ? [`    json=${pyBlock(spec.body, 4)},`] : []),
    `)`,
    ``,
    `data = res.json()["data"]`,
    ...(spec.resultHint ? [spec.resultHint.python] : []),
  ];

  return { label: "Python", language: "python", code: lines.join("\n") };
}

/** cURL + Node.js + Python for one request. */
function allLanguages(spec: RequestSpec): CodeSample[] {
  return [curlSample(spec), nodeSample(spec), pythonSample(spec)];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "authentication",
    title: "Authentication",
    endpoints: [
      {
        id: "auth-token",
        method: "POST",
        path: "/api/v1/external/auth/token",
        title: "Get an access token",
        description:
          "Exchange your client id and secret for a bearer token valid for one hour. There is no refresh token — request a new one when it expires. This is the only endpoint that does not require a token.",
        params: [
          {
            name: "clientId",
            type: "string",
            required: true,
            description: "Your credential's public id (lgk_live_…)",
          },
          {
            name: "clientSecret",
            type: "string",
            required: true,
            description:
              "The secret shown once when the credential was created",
          },
        ],
        samples: [
          curl(
            "cURL",
            `curl -X POST ${API_BASE}/api/v1/external/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "lgk_live_9f2a5c1d8e3b4a6f7c0d1e2f",
    "clientSecret": "sk_live_..."
  }'`,
          ),
          {
            label: "Node.js",
            language: "javascript",
            code: `const res = await fetch("${API_BASE}/api/v1/external/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clientId: process.env.LOGISTICS_CLIENT_ID,
    clientSecret: process.env.LOGISTICS_CLIENT_SECRET,
  }),
});

const { data } = await res.json();
const token = data.accessToken; // valid for data.expiresIn seconds`,
          },
          {
            label: "Python",
            language: "python",
            code: `import os, requests

res = requests.post(
    "${API_BASE}/api/v1/external/auth/token",
    json={
        "clientId": os.environ["LOGISTICS_CLIENT_ID"],
        "clientSecret": os.environ["LOGISTICS_CLIENT_SECRET"],
    },
)
token = res.json()["data"]["accessToken"]`,
          },
        ],
        responseSample: `{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "scopes": ["shipment:create:own", "shipment:read:own"],
    "apiVersion": "2026-08-21"
  },
  "request_id": "req_9370c0b2d9f2054f"
}`,
        notes: [
          "Tokens are confined to /api/v1/external/*. Using one against any other endpoint returns 401.",
          "Revoking the credential invalidates every token already issued from it, immediately.",
        ],
      },
    ],
  },

  {
    id: "shipments",
    title: "Shipments",
    endpoints: [
      {
        id: "rates",
        method: "POST",
        path: "/api/v1/external/shipments/rates",
        title: "Get rate quotes",
        description:
          "Price a route across every serviceable courier partner. Each serviceable quote carries a quoteToken valid for 15 minutes, which you can pass to the booking endpoint for two-step booking.",
        params: [
          {
            name: "fromPincode",
            type: "string",
            required: true,
            description: "6-digit pickup pincode",
          },
          {
            name: "toPincode",
            type: "string",
            required: true,
            description: "6-digit delivery pincode",
          },
          {
            name: "weight",
            type: "number",
            required: true,
            description: "Actual weight in kg",
          },
          {
            name: "dimensions",
            type: "object",
            required: true,
            description: "length, width, height in cm",
          },
          {
            name: "numberOfBoxes",
            type: "integer",
            description: "Defaults to 1",
          },
          {
            name: "paymentType",
            type: "string",
            description: "PREPAID (default) or COD",
          },
          {
            name: "codAmount",
            type: "number",
            description: "Required when paymentType is COD",
          },
          {
            name: "serviceType",
            type: "string",
            description: "STANDARD, EXPRESS or ECONOMY",
          },
          {
            name: "shipmentType",
            type: "string",
            description: "B2C (default) or B2B",
          },
        ],
        samples: allLanguages({
          method: "POST",
          path: "/api/v1/external/shipments/rates",
          body: {
            fromPincode: "400001",
            toPincode: "410210",
            weight: 5,
            dimensions: { length: 30, width: 20, height: 15 },
            paymentType: "PREPAID",
          },
          resultHint: {
            node: "console.log(data.quotes[0].partnerName, data.quotes[0].totalAmount);",
            python:
              'print(data["quotes"][0]["partnerName"], data["quotes"][0]["totalAmount"])',
          },
        }),
        responseSample: `{
  "success": true,
  "data": {
    "quotes": [
      {
        "partnerId": "cmse82rra00001xbplwuy6r9z",
        "partnerName": "Test Courier",
        "totalAmount": 462.97,
        "deliveryDays": 3,
        "serviceable": true,
        "chargeBreakdown": [
          { "name": "Base Freight", "amount": 80 },
          { "name": "Fuel Surcharge", "amount": 33 },
          { "name": "GST", "amount": 70.62 }
        ],
        "quoteToken": "eyJ2IjoxLCJwYXJ0bmVy..."
      }
    ],
    "recommended": { "partnerId": "cmse82rra00001xbplwuy6r9z" }
  },
  "request_id": "req_47a71968efc8af73"
}`,
        notes: ["totalAmount is GST-inclusive."],
      },

      {
        id: "book",
        method: "POST",
        path: "/api/v1/external/shipments",
        title: "Book a shipment",
        description:
          "Create a shipment. In one-step mode (recommended) you omit quoteToken and the server prices the route, picks a partner and books in a single call. In two-step mode you pass the quoteToken, partnerId and quoteSnapshot from a prior /rates call. Booking debits the outlet wallet.",
        params: [
          {
            name: "orderId",
            type: "string",
            required: true,
            description: "Your own unique reference",
          },
          {
            name: "pickupAddress",
            type: "object",
            required: true,
            description:
              "name, phone (+91…), addressLine1, city, state, pincode",
          },
          {
            name: "deliveryAddress",
            type: "object",
            required: true,
            description: "Same shape as pickupAddress",
          },
          {
            name: "packageDetails",
            type: "object",
            required: true,
            description: "weight, dimensions, value, fragile",
          },
          {
            name: "selection",
            type: "string",
            description:
              "cheapest (default) or fastest — how to pick a partner",
          },
          {
            name: "partnerId",
            type: "string",
            description: "Book this exact partner instead of using selection",
          },
          {
            name: "paymentType",
            type: "string",
            description: "PREPAID (default) or COD",
          },
          {
            name: "codAmount",
            type: "number",
            description: "Required when paymentType is COD",
          },
          {
            name: "quoteToken",
            type: "string",
            description:
              "Two-step booking only; requires partnerId and quoteSnapshot",
          },
        ],
        samples: [
          ...allLanguages({
            method: "POST",
            path: "/api/v1/external/shipments",
            headers: { "Idempotency-Key": "order-1042" },
            body: {
              orderId: "ORDER-1042",
              selection: "cheapest",
              pickupAddress: {
                name: "Mumbai Warehouse",
                phone: "+919876543210",
                addressLine1: "12 Fort Street",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
              },
              deliveryAddress: {
                name: "Riya Sharma",
                phone: "+919812345678",
                addressLine1: "88 Palm Beach Road",
                city: "Navi Mumbai",
                state: "Maharashtra",
                pincode: "410210",
              },
              packageDetails: {
                weight: 5,
                dimensions: { length: 30, width: 20, height: 15 },
                value: 2500,
              },
              paymentType: "PREPAID",
            },
            resultHint: {
              node: "console.log(data.shipment.awbNumber);",
              python: 'print(data["shipment"]["awbNumber"])',
            },
          }),
        ],
        responseSample: `{
  "success": true,
  "data": {
    "shipment": {
      "id": "c6e1a482-6ca7-4ee4-a2b0-8a03ee61852b",
      "orderId": "ORDER-1042",
      "status": "BOOKED",
      "awbNumber": "1234567890",
      "partnerName": "Test Courier",
      "totalCost": 462.97,
      "trackingUrl": "https://..."
    }
  },
  "request_id": "req_17ffda1455586732"
}`,
        notes: [
          "Always send an Idempotency-Key. A retry with the same key replays the original response rather than booking twice.",
          "The wallet is debited for the system charge; any outlet markup is your revenue and is not debited.",
        ],
      },

      {
        id: "list",
        method: "GET",
        path: "/api/v1/external/shipments",
        title: "List shipments",
        description:
          "List your shipments, newest first. Only shipments belonging to your account are ever returned.",
        params: [
          { name: "page", type: "integer", description: "Defaults to 1" },
          {
            name: "limit",
            type: "integer",
            description: "Defaults to 20, max 100",
          },
          {
            name: "status",
            type: "string",
            description: "CREATED, BOOKED, IN_TRANSIT, DELIVERED, CANCELLED, …",
          },
          {
            name: "paymentType",
            type: "string",
            description: "PREPAID or COD",
          },
          { name: "dateFrom", type: "string", description: "ISO 8601 date" },
          { name: "dateTo", type: "string", description: "ISO 8601 date" },
        ],
        samples: allLanguages({
          method: "GET",
          path: "/api/v1/external/shipments",
          query: { status: "IN_TRANSIT", limit: 20 },
          resultHint: {
            node: "console.log(data.shipments.length, data.pagination.totalCount);",
            python:
              'print(len(data["shipments"]), data["pagination"]["totalCount"])',
          },
        }),
        responseSample: `{
  "success": true,
  "data": {
    "shipments": [ { "id": "...", "orderId": "ORDER-1042", "status": "IN_TRANSIT" } ],
    "pagination": { "page": 1, "limit": 20, "totalCount": 1, "totalPages": 1 }
  },
  "request_id": "req_e629ff0850a2012d"
}`,
      },

      {
        id: "details",
        method: "GET",
        path: "/api/v1/external/shipments/{identifier}",
        title: "Get shipment details",
        description:
          "Fetch one shipment. The identifier can be the shipment id, its AWB number, or your own order id — whichever you have.",
        samples: [
          curl(
            "cURL",
            `# All three resolve to the same shipment
curl ${API_BASE}/api/v1/external/shipments/ORDER-1042   -H "Authorization: Bearer $TOKEN"
curl ${API_BASE}/api/v1/external/shipments/1234567890   -H "Authorization: Bearer $TOKEN"
curl ${API_BASE}/api/v1/external/shipments/c6e1a482-... -H "Authorization: Bearer $TOKEN"`,
          ),
          {
            label: "Node.js",
            language: "javascript",
            code: `// identifier can be the shipment id, the AWB, or your own order id
const identifier = "ORDER-1042";

const res = await fetch(
  \`${API_BASE}/api/v1/external/shipments/\${encodeURIComponent(identifier)}\`,
  { headers: { Authorization: \`Bearer \${token}\` } },
);

const { data } = await res.json();
console.log(data.shipment.status, data.shipment.awbNumber);`,
          },
          {
            label: "Python",
            language: "python",
            code: `import requests
from urllib.parse import quote

# identifier can be the shipment id, the AWB, or your own order id
identifier = "ORDER-1042"

res = requests.get(
    f"${API_BASE}/api/v1/external/shipments/{quote(identifier)}",
    headers={"Authorization": f"Bearer {token}"},
)

data = res.json()["data"]
print(data["shipment"]["status"], data["shipment"]["awbNumber"])`,
          },
        ],
      },

      {
        id: "edit",
        method: "PATCH",
        path: "/api/v1/external/shipments/{identifier}",
        title: "Edit a shipment",
        description:
          "Update a shipment that has not yet been handed to the courier. Send only the fields you want to change.",
        params: [
          {
            name: "pickupAddress",
            type: "object",
            description: "Replaces the pickup address",
          },
          {
            name: "deliveryAddress",
            type: "object",
            description: "Replaces the delivery address",
          },
          {
            name: "packageDetails",
            type: "object",
            description: "Weight and dimensions",
          },
          {
            name: "serviceType",
            type: "string",
            description: "STANDARD, EXPRESS or ECONOMY",
          },
          {
            name: "specialInstructions",
            type: "string",
            description: "Free-text delivery instructions",
          },
        ],
        samples: allLanguages({
          method: "PATCH",
          path: "/api/v1/external/shipments/ORDER-1042",
          body: { specialInstructions: "Leave with reception" },
        }),
        notes: ["A shipment already handed to the carrier cannot be edited."],
      },

      {
        id: "cancel",
        method: "POST",
        path: "/api/v1/external/shipments/{identifier}/cancel",
        title: "Cancel a shipment",
        description:
          "Cancel a shipment and refund the wallet where its state allows. This cannot be undone.",
        params: [
          {
            name: "reason",
            type: "string",
            required: true,
            description: "Why it is being cancelled",
          },
        ],
        samples: allLanguages({
          method: "POST",
          path: "/api/v1/external/shipments/ORDER-1042/cancel",
          body: { reason: "Customer changed their mind" },
        }),
      },

      {
        id: "serviceability",
        method: "POST",
        path: "/api/v1/external/shipments/serviceability",
        title: "Check serviceability",
        description:
          "Find which courier partners cover a route, with distance and zone information. Cheaper than a full quote when you only need a yes/no.",
        params: [
          {
            name: "fromPincode",
            type: "string",
            required: true,
            description: "6-digit pickup pincode",
          },
          {
            name: "toPincode",
            type: "string",
            required: true,
            description: "6-digit delivery pincode",
          },
          { name: "weight", type: "number", description: "Weight in kg" },
        ],
        samples: allLanguages({
          method: "POST",
          path: "/api/v1/external/shipments/serviceability",
          body: { fromPincode: "400001", toPincode: "410210", weight: 5 },
        }),
      },
    ],
  },

  {
    id: "tracking",
    title: "Tracking",
    endpoints: [
      {
        id: "tracking-by-id",
        method: "GET",
        path: "/api/v1/external/shipments/{identifier}/tracking",
        title: "Get tracking history",
        description:
          "The full event history and current status of a shipment, by shipment id, AWB number or your order id.",
        samples: allLanguages({
          method: "GET",
          path: "/api/v1/external/shipments/ORDER-1042/tracking",
          resultHint: {
            node: "console.log(data.status, data.trackingEvents);",
            python: 'print(data["status"], data["trackingEvents"])',
          },
        }),
      },
      {
        id: "tracking-by-awb",
        method: "GET",
        path: "/api/v1/external/shipments/track/{awbNumber}",
        title: "Track by AWB number",
        description:
          "Track using the carrier's AWB number. Only AWBs belonging to your account resolve; anything else returns 404.",
        samples: allLanguages({
          method: "GET",
          path: "/api/v1/external/shipments/track/1234567890",
        }),
      },
      {
        id: "documents",
        method: "GET",
        path: "/api/v1/external/shipments/{identifier}/documents",
        title: "List documents",
        description:
          "Labels, invoices and proof-of-delivery documents attached to a shipment.",
        samples: allLanguages({
          method: "GET",
          path: "/api/v1/external/shipments/ORDER-1042/documents",
        }),
      },
      {
        id: "label",
        method: "POST",
        path: "/api/v1/external/shipments/{identifier}/label",
        title: "Fetch the shipping label",
        description:
          "Fetch the carrier's shipping label for a booked shipment.",
        samples: allLanguages({
          method: "POST",
          path: "/api/v1/external/shipments/ORDER-1042/label",
        }),
      },
    ],
  },
];

/** Error codes the API can return, grouped by the HTTP status they carry. */
export const ERROR_CODES: Array<{
  code: string;
  status: number;
  type: string;
  meaning: string;
}> = [
  {
    code: "invalid_credentials",
    status: 401,
    type: "authentication_error",
    meaning: "Wrong client id or secret",
  },
  {
    code: "token_expired",
    status: 401,
    type: "authentication_error",
    meaning: "Token is past its hour; request a new one",
  },
  {
    code: "credential_revoked",
    status: 401,
    type: "authentication_error",
    meaning: "The credential was revoked",
  },
  {
    code: "credential_ip_not_allowed",
    status: 403,
    type: "permission_error",
    meaning: "Source IP is not in the credential's allowlist",
  },
  {
    code: "insufficient_scope",
    status: 403,
    type: "permission_error",
    meaning: "The credential lacks the scope this endpoint needs",
  },
  {
    code: "validation_failed",
    status: 400,
    type: "invalid_request_error",
    meaning: "A field is missing or malformed; see error.details",
  },
  {
    code: "shipment_not_found",
    status: 404,
    type: "invalid_request_error",
    meaning: "No shipment matches, or it belongs to another account",
  },
  {
    code: "no_serviceable_partner",
    status: 400,
    type: "invalid_request_error",
    meaning: "No courier covers this route and package",
  },
  {
    code: "duplicate_order_id",
    status: 409,
    type: "invalid_request_error",
    meaning: "That orderId is already used",
  },
  {
    code: "idempotency_key_in_progress",
    status: 409,
    type: "invalid_request_error",
    meaning: "An identical request is still running; retry shortly",
  },
  {
    code: "idempotency_key_reuse",
    status: 422,
    type: "invalid_request_error",
    meaning: "The key was used with a different request body",
  },
  {
    code: "quote_stale",
    status: 409,
    type: "invalid_request_error",
    meaning: "The quote expired and pricing changed; re-quote",
  },
  {
    code: "insufficient_wallet_balance",
    status: 402,
    type: "invalid_request_error",
    meaning: "The outlet wallet cannot cover this booking",
  },
  {
    code: "shipment_not_cancellable",
    status: 409,
    type: "invalid_request_error",
    meaning: "Too far along its lifecycle to cancel",
  },
  {
    code: "rate_limit_exceeded",
    status: 429,
    type: "rate_limit_error",
    meaning: "Slow down; see the Retry-After header",
  },
  {
    code: "internal_error",
    status: 500,
    type: "api_error",
    meaning: "Something failed on our side; quote the request_id",
  },
];

export const RATE_LIMITS = [
  {
    operation: "All requests",
    limit: "60 / minute",
    note: "Per credential; configurable per key",
  },
  { operation: "Booking", limit: "20 / minute", note: "POST /shipments" },
  { operation: "Quotes & serviceability", limit: "60 / minute", note: "" },
  { operation: "Tracking", limit: "120 / minute", note: "" },
  { operation: "Labels & documents", limit: "30 / minute", note: "" },
  { operation: "Token exchange", limit: "10 / minute", note: "Per client id" },
];
