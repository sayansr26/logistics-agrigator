# Active Context - Logistics Aggregator Portal

> Current work focus and priorities | Last Updated: July 31, 2026

## Current Sprint Focus

### 🔐 Auth Redirect Ping-Pong Fixed + Refresh-Token Flow Wired (P0 - Completed July 31, 2026)

**Symptom:** cold-opening the app and clicking "Get Started" landed on `/auth/login`, flashed the dashboard, then bounced back to login with "Your session has expired." Opening `/dashboard` directly did the same. Six compounding causes, all fixed:

1. **No refresh flow existed in the running code path.** `baseApi.ts` was a bare `fetchBaseQuery` — no `baseQueryWithReauth`, no retry, no single-flight. The `refreshToken` mutation in `authApi.ts` had **zero call sites**, and `store/auth-store.ts` (zustand `refreshAccessToken`) is dead code. Every 401 went straight to logout.
2. **The gateway blocked refresh anyway.** `api-gateway/middleware/authValidator.js` listed `/api/v1/auth/refresh-token` as public, but the real route is `/api/v1/auth/refresh`. `isPublicPath` uses `startsWith`, and `/api/v1/auth/refresh` does **not** start with `/api/v1/auth/refresh-token` — so refresh required a valid Bearer JWT and could never succeed once the access token expired. **One-line fix, but nothing else worked without it.**
3. **Hydration race.** `AuthHydration`'s effect dispatched `hydrate()` in the same commit as `ProtectedRoute`'s effect, which still read the stale `isAuthenticated: false` and pushed to login. Redux then re-rendered `true`, the dashboard rendered briefly (**the flash**), and the login page's `redirectIfAuthenticated()` pushed back — the ping-pong. There was no "still hydrating" state: `useAuth().isLoading` was only mutation-loading.
4. **`hydrate()` trusted localStorage without checking JWT `exp`** — a dead token yielded `isAuthenticated: true`.
5. **`errorMiddleware.handleAuthError` hard-navigated on _any_ 401** (`window.location.href`), including pre-hydration unauthenticated requests, while leaving `user` in localStorage and the `token`/`userRole` cookies set — so the edge middleware and Redux disagreed on the next load and the cycle repeated.
6. **Cookie lifetime (hardcoded 24h) far exceeded the access-token TTL**, so `src/middleware.ts` admitted requests the API would 401.

**New:** `frontend/src/lib/auth/token.ts` — `decodeJwt` / `getTokenExpiryMs` / `isTokenExpired(skew 30s)` / `setAuthCookies` / `clearAuthCookies` / `clearStoredAuth`. No new dependencies (`jwt-decode` and `async-mutex` are not installed — `exp` is decoded manually, single-flight is a module-level promise).

**Key decisions:**

- **Cookies now track the _refresh_ token's lifetime, not the access token's.** The edge middleware can't verify a JWT cheaply, so the cookie means "a session may exist"; the real decision happens client-side after hydration. A merely-expired access token no longer evicts the user at the edge.
- **`isHydrated` is the guard, not `isAuthenticated`.** Route guards must never act on the pre-hydration state — that IS the bug. `ProtectedRoute` renders a spinner until `isHydrated`, and `requireAuth`/`redirectIfAuthenticated` no-op until then. All guard redirects use `router.replace` so Back doesn't re-trigger the bounce.
- **Single writer for persistence.** `setCredentials`/`setTokens`/`logout` in `authSlice` own localStorage _and_ cookies; the `login` `transformResponse` no longer writes them. Two writers is exactly how cookie/localStorage state drifted apart.
- **401 is owned solely by `baseQueryWithReauth`.** `errorMiddleware` now returns early on 401 without a toast — a recoverable 401 must be invisible. Only a definitive refresh failure ends the session (one toast, one `window.location.replace` to `/auth/login?expired=1&redirect=…`), and `endSession` first checks a session actually existed so anonymous visitors never see "session expired".
- **Single-flight refresh is mandatory, not an optimization.** The backend rotates the refresh token on every refresh; concurrent dashboard queries would otherwise rotate it out from under each other and kill the session they were trying to save.

**Verified:** gateway restarts clean; `POST /api/v1/auth/refresh` with **no** Authorization header returns 200 with a rotated pair (was 401 `NO_TOKEN`); the new access token authorizes `GET /api/v1/zones` 200; invalid token → 401 `INVALID_REFRESH_TOKEN`; missing body → 400 validation (proving the request reaches auth-service); `/api/v1/auth/refresh-token` now 404s. Frontend `yarn build` compiles clean, 52/52 static pages; `/dashboard` without a cookie → 307 `/auth/login?redirect=%2Fdashboard`; container restarts with no compile errors.

⚠️ **Build gotcha:** running `yarn build` inside `logistics-frontend` fails at prerender with `TypeError: Cannot read properties of null (reading 'useContext')` on `/_not-found`. This is **not** a code defect — the container runs `NODE_ENV=development`, which makes Next mix the dev and prod React runtimes. Build with `docker exec -e NODE_ENV=production logistics-frontend yarn build`. Note `frontend/node_modules` does not exist on the host; all frontend builds/typechecks must run in the container.

**Backend quirk noticed, not fixed (out of scope):** refresh tokens are `jwt.sign({ userId }, secret, { expiresIn: "30d" })` — payload is only `{userId, iat, exp}`, so two signed in the same second are **byte-identical**. A rotated-out refresh token can therefore still validate. Harmless here (leniency, not lockout), but it means refresh tokens are not uniquely identifiable; add a `jti`/nonce if strict rotation-reuse detection is ever wanted. Access-token TTL in this env is 8h (`expiresIn: 28800`), not the 1h default.

**Login post-submit dead-time (same session, July 31, 2026):** after clicking Sign In the spinner stopped, the filled form reappeared with a live "Sign In" button for several seconds, then the redirect finally happened — reading as if the login had silently failed. Root cause: the button's busy state was bound to the RTK Query mutation, which settles _long before_ `router.replace` finishes loading the destination route.

Fixed in two layers, because the button state alone was not enough:

1. `isRedirecting` local state held from a successful login until navigation completes (`isSubmitting = isLoggingIn || isRedirecting`).
2. **The form is no longer rendered at all once we're leaving.** `isLeaving = isRedirecting || (isHydrated && isAuthenticated)` short-circuits the whole page to a standalone "Signing you in…" screen. Deriving it from `isAuthenticated` — not just local state — also covers a remount, where local state resets but the browser re-autofills the fields (which is what made it look like the form had "come back"). The same screen shows while `!isHydrated`, so an already-signed-in visitor never sees the form flash.

Middleware was ruled out as the cause first: `/dashboard` with a valid `token` cookie returns 200 for both a normal and an `RSC: 1` request, so there is no server-side bounce back to login.

⚠️ **The multi-second wait itself is mostly a dev-server artifact** — Next compiles `/dashboard` on demand (~2.4s in logs) and `router.prefetch` is a no-op in dev. Production builds will be substantially faster; the fix makes the wait _legible_ rather than eliminating it.

