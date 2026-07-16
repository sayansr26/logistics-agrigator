# Shipment Service — Frontend Onboarding

> Audience: Frontend engineers joining the Logistics Aggregator team.
> Goal: be productive against the Shipment Service in under an hour.
> Last updated: May 2026

## What it is

The Shipment Service owns everything a shipment touches from the moment a client says "ship this" to the day it's delivered (or returned): creation, rate shopping across 75+ couriers, partner assignment, tracking events, NDR (non-delivery report) handling, pickup scheduling, manifests, labels, and bulk imports.

You will never call the service directly. From the frontend, every shipment call goes through the **API Gateway at `http://localhost:3001`** under `/api/v1/shipments/*`. The gateway handles JWT auth, RBAC scope filtering, rate limits, and rewrites — the shipment service itself listens on port 3004 but rejects any request that didn't come through the gateway (you'll see `DIRECT_ACCESS_FORBIDDEN` if you try).

If you remember one thing: **base URL is the gateway, auth is a JWT bearer, response envelope is `{ status, data, meta }`.** Everything else is variations on that theme.

## Quick start — your first call

After running `yarn run dev` (see Local dev below), log in via the auth-service and grab a JWT. Then:

```bash
curl http://localhost:3001/api/v1/shipments?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

A 200 response looks like:

```json
{
  "status": "success",
  "data": { "shipments": [/* ... */] },
  "meta": {
    "timestamp": "2026-05-21T10:00:00Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 152,
      "totalPages": 16,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

That's the standard envelope used by every endpoint in the platform. Errors swap `data` for `error`:

```json
{
  "status": "error",
  "error": {
    "code": "SHIPMENT_NOT_FOUND",
    "message": "Shipment not found",
    "details": null
  },
  "meta": { "timestamp": "2026-05-21T10:00:00Z" }
}
```

The shape is defined in `shared/lib/response.js` (`APIResponse.success` / `APIResponse.error`) — same contract across every service, so the RTK Query `transformResponse` you write once works everywhere.

## Auth model — what the gateway expects

Every request needs:

```
Authorization: Bearer <jwt>
```

JWTs are issued by the auth-service (port 3002) and expire in 8 hours by default. The token's payload carries the fields you'll most often need in the UI: `userId`, `email`, `role` (one of 11 — see RBAC docs), `clientId` for multi-tenant scope, `permissions` (the full string list like `shipment:create:own`), and `phone` (used as the wallet user ID for outlet users).

The gateway validates the token, enriches `req.user`, applies scope filtering, and forwards to the service with an internal `X-Internal-Request` header that the service verifies. None of that is your concern from the frontend — but it explains why you can't hit `localhost:3004` directly during testing. Always go through `:3001`.

Token storage convention in the existing frontend is `localStorage.getItem('accessToken')`. RTK Query's `fetchBaseQuery` should attach it via `prepareHeaders`:

```js
prepareHeaders: (headers) => {
  const token = localStorage.getItem("accessToken");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
};
```

## Permissions — what the user can see

The platform uses a `{module}:{action}:{scope}` permission format. For shipments, the ones you'll see most are `shipment:create:own`, `shipment:read:own`, `shipment:read:assigned`, `shipment:update:assigned`, `shipment:update:all`, `shipment:delete:own`, `shipment:bulk_create:assigned`, `shipment:manage:assigned`, and `analytics:read:parent`. Scope determines visibility — `own` means the logged-in user's records, `assigned` means records assigned to them or their org, `parent` means the parent client's records, `all` is admin/ops only.

Use the `permissions` array from the JWT to gate UI elements client-side (hide the "Create bulk" button if the user doesn't have `shipment:bulk_create:assigned`). The server enforces the same rules — client-side gating is purely for UX, never security.

## Endpoints — grouped by what you're building

These are the routes mounted under `/api/v1/shipments` at the gateway. Full list with controllers lives in `backend/shipment-service/routes/shipments.js`; the canonical contract is `docs/API-Specifications.md`. Cross-reference both — this section is a map, not a spec.

### Core CRUD

`POST /api/v1/shipments` creates a shipment from an order. The body is large — pickup address, delivery address, package details, payment type, service type — but most fields have sensible defaults and the Joi validator returns specific field paths on failure (e.g. `pickupAddress.phone` must match `+91XXXXXXXXXX`, `pincode` must be exactly 6 digits, COD amount is required only when `paymentType === "COD"`). The full request shape is in API-Specifications.md; don't reproduce it here.

`GET /api/v1/shipments` lists shipments with `page`, `limit` (max 100), `status`, `paymentType`, `dateFrom`, `dateTo` query params. Returns paginated under `meta.pagination`.

`GET /api/v1/shipments/:id` returns a single shipment plus its `trackingEvents` array.

`PUT /api/v1/shipments/:id` updates status or special instructions only — addresses are immutable after creation.

`POST /api/v1/shipments/:id/cancel` cancels and queues a refund (refund result flows through `paymentStatus`).

### Rate shopping & partner selection (the multi-step create flow)

The recommended creation flow on the FE is staged, not a single POST: first check serviceability, then get rates, then create with the selected partner snapshot.

`POST /api/v1/shipments/serviceability` — given pickup/delivery pincodes, returns which partners can service the route.
`POST /api/v1/shipments/calculate-rates` — rates from every available partner; response includes `cheapestRate` and `fastestRate` shortcuts.
`POST /api/v1/shipments/quotes` — same idea as calculate-rates but returns a `quoteSnapshot` blob you pass back into create so the price is locked.
`POST /api/v1/shipments/select-partner` — given a strategy (`cheapest` / `fastest` / `balanced`), returns the selected partner.
`POST /api/v1/shipments/:id/assign-partner` — explicitly assign a partner to an already-created shipment.

### Tracking

`GET /api/v1/shipments/:id/tracking` returns the tracking event list for an authenticated user.

`GET /api/v1/shipments/track/:awbNumber` is **public** — no JWT required — and meant for the customer-facing "Track your package" page. Don't pass tokens to it.

`POST /api/v1/shipments/:id/tracking/events` lets ops/admin add a manual event (gated by `shipment:update:all`).

`GET /api/v1/shipments/analytics/tracking` returns status distribution and performance metrics for dashboards.

### NDR (Non-Delivery Report)

When a courier marks a delivery as failed, an NDR case is opened. `POST /api/v1/shipments/:shipmentId/ndr` creates one, `GET /api/v1/shipments/ndr` lists with filtering, and `POST /api/v1/shipments/ndr/:ndrCaseId/action` takes action (reattempt, RTO, mark resolved). The NDR status enum is `OPEN | ASSIGNED | IN_PROGRESS | REATTEMPT_SCHEDULED | ADDRESS_UPDATED | RTO_INITIATED | RESOLVED | CLOSED`.

### Labels, manifests, pickups

`POST /api/v1/shipments/:shipmentId/label` and `POST /api/v1/shipments/labels/bulk` return PDF label URLs.
`POST /api/v1/shipments/manifest` creates a manifest across multiple shipments for handover.
`POST /api/v1/shipments/pickup/schedule`, `GET .../pickup/schedules`, `PUT .../pickup/:id`, `DELETE .../pickup/:id`, and `GET .../pickup/slots` cover pickup scheduling. Pickup status enum is `SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | FAILED`.

### Bulk operations (in progress — see Caveats)

`POST /api/v1/shipments/bulk` accepts a CSV/Excel upload and returns a `jobId`. Poll `GET /api/v1/shipments/bulk/:jobId/status` for progress. The backend processes batches of 20 concurrently, ~100+ orders/minute. Frontend coverage here is still being built — see the Open work section below.

## Shipment lifecycle

Statuses on the `Shipment` model (defined as a Prisma enum in `backend/shipment-service/prisma/schema.prisma`):

`CREATED` → `BOOKED` → `PICKED_UP` → `IN_TRANSIT` → `OUT_FOR_DELIVERY` → `DELIVERED`

Off-path branches: `CANCELLED` (terminal, may trigger refund), `RTO` (return to origin in progress), `NDR` (open NDR case attached), `HOLD` (disputed or pending resolution).

Payment status is a separate enum on the same record: `PENDING | RESERVED | CONFIRMED | FAILED | REFUNDED | REFUND_FAILED | NO_REFUND`. Display both in the UI — a shipment can be `DELIVERED` with payment `REFUND_FAILED` and that combination matters.

## Error handling

The error envelope is consistent, so a single error handler is enough. Codes you'll see most:

- `VALIDATION_ERROR` (400) — Joi failed; `details.field` tells you which input
- `UNAUTHENTICATED` (401) — token missing or expired; redirect to login
- `FORBIDDEN` (403) — permission denied; show "you don't have access"
- `SHIPMENT_NOT_FOUND` (404)
- `DUPLICATE_ENTRY` (409) — usually a re-used `orderId` for the same `clientId`
- `RATE_LIMIT_EXCEEDED` (429) — back off and retry
- `INTERNAL_ERROR` (500) / `SERVICE_UNAVAILABLE` (503) — show a toast, log to Sentry

Field-level validation errors come back with `details.field` so you can surface them next to the right input rather than as a top-level banner.

## Frontend integration patterns

The codebase is mid-migration from Zustand stores to Redux Toolkit + RTK Query (see `frontend/FRONTEND_ARCHITECTURE_TASK.md` for the larger plan). New work should use RTK Query.

The shipment slice belongs in `frontend/src/api/shipmentApi.js`. A trimmed shape to get you started:

```js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const shipmentApi = createApi({
  reducerPath: "shipmentApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:3001/api/v1",
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("accessToken");
      if (token) headers.set("authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Shipment", "ShipmentList"],
  endpoints: (b) => ({
    listShipments: b.query({
      query: (params) => ({ url: "/shipments", params }),
      transformResponse: (r) => ({
        items: r.data.shipments,
        pagination: r.meta.pagination,
      }),
      providesTags: ["ShipmentList"],
    }),
    getShipment: b.query({
      query: (id) => `/shipments/${id}`,
      transformResponse: (r) => r.data.shipment,
      providesTags: (_, __, id) => [{ type: "Shipment", id }],
    }),
    createShipment: b.mutation({
      query: (body) => ({ url: "/shipments", method: "POST", body }),
      invalidatesTags: ["ShipmentList"],
    }),
  }),
});
```

The `transformResponse` step unwraps the `{ status, data, meta }` envelope so your components see clean data. Build a small helper for it once — the same pattern works for every service in the platform.

For pages, follow Next.js 14 app router conventions already used in `frontend/src/app/shipments/`. Server components for shells, client components for anything that calls hooks.

## Local dev

From the repo root:

```bash
yarn run fresh:install      # one-time, installs everything and creates .env files
yarn run dev                # starts every service + frontend
yarn run dev:frontend       # frontend + gateway only (faster iteration)
```

Useful checks once it's up:

```bash
docker-compose ps                                    # everything green?
docker-compose logs -f shipment-service              # tail the service
curl http://localhost:3001/health | jq               # gateway health
curl http://localhost:3004/health | jq               # service health (direct)
yarn run prisma:studio                               # browse the DB
```

The frontend dev server runs at `http://localhost:3000` and talks to `http://localhost:3001` for the API. If the gateway is down, every shipment request will fail — check `docker-compose ps` first when something's broken.

## Where to look in the codebase

When you need to understand what an endpoint actually does, the trail is always: **routes → controller → service → Prisma**. For shipments:

- `backend/shipment-service/routes/shipments.js` — endpoint definitions with permission middleware
- `backend/shipment-service/controllers/` — request handling, validation, audit logging
- `backend/shipment-service/services/` — business logic (rate calc, partner selection, bulk processing)
- `backend/shipment-service/prisma/schema.prisma` — data model and enums
- `shared/lib/response.js` — `APIResponse` envelope
- `shared/lib/auth.js` — JWT and permission helpers
- `docs/API-Specifications.md` — request/response specs
- `docs/PRD_API_GATEWAY_RBAC.md` — current sprint context

On the frontend side, existing code lives in `frontend/src/app/shipments/`, `frontend/src/services/` (legacy service layer being phased out), and any new `frontend/src/api/*.js` RTK Query slices.

## Open work (where you can help)

Bulk operations are the active backend area and the frontend coverage trails it. If you're looking for a first task, the bulk import flow is wide open: a CSV upload form with template download, a job-status polling UI with a progress bar, a failed-rows error report (downloadable as CSV), and the bulk-label generation workflow. Each is a self-contained piece — pick one, ship it, iterate.

Beyond that, the broader Redux migration (`frontend/FRONTEND_ARCHITECTURE_TASK.md`) tracks the move from Zustand to RTK Query slice by slice. The shipment slice is a good candidate because the backend contract is stable.

## Who to ask

- **Shipment service backend & data model** — backend team, files under `backend/shipment-service/`
- **Gateway / auth / RBAC** — see `backend/auth-service/` (the reference standard for patterns) and `docs/RBAC-*.md`
- **Frontend architecture migration** — `frontend/FRONTEND_ARCHITECTURE_TASK.md` maintainers
- **Partner integrations / courier behavior** — partner-service team, `backend/partner-service/`

## Onboarding checklist

Before your first PR:

- [ ] Repo running locally — `yarn run dev` brings up the gateway, services, and frontend without errors
- [ ] Logged in via auth-service and successfully called `GET /api/v1/shipments` with curl
- [ ] Read `docs/API-Specifications.md` end-to-end for shipments
- [ ] Read `backend/auth-service/` route + controller pair to understand the reference pattern
- [ ] Read `frontend/FRONTEND_ARCHITECTURE_TASK.md` to understand the migration direction
- [ ] Found an RTK Query slice in `frontend/src/api/` (or written your first one)
- [ ] Picked a starter task — bulk import UI is the warm-water entry point