**General rule (now Rule 6 in systemPatterns):** never bind a submit button's busy state to the mutation alone when a navigation follows it, and don't leave the submitted form interactive while that navigation is in flight.

**Not changed by decision:** token storage stays in localStorage (user chose this over an httpOnly-cookie migration, which would require auth-service to set/clear cookies, the gateway to read them, and rewriting every frontend token read). `store/auth-store.ts` and `services/api/auth-api.ts` remain dead code. Only `/dashboard` uses `ProtectedRoute`; other protected pages rely on the edge middleware plus the new reauth layer.

### 📦 Bulk Shipment Upload + NDR: mock data replaced with live APIs (P0 - Completed July 25, 2026)

`/shipments/bulk` and `/shipments/ndr` rendered entirely from `frontend/src/lib/mock-data.ts` (hardcoded stat cards `24/18/6/2`, `setTimeout` fake upload, dead buttons). Both now run on real endpoints. Both pages converted `.jsx` → `.tsx`; the four mock exports (`mockNDRs`, `mockBulkUploads`, `getNDRStatusColor`, `getBulkUploadStatusColor`) and their interfaces were deleted from `mock-data.ts`.

**Bulk upload was non-functional and had to be built, not just wired.** Five blocking defects found and fixed:

1. `routes/shipments.js` required permission `shipment:bulk_create:assigned`, but `bulk_create` is **not** in `PERMISSION_ACTIONS` (`shared/constants/permissions.js`) — it appeared exactly once in the whole repo, so `checkPermission` returned false and every non-superadmin got 403. Now `shipment:create:assigned`.
2. Joi `processBulkShipmentsSchema` required a `file` field while the controller read `req.body.bulkData` — no request could satisfy both. Schema now validates `bulkData` (array, 1..1000).
3. **No multer/xlsx anywhere** — the CSV/Excel half of the feature was never built. Added `multer` + `xlsx`, `middleware/upload.js` (memory storage, 10MB, extension allowlist), and `services/bulkFileParserService.js`.
4. `BulkJob` (Prisma) was dead code — job state lived only in Redis (24h TTL, non-UUID ids), so upload history had **no data source**. `updateJobStatus`/`updateJobProgress` now mirror to Postgres via `persistJobStatus` (UUID job ids only); Redis still backs live progress.
5. `bulkProcessingService` called `partnerIntegrationService.selectOptimalPartner` (**does not exist**; real name `selectOptimalCourier`), with wrong param names (`pickupPincode`/`deliveryPincode` vs `fromPincode`/`toPincode`), wrong return destructuring (`{selectedPartner, charges}` vs `{selectedCourier}`), a mis-ordered `processShipmentPayment` call (description landed in the `shipmentId` slot), and no auth token — so downstream calls 401'd. All corrected; `authToken` now threaded from the controller through both methods.

**NDR's `GET /api/v1/shipments/ndr` was unreachable** — registered _after_ `GET /:id`, so Express matched `"ndr"` as a shipment UUID and returned a Prisma UUID-parse 500. Moved above `/:id` (comment added). Then exposed a second bug: `ndrService.getNDRCases` `include`d `createdBy`/`assignedTo`, which are **not relations** on `NDRCase` (plain UUID columns; users live in another service's DB) — this crashed the process. Removed.

**New endpoints:** `POST /bulk/upload` (multipart, rate-limited via the previously-unused `bulkOperationsLimiter`), `GET /bulk/jobs` (paginated + `summary` aggregate driving the stat cards), `GET /bulk/jobs/:jobId`, `GET /bulk/template` (generated from the parser's own column list so template and parser can't drift).

**Response shapes the frontend depends on:** NDR returns `data.ndrCases` + `data.pagination.pages` (not `ndrs`/`totalPages`), and summary is `statusDistribution: [{status, count}]` (**not** `statusCounts`). NDR page shows the real 8-value `NDRStatus` enum via `lib/utils/shipment-status.ts`.

**Gotcha:** `baseApi.ts` unconditionally set `Content-Type: application/json`, which corrupts multipart boundaries. Upload endpoints now send an `x-multipart: true` marker that `prepareHeaders` consumes to drop the header.

**Untouched by decision:** the unlinked `/app/ndr` page, `store/ndrStore.ts`, `hooks/useNDR.ts`, `components/ndr/*` — their service layer targets `/ndr/stats`, `/ndr/reasons`, `PUT /ndr/:id/status`, none of which exist on the backend.

**Verified:** shipment-service restarts clean (0 MODULE_NOT_FOUND), `GET /ndr` 200, bulk permission returns 400 not 403, multipart upload parses + maps flat CSV → nested shape + normalizes phones to `+91-XXXXXXXXXX`, `bulk_jobs` rows persist with counts/timings, `.txt` and missing-file rejected 400, unauth 401, frontend `yarn build` exit 0.

⚠️ **Blocked on data, not code:** shipments still cannot be created in this dev environment — no courier rate cards are configured, so `calculate-rates` returns `rates: []` and bulk rows fail with "No serviceable partners found for the given route". The _same_ failure occurs on the normal single-shipment path. Seed partner rates to see successful bulk creation.

**Known pre-existing issue (not fixed, out of scope):** ~40 handlers in `shipmentController.js` `throw` from async handlers instead of calling `next(error)`; with Express 4 and no `express-async-errors`, these become unhandled rejections that crash/hang rather than reaching `errorHandler`. Only the handlers touched here were converted.

### 🚚 Rule-Based Multi-Channel Routing + Delhivery B2B (P0 - Completed July 24, 2026)

A partner (e.g. Delhivery) can now have multiple routing channels, each with rules — business type (B2B/B2C/BOTH), weight slab, order-amount range, payment modes, priority — linked to a reusable credential account. Booking and quotes select the matching channel per shipment; no match → partner excluded from quotes / 422 at booking; partners with zero channels keep legacy behavior. Delhivery B2B (LTL) is a new `DELHIVERY_B2B` aggregator with its own JWT credential model and async manifest adapter (LR number = AWB). Unified Channels UI at `/partners/[id]/channels` (Routing Channels + Credential Accounts tabs).

**Key files:** `carrierAccountService.js` (selectChannel/resolveChannelCredentials), `courierOperationService.js` (_resolveBookingChannel), `quoteCalculationService.js` (channel gate), `adapters/DelhiveryB2BAdapter.js`, `serviceChannelApi.ts`, `service-channels-panel.tsx`.

**Follow-ups:** Delhivery B2B UAT with staging creds (serviceability response schema is portal-gated; cancellation is portal-manual); invoice/e-waybill edit endpoint not wired; booking auto-fallback to next-priority channel; channel-scoped pricing.

**Planned next (scoped July 24, 2026, CORRECTED same day): B2B Registered Pickup Warehouse Mapping.** Delhivery B2B has no warehouse-creation API — `pickup_location` must exactly match a warehouse pre-registered in Delhivery One (B2C auto-creates warehouses at booking; B2B cannot).

⚠️ **Design correction (user):** pickup location is SHIPPER-level, not partner-level. Outlets choose their own pickup/warehouse address during shipment creation (existing journey — unchanged), and the B2B channel config is shared platform-wide, so a warehouse list on the channel was wrong. ✅ **DONE (July 24, 2026):** `pickupLocationName` fully REMOVED from the DELHIVERY_B2B credential Joi schema, the frontend credential form (replaced with a hint that pickup is per-shipment), the `DelhiveryB2BConfig` type, and the adapter (which now takes pickup ONLY from the shipment and throws `DELHIVERY_B2B_PICKUP_MISSING` when absent). Verified: backend modules load + frontend build clean.

Corrected approach — mapping lives on the pickup address, not the channel:

- Pickup/outlet address records get an optional per-B2B-courier "registered warehouse name" mapping (exact Delhivery One string), set during outlet onboarding after ops registers the warehouse with Delhivery.
- Booking: shipment routed to a B2B channel sends the chosen address's registered name; address without a mapping → clear error / channel excluded ("pickup location not registered with Delhivery B2B").
- Shipment-creation UX unchanged (no new dropdown); optionally a "B2B-ready" indicator on addresses that have a mapping.
- Non-code prerequisite: outlet warehouses registered in Delhivery One + multi-pickup enabled by the account manager — onboarding checklist item.
- Re-estimate when picked up (address-model touch spans the address storage used by outlets; scope depends on where saved pickup addresses live).

**MCP-docs finding (July 24, 2026):** Delhivery's warehouse-management APIs (`POST /api/backend/clientwarehouse/create/` + `/edit/`) are B2C-Express-only (delhivery-mcp doc set has ZERO B2B/LTL content) — and our B2C `DelhiveryAdapter` already auto-creates warehouses with them, so B2C needs no warehouse config anywhere. **Decisive UAT test before building the B2B mapping:** register a warehouse via the B2C API, then attempt a B2B manifest with the same `pickup_location` name. If Delhivery One shares the warehouse registry across B2C/B2B accounts → this whole feature is unnecessary (reuse auto-creation); if not → the per-address mapping plan applies.

### 🏪 Outlet Module Implementation (P0 - Completed)

The Outlet/Customer Portal module has been successfully implemented, allowing clients to manage their outlet users who can log in and manage their own shipments and addresses.

**Completed Features:**

- ✅ Outlet CRUD operations (create, read, update, delete)
- ✅ Outlet address management with geo-autocomplete
- ✅ New `outlet` role in RBAC system
- ✅ Password generation and reset functionality
- ✅ Activate/Deactivate outlet status
- ✅ Frontend management UI with modals
- ✅ RTK Query integration
- ✅ **Outlet Badge System** (February 17, 2026)
  - 6-tier badges: Basic (default), Bronze, Silver, Gold, Platinum, Diamond
  - PATCH /outlets/:id/badge with audit logging
  - Badge filter on list endpoint
  - Frontend: color-coded badge column, change badge dialog, badge in edit form
  - Fixed: unhandled rejection crash in all 13 outletController catch blocks
  - Fixed: auth 409 error passthrough for duplicate emails

### 🔒 API Gateway Security & 11-Role RBAC Implementation (P0 - Critical)

**Reference Document**: `docs/PRD_API_GATEWAY_RBAC.md`

The primary focus is implementing a robust security layer and role-based access control system across all services.

### Sprint Phases

| Phase   | Description                       | Status         |
| ------- | --------------------------------- | -------------- |
| Phase 1 | Service isolation via API Gateway | ✅ Complete    |
| Phase 2 | Granular permission system        | ✅ Complete    |
| Phase 3 | Frontend Redux/RTK migration      | 🔄 In Progress |
| Phase 4 | 100% Swagger documentation        | 📋 Planned     |

## Service Status Overview

| Service              | Port | Status        | Completion | Current Focus                                      |
| -------------------- | ---- | ------------- | ---------- | -------------------------------------------------- |
| **API Gateway**      | 3001 | ✅ Complete   | 95%        | Webhook path exemption added                       |
| **Auth Service**     | 3002 | ✅ Production | 100%       | Reference standard                                 |
| **User Service**     | 3003 | ✅ Production | 100%       | Internal outlet badge API                          |
| **Shipment Service** | 3004 | 🔄 Active     | 95%        | Quotes cache + assign-partner pipeline + rerate    |
| **Partner Service**  | 3005 | 🔄 Active     | 100%       | Zone coverage DISTANCE fallback + quote engine     |
| **Wallet Service**   | 3006 | ✅ Complete   | 100%       | Shipment wallet integration fixed                  |
| **License Service**  | 3009 | 🆕 New        | 30%        | Integration pending                                |
| **Support Service**  | 3007 | ❌ Pending    | 0%         | Not started                                        |
| **Platform Service** | 3008 | ❌ Pending    | 0%         | Shopify next                                       |
| **Frontend**         | 3000 | ✅ Production | 88%        | Shipment revalue UI + COD display + weight dispute |

## Immediate Priorities

### P0 - Critical (This Week)

1. **✅ Outlet Module - COMPLETED**
   - Backend: routes, controller, schema
   - Frontend: management page with modals
   - RBAC: new outlet role with permissions

2. **License Service Integration**
   - Connect license validation to auth flow
   - Implement tenant isolation
   - Add license limit enforcement

### P1 - High Priority (Next Week)

1. **Shipment Bulk Operations**
   - CSV upload and parsing
   - Bulk AWB generation
   - Error handling and reporting

2. **~~Outlet Portal Pages~~** ✅ DONE (February 21, 2026)
   - ✅ Outlet-specific dashboard with quick actions
   - ✅ Sidebar shows Shipments and My Addresses for outlet role
   - ✅ Permissions hydrated from login response into Redux

### P2 - Medium Priority (Following Weeks)

1. **Support Service Development**
   - Ticket creation and management
   - Assignment and escalation
   - Resolution tracking

2. **Platform Service - Shopify Integration**
   - OAuth2 authentication
   - Order sync
   - Webhook handling

## Active Decisions

### Architecture Decisions

1. **Database per Service**: Maintaining strict service isolation
2. **Shared Library**: Common utilities in `/shared/` directory
3. **Controller Pattern**: No inline route handlers
4. **UUID for IDs**: All models use `@db.Uuid`

### Outlet Module Decisions

1. **Optional clientId**: Outlets can be standalone or linked to clients
2. **Globally unique email/phone**: Across all outlets
3. **Address types**: HOME, WORK, OTHER (not PICKUP/RETURN)
4. **Single default address**: Instead of separate pickup/return defaults
5. **Geo-autocomplete**: Pincode lookup auto-fills city and state
6. **Badge tiers**: Basic (default), Bronze, Silver, Gold, Platinum, Diamond

### Technical Decisions

1. **Prisma ORM Only**: No raw SQL queries
2. **Redis for Caching**: 5-minute TTL for permissions
3. **JWT + Redis Sessions**: Scalable auth pattern
4. **HMAC for External APIs**: Partner and Wallet service auth
5. **Canonical pincode search endpoint**: Use `GET /api/v1/geography/pincodes/search` for all search/autocomplete flows
6. **Quotes & Redis (April 2026)**: Partner zone-coverage cache stores **only** positive serviceability (`serviceable:v2` keys). Shipment-service partner rate cache **never stores empty `rates` arrays**; cached empties are deleted on read so partner fixes take effect without waiting for TTL
7. **Deprecated endpoint window**: `GET /api/v1/pincodes/search` remains temporary with deprecation headers and sunset date `2026-06-30T00:00:00.000Z`
8. **External wallet uses phone as user ID**: The external wallet API (`wapi.websiteduniya.com`) identifies users by phone number, NOT by auth UUID. All inter-service wallet calls must use outlet phone.
9. **Inter-service auth**: Services calling other services over Docker network must include `X-Internal-Request` header with `INTERNAL_SECRET` to bypass direct-access guards
10. **Redis v4 API**: All Redis calls must use `setEx()` (camelCase) not `setex()` (lowercase) — Redis v4+ breaking change
11. **Delhivery cancel payload**: `cancellation` must be string `"true"` (NOT boolean `true`) — Delhivery silently ignores boolean
12. **Terminal status protection**: Never downgrade `CANCELLED`/`DELIVERED`/`RTO` to a lower status on provider refresh
13. **Provider capability contract**: All courier adapters must implement `getCapabilities()` and `getAvailableActions(shipmentContext)` for dynamic UI
14. **Webhook ingestion is public**: `/api/v1/shipments/webhook/:provider` is exempt from JWT auth in API Gateway
15. **Semantic type normalization**: `PincodeType` and `ChargesType` names are normalized to canonical uppercase via `typeNameNormalizer.js` — `COD`, `cod`, `Cod` all treated as `COD`
16. **skipServiceabilityCheck for rerate**: Existing shipments bypass pincode assignment and zone coverage validation during re-rate — only weight/dimension-based charge recalculation applies
17. **quoteSnapshot updated on rerate**: When a shipment is re-rated, the `quoteSnapshot.chargeBreakdown` is overwritten with the new charges so the frontend Charges Summary is always current
18. **COD rerate options**: For COD shipments with extra charges after rerate, admin can choose `DEDUCT_WALLET` (debit from wallet) or `UPDATE_COD` (increase COD amount to collect from customer)
19. **Case-sensitive filenames in git**: Always match filename case exactly with import paths — macOS hides mismatches but Linux production builds fail

## Current Blockers

1. **None currently identified**

## Recent Changes

### April 8, 2026

- ✅ **Partner Pincode Autocomplete Stabilization — FRONTEND FIX**
  - **Root cause fixed**: Removed duplicate RTK Query endpoint injection for `searchPincodes` from `partnerPincodesApi.ts`; the canonical geography search endpoint now exists only once in `geoApi.ts`
  - **Partner assign dialog hardened**: `partners/[id]/pincodes` now uses the canonical lazy geography search hook and normalizes results locally to `{ id, code }`
  - **Deterministic search state**: Dialog clears stale search state when query length drops below 4, resets state on close, and only renders results and empty-state messaging for the active query
  - **Partner pincode page contract cleanup**: `getPartnerPincodes` frontend query now unwraps the standard `{ status, data, meta }` envelope correctly, matching the backend response shape
  - **Verification**: `builtin cd frontend && yarn run build` passed and the local frontend container was restarted after the build
  - **Known note**: `yarn run type-check` still fails on unrelated pre-existing frontend TypeScript issues, so it was not used as the acceptance gate for this bug fix

- ✅ **Assign Partner / Shipment quotes — BACKEND + FRONTEND**
  - **Root cause (empty quotes with valid assignment)**: Zone coverage only honored `zone_pincodes` rows; partners using **DISTANCE** zones + milestones without per-pincode zone rows failed coverage → no rates. **Fix**: `zoneCoverageValidationService` treats pincode as covered when an active DISTANCE zone has milestones (geo match still preferred).
  - **Root cause (sticky empties)**: Redis cached `serviceable: false` for an hour and shipment-service cached **empty** `rates` for 5 minutes — blocked recovery after config fixes. **Fix**: cache only **true** serviceability (`serviceable:v2`); on rate cache **read**, drop entries with `rates.length === 0`; on **write**, do not cache empty rate lists.
  - **`getShipmentQuotes`**: Removed redundant second serviceability pass; **`calculateRates`** is the single filter for quote rows.
  - **`quoteCalculationService`**: Still runs non-distance charge rules when distance zone does not match; rejects only when distance is required and unmatched **and** no priced breakdown (see code).
  - **Frontend** (`shipments/[id]/page.tsx`): Coerces numeric fields sent to `POST /shipments/quotes` (`declaredValue`, `codAmount`, weight/dims) so Joi does not fail on string/Decimal shapes; Assign Partner dialog shows validation errors via `parseRTKError` / `formatValidationErrors`, with distinct copy for empty quotes vs load failure.
  - **Verification**: `POST /api/v1/shipments/quotes` through API Gateway (`:3001`) with a fresh JWT after **restarting partner-service and shipment-service**.

### March 28, 2026

- ✅ **Shipment Revalue Charges Feature — COMPLETE**
  - **Admin/Superadmin-only re-rate**: New "Revalue Charges" button on shipment detail page for `CREATED`, `BOOKED`, `PICKED_UP`, `IN_TRANSIT` statuses
  - **Full re-rate flow**: Updated weight/dimensions → partner service recalculates charges → wallet debit/refund for prepaid, COD amount update or wallet debit choice for COD
  - **`skipServiceabilityCheck` flag**: Re-rate bypasses pincode assignment and zone coverage checks (existing shipments assumed valid)
  - **quoteSnapshot updated on rerate**: Charges breakdown in `quoteSnapshot.chargeBreakdown` is now updated with fresh breakdown from rerate, so the Charges Summary reflects current charges
  - **Cancel order refund**: Added wallet refund logic for PREPAID shipment cancellations
  - **Frontend display fixes**: Weight card shows `disputedWeight` (with original below), Value card shows actual `value` or "—", COD Amount card replaces Courier card for COD shipments
  - **Tracking event fix**: Re-rate creates tracking event with `shipment.status` (current status) instead of non-existent `RERATE_RESOLVED` status, with details in message/metadata

- ✅ **Partner Eligibility & Charges Engine Fixes — CRITICAL**
  - **Strict partner eligibility**: Partners only appear in quotes when BOTH pickup and delivery pincodes have active `PartnerPincodeAssign` records AND active zone coverage
  - **Semantic type normalization**: New `typeNameNormalizer.js` utility — `COD`/`cod`/`Cod` treated as same canonical type. Applied during creation/update (duplicate detection) and at runtime (charge rule matching)
  - **Conditional charge gating**: `shouldIncludeRule()` function gates charges by context — COD charges only for COD shipments, FRAGILE charges only for fragile items, INSURANCE based on `INVOICE_VALUE` rules
  - **`paymentType` in charge context**: `chargesRuleCalculationService` now receives and uses `paymentType` for conditional charge evaluation

- ✅ **Delhivery Channel Cleanup — COMPLETE**
  - **Removed env variable fallbacks**: `DelhiveryAdapter` no longer falls back to `DELHIVERY_CLIENT_NAME` or `DELHIVERY_API_URL` — strictly uses channel config
  - **Removed `sellerGstTin`**: Not needed for Delhivery channels; removed from frontend, backend Joi validation, and adapter
  - **`clientName` kept and used**: Properly passed from channel config to Delhivery API headers

- ✅ **Charges Management Rate Limit Fix**
  - **Frontend**: Added `isSubmitting` guard, sequential `for...of` loop for batch operations, debounced search, reset pagination on filter change
  - **Backend**: Increased `chargesManagementLimiter` limits, added separate `chargesReadLimiter`

- ✅ **Production Build Fix**
  - **Case-sensitivity**: Renamed `Skeleton.tsx` to `skeleton.tsx` in git to match import paths — macOS case-insensitive FS hid the mismatch, Linux production build failed with `Module not found`

### March 24, 2026

- ✅ **Shipment Lifecycle Expansion — COMPLETE**
  - **Dynamic Provider Capability Contract**: `BaseCourierAdapter` extended with `getCapabilities()` and `getAvailableActions(shipmentContext)`. DelhiveryAdapter and BlueDartAdapter declare capabilities explicitly (track, label, cancel, pickup, manifest, edit, ndr, ewaybill, pod, refresh, webhook).
  - **Schema Expansion**: Shipment model gained `providerStatus`, `providerLastSyncAt`, `providerRawResponse`, `courierLabelUrl`, `courierLabelFormat`, `courierLabelFetchedAt`, `pickupRequestId`, `pickupRequestedAt`, `pickupConfirmedAt`. New `ShipmentDocument` model for labels/POD/invoices. Partner `PartnerShipment` model gained matching provider sync fields.
  - **New Shipment Endpoints**: `POST /:id/refresh` (sync from provider), `POST /:id/courier-label` (fetch label), `POST /:id/cancel-with-provider` (provider-first cancel), `GET /:id/documents`. `getShipmentById` now returns `providerCapabilities` + `documents`.
  - **Global Webhook Ingestion**: Public `POST /api/v1/shipments/webhook/:provider` endpoint. AWB extraction per provider, event normalization, status/tracking updates. API Gateway auth exemption for webhook path.
  - **Dynamic Frontend UI**: Quick Actions now rendered from `availableActions` array. Documents section, Provider Info card. 4 new RTK Query endpoints + 6 TypeScript interfaces.

- ✅ **Delhivery Integration Fixes — CRITICAL**
  - **Cancel API Fix**: `cancellation` must be string `"true"`, NOT boolean `true` — Delhivery's #1 documented API quirk. Boolean was silently ignored.
  - **Cancel Response Validation**: Now checks `response.status === true` and handles `"Order already cancelled"` idempotently. Throws `PROVIDER_CANCEL_REJECTED` on actual failure.
  - **Tracking Status Normalization Fix**: Delhivery reports cancelled shipments with `Status: "Manifested"` but `Instructions: "Seller cancelled the order"` and `StatusCode: "DTUP-210"`. `normalizeStatus()` now checks Instructions + StatusCode fields to detect cancellation.
  - **Terminal Status Protection**: `refreshFromProvider` will never downgrade `CANCELLED`/`DELIVERED`/`RTO` to a lower status like `BOOKED`.
  - **Delhivery Channel Validation**: Enforced `clientName` and `sellerGstTin` for DELHIVERY channels in Joi schemas. Enforced `licenseKey`, `loginId`, `customerCode` for BLUEDART.
  - **Payload Corrections**: `payment_mode: "Prepaid"` (was wrong), `products_desc` (was `product_desc`), `String()` casts for pincode fields, removed `registered_name` from warehouse creation.
  - **Redis v4 Fix**: `setex()` → `setEx()` in `BaseCourierAdapter.setCachedResponse()`

### March 17, 2026

- ✅ **End-to-End Shipment Creation Flow — COMPLETE**
  - **Multi-step creation wizard**: Docket → Dimensions → Delivery → Invoice → Review & Book
  - **B2B/B2C support**: Single box for B2C, multiple boxes + invoices for B2B
  - **Outlet context**: Admin/Superadmin select outlet for shipment; outlet users create directly
  - **Quote engine integration**: Live partner quotes with charge breakdown and discount display
  - **Fragile item handling**: Optional fragile checkbox on docket page; fragile charges conditionally applied
  - **Badge-based discounts**: GOLD/PLATINUM/DIAMOND outlets see discounts applied to quotes
  - **Wallet payment**: Automatic debit from outlet wallet on PREPAID shipments
  - **Shipment detail page**: Shows charge breakdown + discount from stored `quoteSnapshot`

- ✅ **Wallet Payment Integration for Shipments — CRITICAL FIX**
  - **Problem 1 (Direct access blocked)**: `paymentProcessingService` called wallet service directly but lacked `X-Internal-Request` header → 403 "Direct access attempt blocked"
  - **Fix**: Added `X-Internal-Request: process.env.INTERNAL_SECRET` header to axios client
  - **Problem 2 (Wrong wallet userId)**: System used outlet's auth UUID as wallet userId, but external wallet API uses **phone number** as user identifier
  - **Fix**: Rewrote `paymentProcessingService` to call wallet admin endpoints (`/admin/wallet`, `/admin/debit`, `/admin/refund`) which use `clientCode + phone` to interact with external wallet API (`wapi.websiteduniya.com`)
  - **Problem 3 (Admin creating for outlet)**: `resolveOutletContext` needed outlet phone for wallet, not UUID
  - **Fix**: Frontend stores `outlet.phone` as `outletUserId` when admin selects outlet; outlet role uses `req.user.phone` from JWT
  - **Problem 4 (Redis v4 compatibility)**: `redis.setex()` → `redis.setEx()` in wallet-service and shipment-service
  - Key files: `paymentProcessingService.js`, `shipmentController.js` (`resolveOutletContext`), `walletService.js`, `externalWalletClient.js`, `trackingService.js`

- ✅ **Quote Charge Calculation Fixes**
  - Fixed quotes returning 0 — zone system v2 with distance milestones now working
  - Fixed charges only showing flat 100 — charge rule engine properly evaluates all rule categories
  - Fixed fragile charge applied unconditionally — now filtered based on `isFragile` flag
  - Fixed badge-based discounts not applied for admin-created shipments — added `outletId` resolution via new internal endpoint `GET /api/v1/internal/outlets/:outletId/badge`
  - Fixed discount data dropped from API responses — explicitly forwarded through partner and shipment controllers
  - Added `outletId` and `isFragile` to rate calculation cache keys for cache correctness

- ✅ **Shipment Form Store & Frontend**
  - `shipment-form-store.ts`: Added `outletUserId`, `isFragile` fields
  - `docket/page.tsx`: Outlet selection stores phone as `outletUserId`; fragile checkbox added
  - `review/page.tsx`: Sends `outletUserId`, `isFragile`, `outletId` in quote and creation payloads; displays discount info
  - `shipmentApi.ts`: Updated `CreateShipmentRequest` and `PartnerQuote` interfaces
  - `shipments/[id]/page.tsx`: Enhanced Charges Summary with invoice-style breakdown, discount display, "You saved" line

### March 7, 2026

- ✅ **Partner Channel System Cleanup & Polish**
  - **Database extensibility**: Converted `AggregatorType` from Prisma enum to `String @db.VarChar(50)` — adding new aggregators no longer requires DB reset
  - **Channel mode auto-sync**: `channelMode` now auto-computes (1 channel=SINGLE, 2+=MULTI) via `_syncChannelMode()` in `partnerChannelService.js`. Removed manual `switchChannelMode` endpoint/UI
  - **Aggregator type required**: Only DELHIVERY and BLUEDART options in UI; backend validates with `ALLOWED_AGGREGATOR_TYPES`; removed NONE/CUSTOM
  - **Partner detail page polish**: Removed legacy "API Config" tab, channel mode badge, API endpoint/version/token fields. Replaced with "Channels" tab. Single Edit button + one `⋮` dropdown with grouped actions (Manage/Status/Danger). Removed back button (breadcrumbs handle navigation)
  - **Manage Channels page polish**: Removed back button, hover-reveal `⋮` dropdown for Edit/Delete on channel cards, credential status with color-coded Key icon
  - **RTK Query fix (too many requests)**: Removed redundant `refetch()` calls from partner detail page — RTK Query tag invalidation handles auto-refetch. Fixed `updateChannel`/`deleteChannel` to pass `partnerId` for proper tag invalidation
  - **Dead page cleanup**: Deleted `partners/add/page.tsx` and `partners/[id]/edit/page.tsx`. Updated dashboard links and route permissions
  - **Shared component fix**: Made `backHref` optional in `DetailHeader` component (wraps `<Link>` in conditional)
  - Key files: `schema.prisma`, `partnerChannelService.js`, `partnerChannelSchemas.js`, `partnerSchema.js`, `partnerChannelController.js`, `partnerChannels.js` (routes), `partnerChannelApi.ts`, `partnersApi.ts`, `baseApi.ts`, `partners/[id]/page.tsx`, `partners/[id]/channels/page.tsx`, `detail-page.tsx`, `routePermissions.ts`, `dashboard/page.jsx`

### February 21, 2026

- ✅ **Outlet Wallet Page**
  - Outlet users can now access `/wallet` to view their balance, stats, and transaction history
  - Backend: 3 new `/my/*` endpoints in wallet-service using `req.user.phone` as wallet user ID
  - Backend fixes: shared Redis init, Redis v4 `setEx`, JWT permission fallback, phone in JWT payload
  - Frontend: `OutletWalletView` — gradient balance card, stat cards (topups/debits/refunds), 30-day summary bar, paginated transaction table
  - Role-based routing with loading guard prevents admin API leaks for outlet users
  - Key files: `outletWalletController.js`, `externalWalletClient.js`, `wallet/page.jsx`, `walletApi.ts`, `shared/lib/auth.js`, `shared/constants/permissions.js`

- ✅ **Outlet User Login & Dashboard Fix**
  - **Problem**: Outlet users logged in successfully but saw the admin dashboard, which called APIs (`/partners`, `/zones`, `/charges-types`) they don't have permission for — causing 403 errors. Sidebar only showed "Dashboard" — missing "Shipments" and "My Addresses".
  - **Root Cause 1 (Dashboard)**: Single dashboard page called admin-only API hooks regardless of role
  - **Root Cause 2 (Sidebar)**: Permissions from login response were never stored in Redux — `usePermission` hook found empty permissions → `canAccessResource()` returned false → sidebar items hidden
  - **Fixes Applied**:
    - `frontend/src/app/dashboard/page.jsx` — Split into `AdminDashboard` (partners/zones/charges) and `OutletDashboard` (create shipment, my shipments, my addresses). Renders based on `user.role === "outlet"`.
    - `frontend/src/hooks/useAuth.ts` — Added `dispatch(setPermissions(response.data.user.permissions))` after login
    - `frontend/src/components/AuthHydration.tsx` — Added permissions hydration from localStorage on page reload
    - `frontend/src/store/slices/authSlice.ts` — Added `permissions?: string[]` to User interface
    - `frontend/src/hooks/useRole.ts` — Added missing `outlet` role to `SystemRole` enum, `ROLE_HIERARCHY` (level 40), `ROLE_GROUPS`, display names, badge colors
    - `frontend/src/hooks/useAuth.ts` — Added `outlet` to `canAccess` map for dashboard, shipments, addresses

- ✅ **Wallet Module Overhaul — Stateless External Proxy Architecture**
  - **Backend (wallet-service):**
    - Wallet service now operates in **stateless mode** — no local database; all data proxied from external wallet API (`wapi.websiteduniya.com`)
    - New `adminWalletController.js` with 8 admin endpoints: list wallets, list transactions, get/create wallet, topup, debit, refund, update user status, sync wallets
    - `externalWalletClient.js` — HMAC SHA-256 authenticated HTTP client with circuit breaker, Redis caching, request/response interceptors
    - **Critical Route Fix**: Moved all `/admin/*` routes before `/:userId/*` wildcard routes in `routes/wallet.js` — Express was matching `admin` as a userId parameter, causing UUID validation errors
    - `walletSchema.js` — Added admin proxy schemas: `adminWalletTransactionSchema` (with `transaction_id` for refunds, `remarks` as object), `adminClientWalletsQuerySchema`, `adminClientTransactionsQuerySchema`, etc.
    - Batch wallet sync endpoint — processes in batches of 3 with 500ms delays to avoid overwhelming external API
  - **Frontend:**
    - Complete wallet management page rewrite (`frontend/src/app/wallet/page.jsx`)
    - RTK Query `walletApi.ts` with 8 endpoints (list wallets, list transactions, get/create wallet, topup, debit, refund, update status, sync)
    - Wallet & Transaction tabs with stats cards, filters, pagination
    - Transaction modals: Topup, Debit, Refund (only shows DEBIT transactions for refund selection), Update Status
    - Create Wallet & Sync Wallets modals with outlet selection
    - Key-value remarks builder component
    - Polished header: grouped utility/transaction buttons with visual hierarchy, divider separator
    - Transaction type badges with icons (TrendingUp/TrendingDown/RotateCcw) and opacity-based dark-mode colors
    - Fixed metadata field to send as plain string (external API expects string, not JSON object)
    - Fixed: external wallet API has max 10,000 per transaction — added frontend validation
    - Fixed: `externalWalletClient.js` now extracts `validation_errors` array from external API 400 responses and surfaces actual error messages (e.g., "Amount cannot exceed 10000.00") instead of generic "Invalid request parameters"
    - Fixed: `walletSchema.js` metadata accepts both string and object via `Joi.alternatives()`
    - Sidebar wallet link added
  - **Docker**: Updated `docker-compose.yml`, `docker-compose.backend.yml`, `docker-compose.production.yml` for wallet-service config

### February 17, 2026

- ✅ **Charge Discount Packages** — Badge-based discount packages per Partner + Outlet tier
  - Backend: `ChargeDiscountPackage` + `ChargeDiscountPackageItem` models in partner-service
  - Backend: `outletContextService.js` resolves outlet badge via user-service internal endpoint (Redis-cached)
  - Backend: Quote engine applies FLAT/PERCENTAGE discounts per charge rule, skips cache for badge users
  - User-service: `GET /api/v1/internal/outlets/by-user/:userId` endpoint
  - API Gateway: proxy for `/api/v1/charge-discount-packages`
  - Frontend: `/charge-discount-packages` CRUD page with charge rule info display
  - Valid badge tiers for discounts: Bronze, Silver, Gold, Platinum, Diamond (not Basic)

- ✅ **Outlet Badge System** — 6-tier badge system (Basic→Diamond) for outlets
  - Prisma: `OutletBadge` enum + `badge` field on Outlet model with migration
  - Backend: PATCH /outlets/:id/badge endpoint + badge filter on list
  - Frontend: badge column, change badge dialog, badge in edit form
  - Auth-service: migration to add missing `outlet` value to Role enum
  - **Critical Bug Fix**: All 13 catch blocks in outletController.js replaced `throw error` with proper `res.status().json()` responses — unhandled rejections were crashing nodemon
  - **Bug Fix**: Auth 409 errors now pass through actual message instead of generic "Failed to create outlet user"

- ✅ **Charges Zones Query Fix** — partnerId was rejected by Joi validation in GET /api/v1/zones
  - Root cause: Frontend charges page passed `partnerId` as query param but backend `listZones` schema didn't allow it
  - Backend fix: Added `partnerId`, `sortBy`, `sortOrder` to `zoneSchemas.js` listZones validation
  - Backend fix: Updated `zoneController.js` to use query `partnerId` for admin/superadmin (non-admin still uses auth context)
  - Frontend fix: Added `partnerId` to `GetZonesParams` in `zonesApi.ts`
  - Both Zone-to-Zone (Geological) and Distance-Based charge types now work

### February 14, 2026

- ✅ **Charges Management Module (Hard Replace of ChargePackage)** — COMPLETE
  - **Backend (partner-service):**
    - New `ChargeRule` Prisma model with 3 enums (`ChargeRuleKind`, `ChargeRuleBase`, `ChargeCalcType`)
    - Migration `20260214_add_charge_rules_remove_charge_packages` (creates `charge_rules` table, drops `charge_packages` table + legacy enums)
    - Full CRUD: `chargesController.js`, `chargesService.js`, `chargesSchemas.js` (Joi), `charges.js` (routes)
    - Rate limiter: `chargesManagementLimiter` (30 req/15 min)
    - Audit logging for all operations
    - `chargesRuleCalculationService.js` — charge calculation engine ("pick highest per category", "sum geological charges")
    - `quoteCalculationService.js` refactored to use new engine; all legacy `ChargePackage` usage removed
  - **API Gateway:** `/api/v1/charges` proxy to partner-service; legacy `charge-packages` proxy removed
  - **Frontend:**
    - New `/charges` page (`page.tsx`) with table + filters (partner, kind, base, status, search) + modal CRUD + dynamic conditional form
    - RTK Query `chargesApi.ts` with `transformResponse` for all 6 endpoints
    - Sidebar link under "Configuration" (superadmin/admin only)
    - Route permissions updated in `routePermissions.ts`
  - **Legacy Cleanup (Hard Replace):**
    - Deleted: `chargePackageService.js`, `chargePackageController.js`, `chargePackageSchemas.js`, `chargePackages.js` (route), `chargePackagesApi.ts` (RTK)
    - Removed `ChargePackage` model + enums from Prisma schema
    - Removed `ChargePackage` tag from `baseApi.ts`
    - Updated partner `_count` references to `chargeRules`
    - Removed `chargePackageManagementLimiter` from rateLimiter
  - **Bug Fix:** RTK Query data access — added `transformResponse` to unwrap `{ status, data, meta }` envelope; fixed page data paths for partners, chargesTypes, pincodeTypes, zones
  - **Bug Fix:** `APIResponse.success()` meta — changed string args to `{ message: "..." }` objects to prevent character-by-character spread

- ✅ **Pincode Search Unification (Phase 1)**
  - Frontend partner pincode autocomplete moved to `GET /api/v1/geography/pincodes/search`
  - Deprecated endpoint `GET /api/v1/pincodes/search` now emits `Deprecation`, `Sunset`, and `Link` headers
  - API Gateway logs warning events when deprecated endpoint is used
  - Deprecated controller path now supports both `q` and `code` query aliases

- ✅ **Assign Pincode Search Payload Normalization**
  - Updated RTK endpoint response transform for geography pincode search to normalize envelope/unwrapped payloads
  - Standardized autocomplete data mapping to `{ id, code }` for assign dialog consumption

- ✅ **`db:init` Migration Reliability Hardening**
  - `scripts/init-databases.sh` now selects compose/env by `NODE_ENV` (`.env` + `docker-compose.yml` for dev, `.env.production` + `docker-compose.production.yml` for prod)
  - Added fail-fast behavior to prevent partial migration state across services
  - Removed migration generation from init flow; now deploys committed migrations only
  - Added schema/migrations presence checks before deploy

- ✅ **Partner DB Migration Fixes**
  - Fixed `20260129102803_create_charges_types` migration to avoid failing on fresh DBs when `pincode_types.type` column does not exist yet
  - Added missing `20260206080310_create_partner_pincode_assigns/migration.sql`

### January 24, 2026

- ✅ **Audit Logging Enhancement Complete**
  - Standardized all backend audit action names to `UPPERCASE_WITH_UNDERSCORES` format
  - Created `shared/constants/auditActions.js` with 70+ actions across 18 categories
  - Added `GET /api/v1/audit-log-actions` API endpoint for dynamic filtering
  - Updated frontend audit-logs page with category-based filtering
  - Expanded resource filter from 6 to 22 resource types
  - Fixed services: user-service, partner-service, bootstrap controller
  - Container updates: Copied files to API Gateway container for immediate availability

### January 22, 2026

- ✅ **Frontend Docker Proxy Connection Fixed**
  - Issue: `ECONNREFUSED ::1:3001` when frontend tried to reach API Gateway
  - Root cause: `localhost` in Docker refers to the container itself, not the api-gateway service
  - Fix: Updated `next.config.js` rewrites to use `http://api-gateway:3001`
  - Built new image: `logistics-frontend-prod:new`
  - Container deployed on `logistics-agrigator_logistics-network`
  - Login now works through frontend proxy at `http://localhost:3000`

- ✅ **Pincode Import Scripts Added**
  - Added npm scripts to root `package.json` for easy pincode data import
  - Scripts work for both dev and production environments
  - `yarn run import:pincodes` - Dev environment
  - `yarn run import:pincodes:prod` - Production environment

### January 2026

- ✅ **Outlet Module Complete**
  - New `outlet` role in RBAC (permissions.js)
  - `Outlet` and `OutletAddress` models in user-service
  - Full CRUD API endpoints via API Gateway
  - Frontend management page with modals
  - Geo-autocomplete for address entry
  - Action confirmations (delete, activate/deactivate, reset password)

### December 2024

- ✅ Auth service production-ready
- ✅ User service production-ready
- ✅ Partner service complete
- ✅ Wallet service complete
- ✅ API Gateway RBAC implementation complete
- 🔄 License service development in progress

## Development Focus Areas

### Backend Team

- Outlet portal API endpoints (/my-shipments, /my-addresses)
- License service completion
- Shipment service bulk operations

### Frontend Team

- Outlet portal pages
- Redux/RTK Query migration
- Dashboard component updates

## Working Patterns

### Daily Workflow

1. Check Docker services are running
2. Review current task in memory-bank
3. Follow auth-service patterns for implementation
4. Run verification protocol before marking complete
5. Update memory-bank with changes

### Code Review Checklist

- [ ] Controller pattern used
- [ ] Prisma ORM only (no raw SQL)
- [ ] Audit logging included
- [ ] Input validation with Joi
- [ ] UUID format with @db.Uuid
- [ ] Error handling implemented
- [ ] Docker tested successfully
- [ ] Confirmation dialogs for destructive actions

## Key Reference Files

| Purpose             | Location                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Auth patterns       | `backend/auth-service/`                                                  |
| RBAC permissions    | `shared/constants/permissions.js`                                        |
| Charges routes      | `backend/partner-service/routes/charges.js`                              |
| Charges controller  | `backend/partner-service/controllers/chargesController.js`               |
| Charges service     | `backend/partner-service/services/chargesService.js`                     |
| Charges calc engine | `backend/partner-service/services/chargesRuleCalculationService.js`      |
| Quote calc service  | `backend/partner-service/services/quoteCalculationService.js`            |
| Payment processing  | `backend/shipment-service/services/paymentProcessingService.js`          |
| Shipment controller | `backend/shipment-service/controllers/shipmentController.js`             |
| Shipment schemas    | `backend/shipment-service/validation/shipmentSchemas.js`                 |
| Shipment form store | `frontend/src/store/shipment-form-store.ts`                              |
| Shipment create UI  | `frontend/src/app/shipments/create/`                                     |
| Shipment detail UI  | `frontend/src/app/shipments/[id]/page.tsx`                               |
| Shipment API (RTK)  | `frontend/src/store/api/endpoints/shipmentApi.ts`                        |
| Charges frontend    | `frontend/src/app/charges/page.tsx`                                      |
| Charges API (RTK)   | `frontend/src/store/api/endpoints/chargesApi.ts`                         |
| Discount pkg svc    | `backend/partner-service/services/chargeDiscountPackageService.js`       |
| Discount pkg ctrl   | `backend/partner-service/controllers/chargeDiscountPackageController.js` |
| Discount pkg routes | `backend/partner-service/routes/chargeDiscountPackages.js`               |
| Outlet context svc  | `backend/partner-service/services/outletContextService.js`               |
| Discount pkg UI     | `frontend/src/app/charge-discount-packages/page.tsx`                     |
| Discount pkg API    | `frontend/src/store/api/endpoints/chargeDiscountPackagesApi.ts`          |
| Wallet admin ctrl   | `backend/wallet-service/controllers/adminWalletController.js`            |
| Wallet outlet ctrl  | `backend/wallet-service/controllers/outletWalletController.js`           |
| Wallet routes       | `backend/wallet-service/routes/wallet.js`                                |
| Wallet ext client   | `backend/wallet-service/services/externalWalletClient.js`                |
| Wallet schemas      | `backend/wallet-service/validation/walletSchema.js`                      |
| Wallet frontend     | `frontend/src/app/wallet/page.jsx`                                       |
| Wallet API (RTK)    | `frontend/src/store/api/endpoints/walletApi.ts`                          |
| Wallet ext API docs | `wallet_doc.md`                                                          |
| Outlet routes       | `backend/user-service/routes/outlets.js`                                 |
| Outlet controller   | `backend/user-service/controllers/outletController.js`                   |
| Outlet frontend     | `frontend/src/app/outlets/page.tsx`                                      |
| Outlet API (RTK)    | `frontend/src/store/api/endpoints/outletApi.ts`                          |
| Type normalizer     | `backend/partner-service/utils/typeNameNormalizer.js`                    |
| Partner integration | `backend/shipment-service/services/partnerIntegrationService.js`         |
| API response format | `shared/lib/response.js`                                                 |
| Error classes       | `shared/lib/errors.js`                                                   |

## Next Steps

1. ~~Complete Outlet Module~~ ✅ DONE
2. ~~Charges Management Module~~ ✅ DONE
3. ~~Charge Discount Packages~~ ✅ DONE
4. ~~Build Outlet Portal pages~~ ✅ DONE (dashboard, sidebar permissions)
5. ~~Outlet Wallet Page~~ ✅ DONE (balance, stats, transactions for outlet role)
6. ~~Partner Channel Cleanup~~ ✅ DONE (aggregator extensibility, mode auto-sync, UI polish)
7. ~~Shipment Creation Flow~~ ✅ DONE (multi-step wizard, quote calculation, wallet payment, detail page)
8. ~~Shipment Lifecycle Expansion~~ ✅ DONE (dynamic capabilities, webhook, provider-first cancel, label, refresh, documents)
9. ~~Revalue Charges Feature~~ ✅ DONE (admin rerate, wallet debit/refund, COD handling, quoteSnapshot update)
10. ~~Partner Eligibility & Charges Engine Fixes~~ ✅ DONE (strict pincode+zone, semantic normalization, conditional charges)
11. ~~Delhivery Channel Cleanup~~ ✅ DONE (env removal, sellerGstTin removal, clientName fix)
12. Wire remaining adapter actions (pickup request, NDR action, e-waybill update, manifest generation)
13. Finish License service integration
14. Begin Shipment bulk operations (CSV upload, bulk AWB generation)
15. Continue Frontend Redux migration
16. Shipment list filtering/search enhancements

---

**Sprint**: Revalue Charges + Charges Engine Fixes Complete → Bulk Operations + Remaining Adapter Actions
**Week**: Active Development
**Next Review**: Weekly
