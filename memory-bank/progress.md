# Progress - Logistics Aggregator Portal

> Development status and changelog | Last Updated: August 21, 2026

## Overall Project Status

```
Phase 1: Core Services & Auth     [█████████████████████] 97%
Phase 2: Courier Integration      [██████████████████████] 98%
Phase 3: Platform Integrations    [████░░░░░░░░░░░░░░░░] 20%
Overall Project Progress          [██████████████████░░] 85%
```

## What Works ✅

### Backend Services

#### External Shipment API (100% Complete) — NEW

- ✅ API credentials (`lgk_live_…` / bcrypt-hashed secret, shown once)
- ✅ `POST /api/v1/external/auth/token` → 1h `aud=external-api` JWT, no refresh token
- ✅ Credential binds one frozen acting principal → existing controllers unchanged
- ✅ Audience↔path binding at the gateway (token leak cannot reach other services)
- ✅ Book (one-step `cheapest`/`fastest`, or two-step with a quote token)
- ✅ List / details / edit / cancel — by shipment id, AWB, or your own orderId
- ✅ Rates, serviceability, tracking, track-by-AWB, documents, label
- ✅ Per-credential scopes, IP allowlist, rate limits; instant revocation
- ✅ Idempotency-Key with replay, reuse rejection, and failure release
- ✅ Stable public envelope + snake_case error taxonomy, `request_id` on every response
- ✅ Credential manager + docs at `/developers` (portal)
- ✅ MCP server (`mcp-server/`, stdio, 9 tools)

#### Auth Service (100% Complete)

- ✅ External API credential issuance, rotation and revocation
- ✅ User registration with email validation
- ✅ Login with JWT access/refresh tokens
- ✅ Role-based access control (12 roles including outlet)
- ✅ Password reset flow
- ✅ Session management with Redis
- ✅ 2FA support (TOTP)
- ✅ Audit logging for all operations
- ✅ Rate limiting
- ✅ Swagger documentation

#### User Service (100% Complete)

- ✅ User CRUD operations
- ✅ Customer management
- ✅ Profile management
- ✅ Address management
- ✅ Multi-tenant support
- ✅ Audit logging
- ✅ **Outlet Module** (NEW)
  - ✅ Outlet CRUD (create, read, update, delete)
  - ✅ Outlet address management
  - ✅ Activate/Deactivate outlets
  - ✅ Reset outlet passwords
  - ✅ Geo-based address autocomplete
  - ✅ **Outlet Badge System** (February 17, 2026)
    - ✅ 6-tier badges: Basic, Bronze, Silver, Gold, Platinum, Diamond
    - ✅ PATCH /outlets/:id/badge endpoint
    - ✅ Badge filter on list endpoint
    - ✅ Frontend: badge column, change badge dialog, edit badge in form

#### Partner Service (100% Complete)

- ✅ 75+ courier integrations
- ✅ Rate calculation engine
- ✅ Serviceability check by pincode
- ✅ Zone mapping
- ✅ Partner configuration
- ✅ HMAC authentication
- ✅ **Partner Channel Management** (January 15, 2026 / Updated March 7, 2026)
  - ✅ Multiple API endpoints per partner with priority
  - ✅ Channel CRUD operations (create, update, delete)
  - ✅ Active channel retrieval for API calls
  - ✅ Audit logging for all channel operations
  - ✅ Frontend: Dedicated Manage Channels page with hover-reveal actions
  - ✅ Frontend: RTK Query API endpoints with proper tag invalidation
  - ✅ **Channel mode auto-sync** — `channelMode` auto-computes from channel count (no manual toggle)
  - ✅ **AggregatorType extensibility** — Changed from Prisma enum to `String @db.VarChar(50)` (no DB reset for new aggregators)
  - ✅ **Aggregator validation** — Only DELHIVERY and BLUEDART allowed; NONE/CUSTOM removed
  - ✅ **Removed**: `switchChannelMode` endpoint, channel mode toggle UI, partner wizard pages (`/partners/add`, `/partners/[id]/edit`)
- ✅ **Rule-Based Multi-Channel Routing + Delhivery B2B** (NEW - July 24, 2026)
  - ✅ `PartnerServiceChannel` extended into the routing channel: `businessType` enum (B2B/B2C/BOTH), `minOrderAmount`/`maxOrderAmount`, `paymentModes[]` (COD/PREPAID, empty = all) alongside existing weight slab + serviceType + priority; migration `20260724000000_add_channel_business_rules`
  - ✅ `carrierAccountService.selectChannel(partnerId, {weight, businessType, orderAmount, paymentType, serviceType})` — returns LEGACY (no channels → `getActiveChannel` fallback) / MATCHED / NO_MATCH; priority asc then narrowest slab
  - ✅ `resolveChannelCredentials()` merges linked `PartnerChannelConfig` + per-channel `credentials` overrides into the adapter-ready shape (adapters/webhooks untouched)
  - ✅ Booking wired: `courierOperationService.bookShipment` selects channel by shipment profile; NO_MATCH → 422 `CHANNEL_NOT_MATCHED`; stores `PartnerShipment.serviceChannelId` + channel serviceType; track/label/cancel resolve credentials via the booked channel first
  - ✅ `shipmentType` (B2B/B2C) threaded end-to-end: shipment-service booking + rebook + quote call sites → partner-service; booking Joi weight cap raised 50 → 5000 kg; `Shipment.courierChannelId/Name` display columns (migration `20260724000001`)
  - ✅ Quote engine: channel eligibility gate per partner (NO_MATCH → serviceable:false), matched channel attached to rate rows, `shipmentType` in cache key, channel-level volumetric divisor override, quote-cache flush on channel CUD
  - ✅ **DelhiveryB2BAdapter** (`DELHIVERY_B2B` aggregatorType): JWT login via `/ums/login/` (Redis-cached ~20h, re-login on 401), async `/v2/manifest` + job polling → LR number as AWB, label URLs, LR-level tracking + status mapping, LTL-host serviceability; NO cancel/rate API (portal/contract only); credential schema: username/password/clientId/pickupLocationName
  - ✅ Frontend: `/partners/[id]/channels` unified into tabs — "Routing Channels" (rules table + form with credential-account dropdown) + "Credential Accounts" (existing cards + DELHIVERY_B2B fields); new `serviceChannelApi` RTK slice (`ServiceChannel` tag); `/partners/[id]/carrier-accounts` now redirects; legacy `carrier-accounts-api.ts` service removed
  - ✅ Verified: select-endpoint matrix (7 cases incl. payment-mode and amount bounds), booking 422, LEGACY fallback, cache flush on CUD, zero MODULE_NOT_FOUND, frontend build clean
  - ⏳ UAT pending: live Delhivery B2B calls against `btob-api-dev` need real staging credentials; quote-gate E2E needs pincode assignments seeded (dev DB has none)
- ✅ **Pincode Type Service Charges** (January 2026)
  - ✅ Many-to-many relationship between pincode types and partners
  - ✅ Service charge CRUD operations
  - ✅ Bulk charge creation (multiple types × multiple partners)
  - ✅ Frontend management page at `/pincode-type-service-charges`
  - ✅ Multi-select dialogs for pincode types and partners
  - ✅ Edit functionality with type/partner/charge/status updates
  - ✅ Statistics dashboard (total, active, inactive, total value)
- ✅ **Charges Management Module** (NEW - February 14, 2026)
  - ✅ `ChargeRule` Prisma model with `ChargeRuleKind`, `ChargeRuleBase`, `ChargeCalcType` enums
  - ✅ Full CRUD: controller, service, Joi validation, routes with auth + rate limiting
  - ✅ Charges Rule Calculation Engine (`chargesRuleCalculationService.js`)
  - ✅ Quote engine refactored to use new ChargeRule system
  - ✅ Hard replace: Legacy `ChargePackage` model, enums, routes, controller, service all removed
  - ✅ Migration: `20260214_add_charge_rules_remove_charge_packages`
  - ✅ Frontend: `/charges` page with table, filters, modal CRUD, conditional dynamic form
  - ✅ Frontend: RTK Query endpoints with `transformResponse` envelope unwrapping
  - ✅ Frontend: Sidebar link (superadmin/admin only), route permissions updated
  - ✅ Audit logging for all charge rule CRUD operations
- ✅ **Charge Discount Packages** (NEW - February 17, 2026)
  - ✅ Badge-based discount packages per Partner + Outlet Badge tier (Bronze→Diamond)
  - ✅ Backend: `ChargeDiscountPackage` + `ChargeDiscountPackageItem` Prisma models, `DiscountType` enum (FLAT/PERCENTAGE)
  - ✅ Backend: Full CRUD service, controller, Joi validation, routes with auth + rate limiting
  - ✅ Backend: `outletContextService.js` — resolves outlet badge via user-service internal endpoint with Redis caching
  - ✅ Backend: Quote engine integration — applies per-rule discounts to breakdown, skips cache for badge users
  - ✅ User-service: `GET /api/v1/internal/outlets/by-user/:userId` internal endpoint
  - ✅ API Gateway: `/api/v1/charge-discount-packages` proxy to partner-service
  - ✅ Frontend: `/charge-discount-packages` CRUD page with partner/badge/status filters
  - ✅ Frontend: Create/Edit modal with charge rule multi-select showing current charge info per rule
  - ✅ Frontend: RTK Query endpoints (`chargeDiscountPackagesApi.ts`) + `ChargeDiscountPackage` tag
  - ✅ Frontend: Sidebar link ("Discount Packages" with Tag icon, superadmin/admin only)
  - ✅ Audit logging for all discount package CRUD operations

#### Wallet Service (100% Complete — Stateless External Proxy)

- ✅ **Stateless architecture** — no local DB; all data proxied from external wallet API
- ✅ HMAC SHA-256 authentication with circuit breaker
- ✅ Admin endpoints: list wallets, list transactions, topup, debit, refund, sync wallets, update user status, get/create wallet
- ✅ Batch wallet sync (batches of 3, 500ms delay)
- ✅ Joi validation schemas for all admin proxy operations
- ✅ **Route ordering fix** — `/admin/*` routes before `/:userId/*` to prevent Express wildcard collision
- ✅ Frontend: complete wallet management page with tabs, stats, filters, pagination
- ✅ Frontend: transaction modals (Topup, Debit, Refund with debit-only selection)
- ✅ Frontend: Create Wallet & Sync Wallets modals
- ✅ Frontend: RTK Query `walletApi.ts` with 8 endpoints
- ✅ Frontend: polished UI with grouped header buttons, transaction type badges with icons
- ✅ **Outlet Wallet View** (February 21, 2026)
  - Backend: `outletWalletController.js` with 3 endpoints (`/my/wallet-info`, `/my/transactions`, `/my/statistics`)
  - Backend: `externalWalletClient.js` added `getUserTransactionHistory()` and `getUserTransactionStatistics()`
  - Backend: Uses `req.user.phone` as wallet userId (phone added to JWT payload in auth-service)
  - Backend: Permission `wallet:read:own` added to outlet role in `shared/constants/permissions.js`
  - Backend: Fixed shared Redis initialization in wallet-service (`config/redis.js` now uses shared Redis client)
  - Backend: Fixed `setex` → `setEx` (Redis v4) in `shared/lib/auth.js`
  - Backend: Fixed `getEffectivePermissions` fallback to use JWT-embedded permissions
  - Frontend: `OutletWalletView` component with balance card (gradient), stats row, 30-day summary bar, paginated transaction table
  - Frontend: RTK Query endpoints (`getMyWalletInfo`, `getMyTransactions`, `getMyStatistics`)
  - Frontend: Role-based routing with loading guard (prevents admin API calls for outlet users)
  - Frontend: `phone` field added to User interface in authSlice and authApi
  - Sidebar: `outlet` role added to wallet nav item

#### Shipment Service (95% Complete)

- ✅ Single order creation
- ✅ AWB generation
- ✅ Real-time tracking
- ✅ Status updates
- ✅ NDR management
- ✅ **Shipment Creation Flow** (March 2026, rebuilt August 4, 2026)
  - ✅ 3-step wizard: Shipment Details → Partner Selection → Confirm & Book (`app/shipments/create/{details,partners,confirm}`), replacing the old 2-step Docket → Review flow; `components/shipments/create/wizard-layout.tsx` shell
  - ✅ B2B/B2C multi-box support with invoice generation
  - ✅ Partner quote calculation with charge breakdown, now against charges-engine v3: HMAC quote tokens (15min TTL), GST-inclusive `pricing.grandTotal`, dynamic VAS (`vasSelections`) re-priced per partner via `requiredQuestions`
  - ✅ Dynamic VAS section (`step1/vas-section.tsx`) driven by `GET /charge-definitions/booking-questions`; `lib/utils/vas.ts` builds the `[{chargeCode, answer}]` payload identically for both the quote and booking calls (token hash-checks it)
  - ✅ Outlet markup (FLAT/PERCENTAGE) captured at booking (`step1/markup-section.tsx`), split shown at Confirm (systemCharge / markup / finalTotal / COD collectable); wallet sufficiency checked against systemCharge only
  - ✅ Wallet payment integration (auto-debit on PREPAID shipments)
  - ✅ `resolveOutletContext`: admin uses outlet phone, outlet uses JWT phone
  - ✅ `paymentProcessingService`: calls wallet admin endpoints with `X-Internal-Request` header
  - ✅ `quoteSnapshot` stores full charge breakdown + discount for shipment detail page
  - ✅ Fragile item handling (conditional charge, frontend checkbox)
  - ✅ Draft persistence: Zustand `persist` middleware (`shipment-form-draft` in localStorage), debounced "Draft saved" badge
  - ✅ 409 `QUOTE_STALE` handling: Confirm step clears the selected quote and bounces to Partner Selection to re-fetch
  - ✅ AI "Why this price?" quote explain button (`useExplainQuoteMutation` → `POST /charge-configs/ai/explain-quote`)
  - ⏳ Earnings RTK endpoints wired (`useGetOutletEarningsQuery`/`Summary`) but the `/earnings` page itself is not built yet
- ✅ **Shipment Lifecycle Expansion** (NEW - March 24, 2026)
  - ✅ `POST /:id/refresh` — Fetch latest status from provider, update local DB
  - ✅ `POST /:id/courier-label` — Fetch label from provider, store as ShipmentDocument
  - ✅ `POST /:id/cancel-with-provider` — Provider-first cancellation flow
  - ✅ `GET /:id/documents` — List shipment documents (labels, POD, invoices)
  - ✅ `getShipmentById` enriched with `providerCapabilities` and `documents`
  - ✅ Global webhook ingestion `POST /webhook/:provider` (public, no auth)
  - ✅ Terminal status protection — never downgrade CANCELLED/DELIVERED/RTO
  - ✅ Schema: `providerStatus`, `providerLastSyncAt`, `providerRawResponse`, `courierLabelUrl`, `courierLabelFormat`, `courierLabelFetchedAt`, `pickupRequestId`, `pickupRequestedAt`, `pickupConfirmedAt`
  - ✅ New `ShipmentDocument` model (type: LABEL, MANIFEST, INVOICE, POD, EWAYBILL, OTHER)
- ✅ **Revalue Charges** (March 28, 2026)
  - ✅ Admin/Superadmin re-rate with updated weight/dimensions
  - ✅ Wallet debit/refund for PREPAID shipments
  - ✅ COD handling: DEDUCT_WALLET or UPDATE_COD options
  - ✅ `skipServiceabilityCheck` bypasses pincode/zone checks for existing shipments
  - ✅ `quoteSnapshot.chargeBreakdown` updated with fresh breakdown after rerate
  - ✅ Frontend: disputed weight display, COD amount card, actual value display
  - ✅ Cancel order wallet refund for PREPAID payment mode
- ✅ **Shipment quotes & assign-partner pipeline (April 8, 2026)**
  - ✅ `getShipmentQuotes`: single path through `partnerIntegrationService.calculateRates` (removed duplicate serviceability filtering)
  - ✅ Rate Redis: delete cache entry when stored `rates` is empty; do not write cache when `rates.length === 0`
- ⏳ Bulk operations (planned)
- ⏳ Bulk label printing (planned)

#### Partner Service (100% Complete — Enhanced)

- ✅ 75+ courier integrations (existing)
- ✅ **Dynamic Capability Contract** (NEW - March 24, 2026)
  - ✅ `BaseCourierAdapter` extended with `getCapabilities()` and `getAvailableActions(shipmentContext)` abstract methods
  - ✅ `DelhiveryAdapter` declares: track, label, cancel, pickup, manifest, edit, ndr, ewaybill, pod, refresh, webhook
  - ✅ `BlueDartAdapter` declares: track, label, cancel, pickup, manifest, refresh
  - ✅ `courierOperationService.getShipmentCapabilities()` resolves adapter and returns capabilities
  - ✅ `POST /api/v1/courier-operations/capabilities` endpoint with Joi validation
  - ✅ Delhivery cancel fix: `cancellation: "true"` (string, not boolean)
  - ✅ Delhivery tracking normalization: checks Instructions + StatusCode for cancellation detection
  - ✅ Delhivery warehouse creation: removed `registered_name`, added country fields
  - ✅ Delhivery payload corrections: `payment_mode: "Prepaid"`, `products_desc`, pincode String casts
  - ✅ Partner channel Joi validation: DELHIVERY requires `clientName`/`sellerGstTin`, BLUEDART requires `licenseKey`/`loginId`/`customerCode`
  - ✅ Schema: `PartnerShipment` expanded with `providerStatus`, `providerLastSyncAt`, `providerRawResponse`, `courierLabelUrl`, `pickupRequestId`, `pickupRequestedAt`
  - ✅ Redis v4 fix: `setEx()` in `BaseCourierAdapter.setCachedResponse()`
- ✅ **Partner Eligibility & Charges Engine Fixes** (March 28, 2026)
  - ✅ Strict partner eligibility: requires BOTH pincode assignment AND zone coverage for pickup AND delivery
  - ✅ Semantic type normalization (`typeNameNormalizer.js`): COD/cod/Cod → COD canonicalization
  - ✅ Conditional charge gating: COD charges only for COD, FRAGILE only for fragile, INSURANCE via INVOICE_VALUE rules
  - ✅ `paymentType` forwarded to charge engine context
  - ✅ Duplicate detection on PincodeType/ChargesType creation uses canonical names
- ✅ **Zone coverage & quote cache (April 8, 2026)**
  - ✅ `zoneCoverageValidationService`: DISTANCE zone + milestones fallback when no `zone_pincodes` match (distance-priced partners)
  - ✅ Zone serviceability Redis: cache key `serviceable:v2`; **only** cache `serviceable: true` (no long-lived negative cache)
  - ✅ `quoteCalculationService`: charge engine behavior aligned with zone validation (distance mismatch does not always short-circuit before pricing)

#### API Gateway (95% Complete)

- ✅ Service routing
- ✅ Basic authentication
- ✅ Rate limiting
- ✅ RBAC integration
- ✅ Permission caching
- ✅ Scope filtering
- ✅ **Outlet routes**
- ✅ **Webhook path exemption** (NEW - March 24, 2026): `/api/v1/shipments/webhook` added to `publicPaths` in `authValidator.js`

#### License Service (30% Complete)

- ✅ Basic schema
- ✅ License creation
- ⏳ Validation middleware
- ⏳ Tenant limits
- ⏳ Feature flags

### Frontend

#### Completed Features

- ✅ Authentication pages (login, register)
- ✅ Dashboard layout
- ✅ Sidebar navigation
- ✅ User profile page
- ✅ Basic shipment list
- ✅ Partner list view
- ✅ Wallet balance display
- ✅ **Outlet Management Page** (NEW)
  - ✅ List outlets with search/pagination
  - ✅ Create outlet dialog with password generation
  - ✅ View outlet modal with addresses
  - ✅ Edit outlet modal
  - ✅ Delete outlet with confirmation
  - ✅ Activate/Deactivate with confirmation
  - ✅ Reset password with confirmation
  - ✅ Address CRUD (add, edit, delete)
  - ✅ Geo-autocomplete for pincode/city/state
  - ✅ Badge column with color-coded display
  - ✅ Change badge dialog with tier selection
  - ✅ Badge editing in edit form (admin/client only)

#### Completed Features (continued)

- ✅ **Charges Management Page** (NEW - February 14, 2026)
  - ✅ Table view with partner/kind/base/status filters + search
  - ✅ Modal-based Create with dynamic conditional form fields
  - ✅ Modal-based View/Edit with inline editing
  - ✅ Toggle status and soft-delete actions
  - ✅ RTK Query integration with proper `transformResponse`

#### In Progress

- ⏳ Redux/RTK Query migration (75% complete)
- ⏳ Bulk upload interface
- ⏳ Advanced filtering / search enhancements

#### Completed Features (continued - March 2026)

- ✅ **Partner Pincode Autocomplete Stabilization (April 8, 2026)**
  - Removed duplicate RTK Query endpoint registration for `searchPincodes` from `partnerPincodesApi.ts`
  - Partner pincode assign dialog now uses the canonical geography lazy search hook from `geoApi.ts`
  - Added deterministic dialog behavior for stale-result prevention, close/reset handling, and latest-query-only empty state rendering
  - Normalized `getPartnerPincodes` frontend response handling to unwrap the backend envelope correctly
  - `builtin cd frontend && yarn run build` passed successfully
  - Restarted local frontend container after the successful build to load the new bundle

- ✅ **Shipment detail — Assign Partner quotes (April 8, 2026)**
  - Coerces `declaredValue`, `codAmount`, weight/dimensions for `/shipments/quotes` so Joi accepts API-shaped values
  - Assign Partner: surfaces RTK validation errors; distinguishes “could not load quotes” vs successful empty list

- ✅ **Shipment Creation Wizard** (March 2026)
  - ✅ Multi-step form: Docket → Dimensions → Delivery → Invoice → Review & Book
  - ✅ B2B/B2C conditional rendering (single box vs multi-box + invoices)
  - ✅ Outlet selection for admin users with phone-based wallet integration
  - ✅ Partner quote display with charge breakdown table and discount badges
  - ✅ Confirm & Book with wallet auto-debit
  - ✅ Shipment detail page with invoice-style charges + "You saved" discount line
  - ✅ Zustand form store (`shipment-form-store.ts`) with `outletUserId`, `isFragile`
  - ✅ RTK Query endpoints for quotes and creation

- ✅ **Dynamic Shipment Detail Page** (NEW - March 24, 2026)
  - ✅ Quick Actions rendered dynamically from provider capabilities (`availableActions`)
  - ✅ "Refresh from Provider" button fetches latest status from courier API and updates local DB
  - ✅ "Download Label" button fetches and downloads PDF label (base64 decode + blob download)
  - ✅ "Cancel with Provider" button with confirmation modal — provider-first cancellation
  - ✅ Documents section displaying all `ShipmentDocument` records (LABEL, MANIFEST, INVOICE, POD)
  - ✅ Provider Sync Status section (provider name, aggregator type, last sync, provider status)
  - ✅ 4 new RTK Query hooks: `refreshFromProvider`, `fetchCourierLabel`, `cancelWithProvider`, `getShipmentDocuments`
  - ✅ 6 new TypeScript interfaces: `ProviderAction`, `ProviderCapabilities`, `ShipmentDocument`, etc.

### Infrastructure

- ✅ Docker Compose setup
- ✅ PostgreSQL with per-service databases
- ✅ Redis for sessions and caching
- ✅ yarn monorepo configuration
- ✅ Shared library structure
- ✅ Environment configuration
- ✅ Health check endpoints
- ✅ **Production Deployment Scripts** (NEW - January 2026)
  - ✅ Pincode import scripts for dev/production
  - ✅ Docker network configuration
  - ✅ Frontend proxy configuration fix (api-gateway DNS)

## What's Left to Build 📋

### High Priority

1. ~~**Outlet Portal Pages**~~ ✅ DONE (February 21, 2026)
   - ✅ Outlet-specific dashboard with quick actions
   - ✅ Sidebar permissions fixed for outlet role
   - ✅ Existing `/shipments` and `/addresses` pages accessible

2. **Shipment Bulk Operations**
   - CSV upload and parsing
   - Bulk AWB generation
   - Bulk status updates
   - Error reporting

3. **License Service**
   - License validation
   - Tenant limits
   - Feature toggles
   - Usage tracking

### Medium Priority

4. **Support Service**
   - Ticket schema
   - CRUD operations
   - Assignment logic
   - Resolution tracking

5. **Platform Service**
   - Shopify OAuth
   - WooCommerce integration
   - Order sync
   - Webhook handling

6. **Frontend Migration**
   - Complete Redux store setup
   - Remaining RTK Query endpoints
   - Component updates
   - State migration

### Lower Priority

7. **Reporting & Analytics**
   - Dashboard metrics
   - Export functionality
   - Trend analysis

8. **Notification System**
   - Email notifications
   - SMS alerts
   - Webhook events

## Current Status

### This Week's Progress

- ✅ **Auth redirect ping-pong fixed + transparent refresh-token flow wired (July 31, 2026)**
  - Cold-opening the app (or `/dashboard`) sent users login → dashboard flash → login with "session expired". Six compounding causes, all fixed
  - **No refresh flow existed in the running code**: `baseApi.ts` was a bare `fetchBaseQuery`; the `refreshToken` mutation had zero call sites and `store/auth-store.ts`'s `refreshAccessToken` is dead code — every 401 went straight to logout
  - **Gateway blocked refresh anyway**: `authValidator.js` `publicPaths` listed `/api/v1/auth/refresh-token`, but the real route is `/api/v1/auth/refresh`; `isPublicPath` matches by `startsWith`, so refresh required a live Bearer JWT and could never succeed once the access token expired
  - **Hydration race**: `ProtectedRoute`'s effect ran on the stale pre-hydration `isAuthenticated: false` and pushed to login, then Redux flipped true (dashboard flash) and the login page pushed back — the ping-pong. Fixed with a new `isHydrated` flag; guards now render a spinner until hydration completes and use `router.replace`
  - `hydrate()` now validates JWT `exp` instead of trusting localStorage; expired access token + live refresh token still counts as authenticated
  - `errorMiddleware` no longer hard-navigates on any 401 (it fired on pre-hydration requests and left cookies/localStorage disagreeing); 401 is now owned solely by `baseQueryWithReauth`
  - Auth cookies now track the **refresh** token's lifetime (was a hardcoded 24h vs the access-token TTL), so a merely-expired access token no longer evicts users at the edge
  - New `frontend/src/lib/auth/token.ts` (decode/expiry/cookie helpers); no new dependencies — `exp` decoded manually, single-flight refresh via a module-level promise (required: the backend rotates the refresh token, so parallel refreshes would invalidate each other)
  - Verified: `POST /api/v1/auth/refresh` with **no** Authorization header now returns 200 + rotated pair (was 401 `NO_TOKEN`); new access token authorizes `GET /api/v1/zones` 200; invalid token → `INVALID_REFRESH_TOKEN`; `/dashboard` without cookie → 307 with `?redirect=`; frontend build clean, 52/52 static pages; containers restart error-free
  - Login post-submit dead-time fixed: the spinner was bound to the RTK Query mutation, which settles well before the destination route loads, so the filled form reappeared with a live "Sign In" button for seconds — reading as a silent failure. Now `isRedirecting` holds the button busy **and** `isLeaving = isRedirecting || (isHydrated && isAuthenticated)` replaces the whole page with a "Signing you in…" screen, so the form can't come back (a remount resets local state but the browser re-autofills the fields). Middleware ruled out first: `/dashboard` with a valid cookie returns 200 for both normal and `RSC: 1` requests
  - ⚠️ The multi-second wait is mostly a dev artifact — Next compiles `/dashboard` on demand (~2.4s) and `router.prefetch` is a no-op in dev; production will be faster. The fix makes the wait legible, not shorter
  - ⚠️ `yarn build` must run as `docker exec -e NODE_ENV=production logistics-frontend yarn build` — the container's dev `NODE_ENV` makes Next mix dev/prod React runtimes and fail prerender on `/_not-found`. `frontend/node_modules` does not exist on the host

- ✅ **Bulk Shipment Upload built + NDR page wired to live APIs (July 25, 2026)**
  - Replaced `mock-data.ts`-driven UI on `/shipments/bulk` and `/shipments/ndr` with real endpoints; both pages converted `.jsx` → `.tsx`, mock exports deleted
  - Bulk upload was **non-functional**, not merely unwired: invalid permission `shipment:bulk_create:assigned` (`bulk_create` absent from `PERMISSION_ACTIONS` → 403 for all non-superadmins), Joi schema requiring `file` while the controller read `bulkData`, no multer/xlsx installed at all, `BulkJob` table never written to (history had no data source), and `bulkProcessingService` calling a non-existent `selectOptimalPartner` with wrong params/return-shape and no auth token
  - Added `multer` + `xlsx`, `middleware/upload.js`, `services/bulkFileParserService.js` (flat CSV → nested shape, phone normalisation to `+91-XXXXXXXXXX`, per-row errors instead of whole-file rejection)
  - New endpoints: `POST /bulk/upload` (multipart, now using the previously-unused `bulkOperationsLimiter`), `GET /bulk/jobs` (+ summary aggregate), `GET /bulk/jobs/:jobId`, `GET /bulk/template`
  - `GET /api/v1/shipments/ndr` was **unreachable** — registered after `GET /:id`, so `"ndr"` was parsed as a shipment UUID (500). Reordered; that surfaced an invalid `include` of non-relations `createdBy`/`assignedTo` in `ndrService`, which was crashing the process
  - Fixed `baseApi.ts` forcing `Content-Type: application/json` onto FormData (corrupts multipart boundary) via an `x-multipart` marker
  - Verified: service restarts clean (0 MODULE_NOT_FOUND), NDR 200, bulk permission 400 not 403, upload parses/maps/persists `bulk_jobs` rows, invalid file types and unauth rejected, frontend build exit 0
  - ⚠️ Shipment creation still blocked by missing courier rate cards in dev (affects the normal single-shipment path identically) — seed partner rates to see successful bulk creation

- ✅ **Partner Pincode Autocomplete Production Bug Fix (April 8, 2026)**
  - Fixed frontend-only issue where `/api/v1/geography/pincodes/search` returned valid results in production but the partner assign dialog still showed "No pincodes found"
  - Root cause was RTK Query endpoint-name collision: both `geoApi.ts` and `partnerPincodesApi.ts` injected `searchPincodes` into the shared `baseApi`, making runtime behavior bundle/load-order dependent
  - Consolidated search usage onto the canonical geography endpoint and removed the duplicate partner-specific autocomplete wrapper
  - Hardened dialog state management to prevent stale results from previous searches from masking newer valid results
  - Kept scope limited to frontend source and response-shape cleanup around the touched partner pincode page
  - Acceptance gate used: frontend production build and container restart; TypeScript type-check remains red due to unrelated existing errors

- ✅ **End-to-End Shipment Creation Flow (March 17, 2026)**
  - Complete multi-step shipment creation wizard (Docket → Dimensions → Delivery → Invoice → Review)
  - B2B/B2C support: single box for B2C, multi-box + invoices for B2B
  - Partner quote engine integration with charge breakdown + badge-based discounts
  - Wallet payment: automatic debit from outlet wallet for PREPAID shipments
  - Critical wallet integration fix: external wallet API uses phone as userId, not auth UUID
  - Inter-service communication: added `X-Internal-Request` header for wallet service calls
  - Redis v4 fix: `setex()` → `setEx()` across wallet-service and shipment-service
  - `paymentProcessingService.js` rewritten to use wallet admin endpoints (`/admin/wallet`, `/admin/debit`, `/admin/refund`)
  - `resolveOutletContext` in shipmentController: resolves wallet userId to outlet phone number
  - Frontend form store updated with `outletUserId` (phone) and `isFragile` fields
  - Shipment detail page: charge breakdown display, discount info from `quoteSnapshot`
  - Files: `paymentProcessingService.js`, `shipmentController.js`, `shipmentSchemas.js`, `walletService.js`, `externalWalletClient.js`, `trackingService.js`, `shipment-form-store.ts`, `docket/page.tsx`, `review/page.tsx`, `shipments/[id]/page.tsx`, `shipmentApi.ts`

- ✅ **Partner Channel System Cleanup & Polish (March 7, 2026)**
  - Converted AggregatorType from Prisma enum to String for extensibility
  - Implemented auto-sync of channelMode based on channel count
  - Only DELHIVERY/BLUEDART allowed as aggregator types (removed NONE/CUSTOM)
  - Polished partner detail page: removed legacy fields, consolidated actions
  - Polished Manage Channels page: hover-reveal actions, credential status icons
  - Fixed "too many requests": removed redundant refetch() calls, fixed RTK Query tag invalidation
  - Deleted dead wizard pages (partners/add, partners/[id]/edit)
  - Made DetailHeader backHref optional to prevent Link crash

- ✅ **Outlet Wallet Page (February 21, 2026)**
  - Outlet users can now view their wallet balance, transaction statistics, and transaction history at `/wallet`
  - Backend: 3 new `/my/*` routes in wallet-service with `wallet:read:own` permission
  - Backend: `outletWalletController.js` uses `req.user.phone` as wallet user ID
  - Backend fixes: shared Redis initialization, Redis v4 API (`setEx`), JWT permission fallback, `phone` in JWT payload
  - Frontend: `OutletWalletView` — balance card with gradient, 3 stat cards (topups/debits/refunds), 30-day summary bar, paginated transaction table
  - Frontend: role-based view routing with loading guard to prevent admin API leaks
  - Files: `outletWalletController.js` (new), `externalWalletClient.js`, `wallet.js` (routes), `wallet/page.jsx`, `walletApi.ts`, `authSlice.ts`, `authApi.ts`, `sidebar.jsx`, `shared/constants/permissions.js`, `shared/lib/auth.js`, `wallet-service/config/redis.js`, `auth-service/controllers/authController.js`

- ✅ **Outlet User Login & Dashboard Fix (February 21, 2026)**
  - Fixed outlet users seeing admin dashboard (called partners/zones/charges APIs → 403 errors)
  - Fixed sidebar missing Shipments and My Addresses for outlet role
  - Root cause: permissions from login response never stored in Redux → sidebar permission checks failed
  - Split dashboard into AdminDashboard and OutletDashboard components
  - Added `dispatch(setPermissions())` on login and on page hydration from localStorage
  - Added `outlet` role to useRole hook (SystemRole enum, hierarchy, groups, display names)
  - Files: dashboard/page.jsx, useAuth.ts, AuthHydration.tsx, authSlice.ts, useRole.ts

- ✅ **Wallet Module Overhaul — Stateless External Proxy (February 21, 2026)**
  - Wallet service rewritten as stateless proxy to external wallet API (`wapi.websiteduniya.com`)
  - Backend: `adminWalletController.js` (8 endpoints), `externalWalletClient.js` (HMAC + circuit breaker), admin validation schemas
  - Critical fix: Express route ordering — `/admin/*` routes moved before `/:userId/*` wildcard routes
  - Validation fixes: added `transaction_id` (integer) for refunds, changed `remarks` from string to object
  - Frontend: complete wallet management UI with Wallets/Transactions tabs, stats cards, filters, pagination
  - Frontend: Topup/Debit/Refund/UpdateStatus/CreateWallet/SyncWallets modals
  - Frontend: RTK Query `walletApi.ts` (8 endpoints), outlet name resolution via `outletMap`
  - UI polish: header button grouping with divider, transaction type badges (icon + tinted pill), dark-mode colors
  - Metadata field sends as JSON object (with plain-text fallback wrapping)
  - Refund modal only shows DEBIT transactions (not TOP_UP)
  - Docker compose files updated for wallet-service configuration

- ✅ **Charge Discount Packages (February 17, 2026)**
  - Full-stack feature: badge-based discount packages per Partner + Outlet Badge tier
  - Backend (user-service): Internal endpoint `GET /api/v1/internal/outlets/by-user/:userId` for inter-service badge lookup
  - Backend (partner-service): `ChargeDiscountPackage` + `ChargeDiscountPackageItem` models with `partner` relation
  - Backend (partner-service): CRUD service/controller/routes/validation, `outletContextService.js` (Redis-cached badge resolver)
  - Backend (partner-service): Quote engine enriched with per-rule FLAT/PERCENTAGE discounts; cache skip for badge users
  - API Gateway: proxy for `/api/v1/charge-discount-packages`
  - Frontend: `/charge-discount-packages` page with full CRUD, charge rule info display, RTK Query
  - Frontend: Sidebar link, route permissions, `ChargeDiscountPackage` tag in baseApi
  - **Key fix**: Prisma schema needed explicit `partner Partner @relation(...)` on `ChargeDiscountPackage` — raw `partnerId` alone doesn't enable `include: { partner }`. Also needed `discountPackages ChargeDiscountPackage[]` on `Partner`.
  - **Key fix**: Charges API validation caps `limit` at 100 — frontend was sending `limit: 200`

- ✅ **Outlet Badge System (February 17, 2026)**
  - Backend: Added `OutletBadge` enum (BASIC, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND) to user-service Prisma schema
  - Backend: Added `badge` field to Outlet model with `@default(BASIC)`
  - Backend: Migration `20260217120000_add_outlet_badge`
  - Backend: PATCH /outlets/:id/badge endpoint with validation, audit logging
  - Backend: Badge filter on GET /outlets list endpoint
  - Backend: Auth-service migration `20260217130000_add_outlet_role` (fix pre-existing missing `outlet` in Role enum)
  - Frontend: `OutletBadge` type, `updateOutletBadge` RTK Query mutation
  - Frontend: Badge column in list table with color-coded display
  - Frontend: Change Badge dialog, badge in view/edit dialogs
  - **Bug Fix**: Fixed unhandled rejection crash in outletController.js — all 13 catch blocks changed from `throw error` to `res.status().json()` error responses
  - **Bug Fix**: Improved auth 409 error passthrough — now shows "User with this email already exists" instead of generic "Failed to create outlet user"

- ✅ **Charges Zones Query Fix (February 17, 2026)**
  - Fixed: partnerId rejected as "not allowed" in GET /api/v1/zones validation
  - Backend: Added partnerId, sortBy, sortOrder to listZones Joi schema (zoneSchemas.js)
  - Backend: Updated zoneController.js to use query partnerId for admin/superadmin users
  - Frontend: Added partnerId to GetZonesParams interface (zonesApi.ts)
  - Affects both ZONE_TO_ZONE_WEIGHT (Geological) and DISTANCE_BASE_WEIGHT charge types

- ✅ **Charges Management Module - Hard Replace (February 14, 2026)**
  - New `ChargeRule` engine replaces legacy `ChargePackage` system entirely
  - Backend: Prisma model, CRUD API, calculation engine, quote engine integration
  - Frontend: Full management UI at `/charges` with dynamic forms and RTK Query
  - Deleted all legacy ChargePackage code (5 backend files + 1 frontend file)
  - Dropped `charge_packages` table and 3 legacy enums from database
  - Fixed RTK Query `transformResponse` pattern for API envelope unwrapping
  - Fixed `APIResponse.success()` meta string spread bug

- ✅ **Pincode Search Endpoint Unification (February 14, 2026)**
  - Canonicalized search/autocomplete endpoint to `GET /api/v1/geography/pincodes/search`
  - Deprecated protected endpoint `GET /api/v1/pincodes/search` retained temporarily with deprecation headers and sunset metadata
  - Added API Gateway deprecation warning logs for old endpoint usage
  - Updated deprecated partner route/controller/validation to support both `q` and `code` aliases during migration window
  - Updated frontend partner pincode search endpoint to geography API with response normalization transform

- ✅ **Database Init and Migration Recovery (February 14, 2026)**
  - Hardened `yarn run db:init` flow via `scripts/init-databases.sh`:
    - environment-aware compose/env-file selection for dev vs production
    - strict fail-fast behavior to avoid partial migrations
    - deploy committed migrations only (no migration generation in init path)
    - preflight checks for Prisma schema/migrations presence
  - Fixed partner migration `20260129102803_create_charges_types` for fresh DB compatibility
  - Added missing migration file `20260206080310_create_partner_pincode_assigns/migration.sql`

- ✅ **Audit Logging Enhancement** (January 24, 2026)
  - Standardized all audit action names to UPPERCASE_WITH_UNDERSCORES format
  - Created centralized audit actions constants (70+ actions)
  - Added GET /api/v1/audit-log-actions endpoint for dynamic filtering
  - Updated frontend with category-based action filtering (18 categories)
  - Expanded resource filter from 6 to 22 resource types
  - Fixed services: user-service, partner-service, bootstrap controller
  - Frontend: Dynamic action options based on selected category

- ✅ **Frontend Docker Proxy Connection Fix** (January 2026)
  - Fixed `ECONNREFUSED ::1:3001` error in production
  - Updated `next.config.js` to use `http://api-gateway:3001` instead of `localhost:3001`
  - Rebuilt frontend container with correct configuration
  - Verified login works through frontend proxy
  - Container: `logistics-frontend-prod` on `logistics-agrigator_logistics-network`

- ✅ **Pincode Import Scripts** (January 2026)
  - Added `import:pincodes` script for dev environment
  - Added `import:pincodes:prod` script for production environment
  - Added `load:pincodes` and `load:pincodes:prod` scripts
  - Added `seed:geo` and `seed:geo:prod` scripts
  - Commands: `yarn run import:pincodes` or `yarn run import:pincodes:prod`

- ✅ Outlet module backend complete
- ✅ Outlet module frontend complete
- ✅ Geo-autocomplete for addresses
- ✅ All outlet actions with confirmations

### Completed This Month (January 2026)

- ✅ **Pincode Type Service Charges Module** (NEW - January 15, 2026)
  - Backend: `PincodeTypeServiceCharge` Prisma model (many-to-many with PincodeType & Partner)
  - Backend: Validation schemas, controller, service layer, routes
  - Backend: 7 API endpoints (list, get by ID, create, update, delete, by type, by partner)
  - Backend: Bulk creation support (multiple pincode types × multiple partners)
  - Backend: Redis caching with 1-hour TTL
  - Backend: Complete audit logging
  - API Gateway: Proxy configuration for `/api/v1/pincode-type-service-charges`
  - Frontend: RTK Query API endpoints with proper TypeScript types
  - Frontend: Management page at `/pincode-type-service-charges`
  - Frontend: Statistics cards (total, active, inactive, total value)
  - Frontend: Create dialog with multi-select for pincode types and partners
  - Frontend: Edit dialog with pincode type/partner/charge/status updates
  - Frontend: Delete confirmation dialogs
  - Frontend: Search and filter functionality
  - Frontend: Sidebar navigation link added

- ✅ **Pincode Types Edit Wizard Fix**
  - Backend: Added area and city hierarchy to `getPincodesByType` API
  - Backend: Updated Prisma query to include `area` and `area.city` relationships
  - Frontend: Fixed edit wizard to show pre-selected states, cities, areas
  - Frontend: Removed unnecessary geo API call (use data directly from `getPincodesByType`)
  - Frontend: Added `isInitialized` state tracking to prevent race conditions

- ✅ Outlet model and schema in user-service
- ✅ OutletAddress model with HOME/WORK/OTHER types
- ✅ New `outlet` role in RBAC system
- ✅ Outlet API routes (CRUD, status, password reset)
- ✅ Frontend outlet management page
- ✅ RTK Query outlet endpoints
- ✅ Geo-autocomplete integration

## Known Issues

### Open Issues

| ID  | Service  | Issue                                                        | Priority | Status      |
| --- | -------- | ------------------------------------------------------------ | -------- | ----------- |
| #1  | Shipment | Bulk operations pending                                      | P1       | Planned     |
| #2  | License  | Integration incomplete                                       | P1       | In Progress |
| #3  | Partner  | Remaining adapter actions (pickup, NDR, e-waybill, manifest) | P2       | Planned     |
| #4  | Shipment | Shipment list filters/search                                 | P2       | Planned     |

### Recently Fixed

| ID  | Service      | Issue                                                                 | Fixed Date |
| --- | ------------ | --------------------------------------------------------------------- | ---------- |
| #4  | User Service | Outlet module implementation                                          | Jan 2026   |
| #5  | API Gateway  | Outlet routes added                                                   | Jan 2026   |
| #6  | Frontend     | Outlet management UI                                                  | Jan 2026   |
| #7  | Auth         | Outlet role in RBAC                                                   | Jan 2026   |
| #8  | User Service | Outlet badge system                                                   | Feb 2026   |
| #9  | User Service | Unhandled rejection crash fix                                         | Feb 2026   |
| #10 | Partner Svc  | Channel mode auto-sync, aggregator extensibility                      | Mar 2026   |
| #11 | Frontend     | RTK Query duplicate API calls (refetch + invalidation)                | Mar 2026   |
| #12 | Frontend     | DetailHeader crash (undefined backHref)                               | Mar 2026   |
| #13 | Shipment     | Wallet payment used UUID instead of phone number                      | Mar 2026   |
| #14 | Shipment     | X-Internal-Request header missing for wallet calls                    | Mar 2026   |
| #15 | Wallet/Ship  | redis.setex() → setEx() (Redis v4 compat)                             | Mar 2026   |
| #16 | Shipment     | Charge breakdown not stored in quoteSnapshot                          | Mar 2026   |
| #17 | Partner      | Delhivery cancel: boolean `true` → string `"true"`                    | Mar 2026   |
| #18 | Partner      | Delhivery normalizeStatus: check Instructions+StatusCode for cancel   | Mar 2026   |
| #19 | Shipment     | Terminal status downgrade protection in refreshFromProvider           | Mar 2026   |
| #20 | Partner      | BaseCourierAdapter.setCachedResponse setex→setEx (Redis v4)           | Mar 2026   |
| #21 | Partner      | Delhivery warehouse: removed registered_name, added country           | Mar 2026   |
| #22 | Partner      | Partners shown for quotes without pincode assignment or zone coverage | Mar 2026   |
| #23 | Partner      | Only partial charges applied (missing weight, COD, conditional)       | Mar 2026   |
| #24 | Partner      | PincodeType/ChargesType case-sensitivity (COD vs cod)                 | Mar 2026   |
| #25 | Shipment     | Rerate not forwarding auth token to partner service (401)             | Mar 2026   |
| #26 | Shipment     | Rerate tracking event used non-existent RERATE_RESOLVED status        | Mar 2026   |
| #27 | Shipment     | Rerate quoteSnapshot not updated (stale charges summary)              | Mar 2026   |
| #28 | Shipment     | Cancel order missing wallet refund for PREPAID                        | Mar 2026   |
| #29 | Partner      | DelhiveryAdapter falling back to env vars instead of channel config   | Mar 2026   |
| #30 | Frontend     | Skeleton.tsx case mismatch breaking Linux production builds           | Mar 2026   |
| #31 | Frontend     | Charges management multiple requests causing 429 rate limit errors    | Mar 2026   |
| #32 | API Gateway  | Refresh public path typo `/auth/refresh-token` → `/auth/refresh`      | Jul 2026   |
| #33 | Frontend     | Login↔dashboard redirect ping-pong (pre-hydration auth guard race)    | Jul 2026   |
| #34 | Frontend     | No token refresh anywhere — every 401 forced logout                   | Jul 2026   |
| #35 | Frontend     | `hydrate()` trusted localStorage without checking JWT `exp`           | Jul 2026   |
| #36 | Frontend     | errorMiddleware hard-redirected on every 401, leaving cookies stale   | Jul 2026   |
| #37 | Frontend     | Login form reappeared submittable during the post-login navigation    | Jul 2026   |

## Changelog

### August 2026

```
[2026-08-07] Landing Page Migrated to "Subsolution" Scroll-Deck Design - COMPLETE
  Need: replace the old teal-brand single-file landing page (488-line
        src/app/page.tsx + scoped BRAND_CSS) with the approved dark-glass
        design from the claude.ai/design project "Logistics Aggregator
        Landing Page" (file "Subsolution Landing Page.dc.html").

  Shipped: src/components/landing/* — 9-panel 3D scroll deck on desktop
        (9×100vh scroll-snap spacers + fixed perspective viewport; rAF loop
        writes panel transforms/opacity/z/visibility straight to DOM refs,
        design's exact math; PanelFit scales overflowing panels on short
        screens), stacked scrollable document on <1024px and for
        prefers-reduced-motion (also the SSR render — deck upgrades after
        mount via useSyncExternalStore media query). Content-only section
        components (hero w/ mock dashboard, courier marquee, calculator,
        8-step journey, platform, setup, roles, FAQ via shadcn Accordion,
        get-started+footer) consumed by both layouts from one SECTIONS
        registry. Floating pill header, right dot-nav, scroll hint.
        html.landing-snap class toggled by effect so snap never leaks to
        other routes. Fonts: Space Grotesk / IBM Plex Sans / IBM Plex Mono
        via next/font variable mode in layout.tsx (inert for rest of app).
        New app-wide favicon src/app/icon.svg (design's SUB mark).
        page.tsx now a thin server component with Subsolution metadata.

  Calculator: DistanceDemo reused with ZERO code changes — landing-css.ts
        (.sland scope) redefines the same utility classes/vars the old
        BRAND_CSS exposed (card/mono/tink/t2/tmut/brd/btnb/tbrand/gtext,
        --brand/--panel/--line/...) in the new orange-glass values, so the
        wired /api/v1/geography/* calculator restyled itself.

  Note: design's hero background photo couldn't be exported (DesignSync
        256KiB cap) — background.tsx renders a complete gradient/blob/grid
        look standalone and auto-enables the photo layer (34s drift) once
        public/landing/hero-bg.jpg is dropped in from the design project.
        Design copy kept verbatim except "ten beats" → "eight beats"
        (design ships 8 journey steps). CTAs: Get Started/Start shipping →
        /auth/register, Log In → /auth/login (old page sent both to login).

  Verified: yarn type-check clean for all new/touched files (only the
        pre-existing shipmentApi.ts Params|void errors remain), hot reload
        via bind mount served the new page (title/hero/wordmark curl-
        checked), geography API round-trip 110001→400001 = 1166.57km,
        no MODULE_NOT_FOUND / no new warnings in container logs.

[2026-08-04] Booking Wizard — Mockup Parity (address book, billing, boxes/invoices sync) - COMPLETE
  Need: the 3-step wizard diverged from book_shipment_form_v2.html: plain
        native selects instead of searchable dropdowns, delivery as a manual
        inline form, no billing address slot, add-address modal was create-
        only (no edit/type-picker/defaults/pincode-autofill), no box-count
        input driving dimension+invoice rows, plain outlet select. Locked
        decisions: box count drives invoices too (B2B; B2C stays 1/1),
        billing gets full backend support (default same-as-delivery),
        delivery becomes select-only from the address book.

  Backend (Part A, done+curl-verified before this session): user-service
        addressType Joi enum extended to GENERAL|PICKUP|RETURN|DELIVERY|
        BILLING (no migration — VarChar(50) column). shipment-service gained
        billingSameAsDelivery/billing*/deliveryAddressId/rtoAddressId/
        billingAddressId columns (one migration) + Joi + controller write-
        through (same-as copies deliveryAddress; explicit billing stored).

  Shipped (Parts B-F, frontend): components/ui/searchable-select.tsx (generic
        autocomplete, modeled on the addresses/page.tsx hand-rolled idiom);
        hooks/useShipmentAddresses.ts (shared my-vs-outlet dual-fetch,
        replacing triplicated logic in address-section/confirm/partners);
        components/shipments/create/step1/address-picker.tsx (reusable 4-slot
        picker: searchable select + summary card with type/default badges +
        edit pencil + Add New Address); address-modal.tsx rewritten for
        create+edit with 5-type select and pincode autofill via
        usePincodeAutoFill; address-section.tsx rewritten to 4 slots (pickup/
        RTO same-as-pickup with the re-check-mirroring bug fixed/delivery
        select-only syncing legacy store fields/billing same-as-delivery).
        Store gained deliveryAddressId, billingSameAsDelivery, billingAddressId,
        numberOfBoxes + setNumberOfBoxes(count) (clamps 1-100, grows/trims
        boxes[] and — B2B only — invoices[] together), dimensionUnit.
        docket-section.tsx: outlet select is now searchable (client filter +
        debounced server search fallback via useLazyListOutletsQuery); "Number
        of boxes" input added (B2B editable, B2C locked); outlet-change
        cascade extended to clear all 4 address ids + both same-as flags.
        dimensions-section.tsx: rows auto-render from boxes[] (Add-Box button
        removed), column order fixed to L/W/H, Cm/Inch unit selector added
        (unitToCmFactor() shared by partners+confirm payload builders so
        quote and create dimensions stay consistent). invoice-payment-
        section.tsx: B2B rows now count-driven (Add/Delete removed, reconciled
        against numberOfBoxes); B2C unchanged. confirm/page.tsx + partners/
        page.tsx: migrated to useShipmentAddresses; confirm sends
        billingSameAsDelivery/billingAddress/three provenance ids; vasSelections
        +quoteToken flow left byte-identical (HMAC-checked). Fixed app/
        outlets/page.tsx (5 real enum values, real isDefaultPickup/
        isDefaultReturn checkboxes, dropped dead HOME/WORK/OTHER + isDefault)
        and app/addresses/page.tsx (DELIVERY+BILLING in type select + badge).
        outletApi.ts CreateAddressRequest/UpdateAddressRequest now use a
        proper AddressType union; shipmentApi.ts CreateShipmentRequest gained
        the billing + provenance fields.

  Verified: tsc --noEmit clean except the pre-existing documented
        shipmentApi.ts Params|void errors (untouched, unrelated). curl-
        confirmed outlet c9b85b1a-3144-4d22-aa88-74633b6cbc60 has live
        DELIVERY ("Kharghar Consignee") and BILLING ("HO Billing") addresses
        matching the new UI's expected shapes. Production build
        (NODE_ENV=production yarn build) compiled successfully; container
        restarted clean.
```

```
[2026-08-04] Charges Engine v3 — remaining admin/outlet frontend - COMPLETE
  Need: charges-engine v3 (below) shipped backend-first + a booking-wizard
        pass; still missing was the admin UI for the new ChargeDefinition/
        PartnerChargeConfig/AiChargeSuggestion models, plus the outlet-facing
        earnings ledger and markup preference, plus removal of the three
        frontend routes whose backends now 410.

  Shipped: app/earnings/page.tsx (summary tiles + paginated/status-filtered
        ledger, outlet/client/admin); components/outlets/markup-settings-card
        .tsx (FLAT/PERCENTAGE + value, admin caps shown, 400 MARKUP_CAP_
        EXCEEDED surfaced, rendered atop /earnings for outlet role);
        app/charge-definitions/page.tsx (catalog table, Sheet drawer with
        pretty-printed JSON blocks, isActive Switch → PUT); app/charge-configs
        /page.tsx (partner-scoped config CRUD via JSON textareas + client
        JSON.parse validation; AI Assist panel — draft-from-text → review →
        approve/reject; suggestion inbox; anomaly-scan button with severity-
        colored findings; 503 AI_UNAVAILABLE degrades gracefully everywhere).
        chargesApi.ts extended with the full v3 admin RTK surface; baseApi.ts
        tagTypes gained ChargeDefinition/ChargeConfig/AiSuggestion.
        Deleted app/charges/, app/charges-types/, app/charge-discount-
        packages/ (410 backends); patched the dashboard stat tile and sidebar
        /routePermissions.ts references that would otherwise have dangled.

  Backend fix en route: partner-service's getAllPartners/getPartnerById/
        createPartner/updatePartner still selected _count on relations
        (rates/chargeRules/chargesTypes) dropped by the v3 migration, 500ing
        GET /api/v1/partners outright and blocking the new partner picker —
        fixed to select chargeConfigs instead.

  Verified: yarn type-check clean (only the pre-existing shipmentApi.ts
        Params|void narrowing bug remains, untouched); yarn build clean with
        the three new routes present and the three deleted ones absent from
        the route manifest; both logistics-frontend and logistics-partner-
        service restarted.

[2026-08-04] Charges Engine v3 — complete redesign, AI-powered - COMPLETE
  Need: two overlapping pricing generations (external-API G1 with silent
        fallbacks + hardcoded 2% COD, and the ChargeRule G2 engine) with a
        rigid rule schema; no VAS charges, no outlet markup, and a booking
        flow that trusted the client-supplied quoteSnapshot for the wallet
        debit.

  Decision (user): hybrid AI architecture. A deterministic engine prices every
        quote from a dynamic JSON config catalog; DeepSeek is the config brain
        (NL → draft configs, legacy import, quote explanation, COD-risk,
        anomaly scan) and is never in the quote path. Hard drop of both old
        engines (export-first); outlet markup added to totals + earnings
        ledger; booking secured with HMAC quote tokens.

  partner-service: ChargeDefinition/PartnerChargeConfig/ChargeConfigVersion/
        AiChargeSuggestion models; 36-definition seeded catalog (incl. EVENT
        charges priced via POST /api/partners/event-charge-quote);
        services/chargeEngine/* (conditionEvaluator, calculators, aggregator,
        phase pipeline 100..900 with fuel-over-fuelApplicable and GST-last);
        quoteService replaces quoteCalculationService (envelope preserved +
        pricing/requiredQuestions/engine; totalRate now GST-INCLUSIVE);
        /api/v1/charge-definitions + /charge-configs CRUD with versioning,
        referential JSON validation, Redis config-revision cache busting;
        /api/v1/charge-configs/ai/* (draft-from-text, import-legacy,
        suggestions inbox approve/reject, explain-quote, cod-risk,
        anomaly-scan) via shared/lib/aiClient.js (AiUnavailableError,
        graceful degradation verified).
        DROPPED: charge_rules, charges_types, charge_discount_packages(_items),
        partner_rates, Partner.baseRate/perKgRate/codChargePercent/
        fuelSurcharge; G1+G2 service/controller/route files deleted; old
        admin endpoints 410.

  shipment-service: quoteSigningService (HMAC tokens, 15min TTL, vasHash) —
        wallet debit now comes from verified claims (tamper hole closed,
        tested); vasSelections flow quotes→create→rerate; Shipment split
        columns systemCharge/markup*/codBaseAmount/vasSelections;
        OutletEarning ledger (ACCRUED on create tx, CANCELLED on cancel tx);
        GET /shipments/earnings(+/summary). COD cap now applies to
        base+markup sum.

  user-service: Outlet default markup + admin caps; PUT /outlets/me/markup,
        PUT /outlets/:id/markup-limits; internal outlet payload carries
        markup fields.

  frontend: booking wizard rebuilt as 3-step flow (details/partners/confirm)
        per book_shipment_form_v2.html with dynamic VAS section rendered from
        the booking-questions catalog, markup input, quote tokens, AI
        "Why this price?" — see activeContext entry.

  Tests: 25 engine unit tests + 7 signing tests, all green; full curl matrix
        (tamper, caps, COD sums, earnings, cancel) verified in Docker.

  Migrations (applied via migrate diff → db execute → migrate resolve, since
        the shadow DB is broken by a historical db push):
        partner-service 20260804000000_charges_engine_v3_additive,
        20260804010000_charges_engine_v3_drop_legacy;
        shipment-service 20260804020000_markup_split_and_outlet_earnings;
        user-service 20260804020000_outlet_markup_preferences.
```

### July 2026

```
[2026-07-31] Charge Rule Base: COD_VALUE - COMPLETE
  Need: percentage charges could only be computed against the invoice/declared value.
        COD collection fees in Indian courier pricing are a % of the COD amount
        collected, which differs from invoice value whenever part of an order is
        prepaid/discounted or the invoice includes non-collected items.

  Decision: COD_VALUE mirrors INVOICE_VALUE exactly (minValue + percentageValue,
            linked to a ChargesType or PincodeType). Only the multiplied amount
            differs. Rules apply ONLY when payment mode is COD; prepaid shipments
            get no line item at all.

  No new columns: COD_VALUE reuses min_value / percentage_value / charges_type_id /
  pincode_type_id. Schema change is the enum member alone.
  Migration: 20260731000000_add_cod_value_charge_rule_base
             ALTER TYPE "ChargeRuleBase" ADD VALUE 'COD_VALUE' AFTER 'INVOICE_VALUE'

  partner-service chargesRuleCalculationService.js:
  - calcCodValue(rule, codAmount) — max(minValue, pct% × codAmount)
  - shouldIncludeRule: base-level COD gate checked BEFORE the name-based semantic
    gates, so a COD_VALUE rule is COD-only regardless of its charges-type name
  - REFACTOR: computeRuleCharge(rule, base, ctx) — was 7 positional args, now a
    single ctx object {effectiveWeight, invoiceValue, codAmount, distanceMilestoneId,
    pickupZoneIds, deliveryZoneIds}. All 3 call sites updated. Adding an 8th
    positional arg was the alternative; the object stops that drift.

  quoteCalculationService.js: chargeContext gains
    codAmount: paymentType === "COD" ? codAmount || 0 : 0
  codAmount was ALREADY plumbed shipmentController → partnerIntegrationService →
  partnerController → calculateRates (and already in the quote cache key); it just
  stopped one line short of the engine.

  Also: chargesSchemas.js (percentageBases array drives the Joi .when + XOR check),
  chargesService.js create path, swagger enum, chargesApi.ts union,
  charges/page.tsx (isPercentageBase helper replaces scattered === "INVOICE_VALUE"),
  charge-discount-packages/page.tsx labels, shipmentController BASE_LABELS + re-rate
  naming map.

  Verified: 9/9 Joi cases; engine priced COD_VALUE ₹60 on codAmount=3000 (NOT ₹100
  from invoiceValue=5000), min floor ₹35 at codAmount=100, absent on PREPAID;
  INVOICE_VALUE ₹100 + WEIGHT ₹90 + COD_VALUE ₹60 = ₹250 together (refactor
  regression); ctx produced-vs-consumed key sets match 6/6. Frontend build clean.
  NOTE: no unit tests exist for the charge engine — verification was manual.
```

```
[2026-07-31] Auth Session Hydration + Transparent Token Refresh - COMPLETE
  Bug: cold open → login → dashboard flash → back to login "session expired".
       Same on direct /dashboard. Refresh tokens were never used at all.

  API Gateway:
  - authValidator.js publicPaths: "/api/v1/auth/refresh-token" → "/api/v1/auth/refresh"
    (isPublicPath matches by startsWith; the old entry is not a prefix of the real
     route, so refresh required a live JWT and was unreachable once one expired)

  Frontend - new lib/auth/token.ts:
  - decodeJwt / getTokenExpiryMs / isTokenExpired (30s skew) / isTokenValid
  - setAuthCookies (max-age from the REFRESH token's exp, not a hardcoded 24h)
  - clearAuthCookies / clearStoredAuth (single teardown for localStorage + cookies)

  Frontend - store/api/baseApi.ts (baseQueryWithReauth):
  - Pre-emptive refresh when access token expired but refresh token still live
  - Reactive refresh + single retry on 401; NO_REAUTH_ENDPOINTS exempt
    (login/register/refresh/forgot/reset - their 401 IS the answer)
  - Single-flight module-level refreshPromise (backend rotates the refresh token,
    so concurrent refreshes would invalidate each other)
  - prepareHeaders falls back to localStorage before hydration lands
  - Definitive failure only: logout + one toast + one location.replace to
    /auth/login?expired=1&redirect=…, guarded so anonymous 401s stay silent

  Frontend - authSlice.ts:
  - New isHydrated flag + selectIsHydrated (guards must not act before it flips)
  - hydrate() validates JWT exp; expired access + live refresh = still authenticated;
    neither valid → purge localStorage AND cookies
  - New setTokens reducer for rotated pairs; setCredentials/logout own all
    persistence (login transformResponse no longer writes localStorage/cookies)

  Frontend - guards & pages:
  - ProtectedRoute: spinner until isHydrated, router.replace + useRef once-guard
  - useAuth: exposes isHydrated, isLoading includes !isHydrated,
    requireAuth/redirectIfAuthenticated no-op until hydrated
  - AuthHydration: no longer writes document.cookie (authSlice owns it)
  - errorMiddleware: returns early on 401, no toast, no redirect
  - login page: honours ?redirect=, shows notice on ?expired=1, gated on isHydrated;
    isRedirecting state keeps the button spinning across the navigation (the
    mutation settles long before the route loads) + router.prefetch(redirectTo)
  - middleware.ts: removed dead duplicate !token check; documented as a
    presence check only (Edge cannot verify a JWT cheaply)

  Verified: refresh 200 with no Authorization header (was 401 NO_TOKEN); rotated
  token authorizes /api/v1/zones 200; invalid → INVALID_REFRESH_TOKEN; missing body
  → 400 validation; /auth/refresh-token now 404; frontend build clean 52/52 pages;
  /dashboard without cookie → 307 /auth/login?redirect=%2Fdashboard.

  Noted, not fixed: refresh tokens sign only {userId} so two issued in the same
  second are byte-identical (rotated-out tokens can still validate) - add a jti if
  strict reuse detection is ever needed. Token storage stays in localStorage by
  decision; httpOnly-cookie migration deferred.
```

### March 2026

```
[2026-03-28] Revalue Charges + Partner Eligibility + Charges Engine Fixes - COMPLETE
  Shipment Revalue Charges Feature:
  - Admin/Superadmin-only "Revalue Charges" button on shipment detail for CREATED/BOOKED/PICKED_UP/IN_TRANSIT
  - Re-rate flow: new weight/dimensions → partner service recalculates → wallet debit/refund or COD update
  - skipServiceabilityCheck flag: bypasses pincode/zone checks for existing shipments
  - quoteSnapshot.chargeBreakdown overwritten with fresh rerate breakdown
  - Cancel order refund: wallet refund for PREPAID shipment cancellations
  - Tracking event: uses shipment.status (not RERATE_RESOLVED) to avoid invalid transitions
  - Auth token correctly forwarded to partner service during rerate
  - Frontend: COD action choice (DEDUCT_WALLET / UPDATE_COD) for COD shipments

  Partner Eligibility Fixes:
  - Strict partner filtering: BOTH pickup AND delivery must have PartnerPincodeAssign + zone coverage
  - hasPincodeAssignment() and hasZoneCoverage() helper functions added to quoteCalculationService
  - Removed zoneServices references from zoneCoverageValidationService (PrismaClientValidationError)

  Charges Engine Fixes:
  - New typeNameNormalizer.js: canonicalTypeName() maps COD/cod/Cod → COD, FRGILE → FRAGILE, etc.
  - shouldIncludeRule() gates charges by context: COD→COD payments, FRAGILE→fragile items
  - isPincodeTypeActive() accepts yes/y/true/1 variants
  - paymentType forwarded to chargeContext for conditional evaluation
  - Duplicate detection on PincodeType/ChargesType creation uses canonical names

  Delhivery Channel Cleanup:
  - Removed all process.env.DELHIVERY_* fallbacks from DelhiveryAdapter
  - Removed sellerGstTin from Joi schema, frontend, and adapter
  - clientName kept and properly used from channel config

  Charges Management Rate Limit Fix:
  - Frontend: isSubmitting guard, sequential for...of loop, debounced search, pagination reset
  - Backend: increased chargesManagementLimiter, added chargesReadLimiter

  Frontend Display Fixes:
  - Weight card: shows disputedWeight with original below
  - Value card: shows actual shipment.value or "—" (not ₹0)
  - COD Amount card: replaces Courier card for COD shipments
  - Charges Summary: reads from updated quoteSnapshot after rerate

  Production Build Fix:
  - Renamed Skeleton.tsx → skeleton.tsx in git (case-sensitivity mismatch broke Linux builds)

  Key Files Modified:
  - backend/partner-service/utils/typeNameNormalizer.js (NEW)
  - backend/partner-service/services/quoteCalculationService.js
  - backend/partner-service/services/chargesRuleCalculationService.js
  - backend/partner-service/services/chargesTypeService.js
  - backend/partner-service/services/pincodeTypeService.js
  - backend/partner-service/services/zoneCoverageValidationService.js
  - backend/partner-service/controllers/partnerController.js
  - backend/partner-service/validation/partnerSchema.js
  - backend/partner-service/validation/partnerChannelSchemas.js
  - backend/partner-service/adapters/DelhiveryAdapter.js
  - backend/partner-service/middleware/rateLimiter.js
  - backend/partner-service/routes/charges.js
  - backend/shipment-service/controllers/shipmentController.js
  - backend/shipment-service/services/partnerIntegrationService.js
  - backend/shipment-service/validation/shipmentSchemas.js
  - frontend/src/app/shipments/[id]/page.tsx
  - frontend/src/app/charges/page.tsx
  - frontend/src/app/partners/[id]/channels/page.tsx
  - frontend/src/store/api/endpoints/shipmentApi.ts
  - frontend/src/store/api/endpoints/partnerChannelApi.ts
  - frontend/src/components/ui/skeleton.tsx (renamed from Skeleton.tsx)

[2026-03-24] Shipment Lifecycle Expansion + Delhivery Fix - COMPLETE
  Phase 1: Dynamic Provider Capability Contract
  - BaseCourierAdapter: getCapabilities() + getAvailableActions(shipmentContext) abstract methods
  - DelhiveryAdapter: 11 capabilities (track, label, cancel, pickup, manifest, edit, ndr, ewaybill, pod, refresh, webhook)
  - BlueDartAdapter: 6 capabilities (track, label, cancel, pickup, manifest, refresh)
  - courierOperationService.getShipmentCapabilities() + POST /capabilities endpoint
  - getCapabilitiesSchema Joi validation

  Phase 2: Schema & Persistence Expansion
  - Shipment model: +9 fields (providerStatus, providerLastSyncAt, providerRawResponse, courierLabel*, pickup*)
  - New ShipmentDocument model (type: LABEL, MANIFEST, INVOICE, POD, EWAYBILL, OTHER)
  - PartnerShipment model: +6 fields (providerStatus, providerLastSyncAt, providerRawResponse, courierLabelUrl, pickup*)
  - Manual migrations for both services (Docker non-interactive env)

  Phase 3: Shipment Lifecycle Endpoints
  - POST /:id/refresh — fetch latest tracking from provider, update local DB + create TrackingEvents
  - POST /:id/courier-label — fetch label, store as ShipmentDocument (upsert), return data
  - POST /:id/cancel-with-provider — provider-first cancel flow, then internal status update
  - GET /:id/documents — list all ShipmentDocuments for a shipment
  - getShipmentById enriched with providerCapabilities + documents
  - partnerIntegrationService: getProviderCapabilities(), cancelWithCourierFirst(), refreshFromProvider()
  - Joi schemas: refreshFromProviderSchema, fetchCourierLabelSchema, cancelWithProviderSchema

  Phase 4: Global Webhook Ingestion
  - POST /api/v1/shipments/webhook/:provider — public endpoint (no JWT)
  - AWB extraction per provider type (delhivery/bluedart/generic)
  - Event normalization: status, message, location, timestamp
  - Updates Shipment record + creates TrackingEvent + AuditLog
  - API Gateway: /api/v1/shipments/webhook added to publicPaths in authValidator.js

  Phase 5: Dynamic Frontend UI
  - Quick Actions rendered from availableActions (refresh, track, label, cancel, edit, pickup)
  - Download Label: base64 decode → Blob → download trigger
  - Cancel with Provider: confirmation modal → provider-first flow
  - Documents section + Provider Sync Status card
  - 4 new RTK Query endpoints + 6 TypeScript interfaces

  Phase 6: Delhivery Critical Fixes
  - cancelOrder: cancellation: "true" (string) instead of boolean true
  - cancelOrder: validate response.status === true, handle "already cancelled", throw PROVIDER_CANCEL_REJECTED
  - trackShipment: extract statusInstructions + statusCode from Status object
  - normalizeStatus: check Instructions for "cancelled"/"canceled" + StatusCode "DTUP-210"
  - Removed X-UCI from cancellation codes (incorrect mapping)
  - normalizeTrackingEvents: pass scanInstructions + scanStatusCode to normalizeStatus
  - Terminal status protection: CANCELLED/DELIVERED/RTO never downgraded by refreshFromProvider
  - Warehouse: removed registered_name, added country: "India"
  - Payload: payment_mode: "Prepaid", products_desc, String() pincode casts
  - Channel validation: clientName + sellerGstTin required for DELHIVERY
  - Redis v4: setex→setEx in BaseCourierAdapter.setCachedResponse()

  Key Files Modified:
  - backend/partner-service/adapters/BaseCourierAdapter.js
  - backend/partner-service/adapters/DelhiveryAdapter.js
  - backend/partner-service/adapters/BlueDartAdapter.js
  - backend/partner-service/controllers/courierOperationController.js
  - backend/partner-service/services/courierOperationService.js
  - backend/partner-service/routes/courierOperations.js
  - backend/partner-service/validation/courierOperationSchemas.js
  - backend/partner-service/validation/partnerChannelSchemas.js
  - backend/partner-service/prisma/schema.prisma (+migration)
  - backend/shipment-service/controllers/shipmentController.js
  - backend/shipment-service/routes/shipments.js
  - backend/shipment-service/services/partnerIntegrationService.js
  - backend/shipment-service/validation/shipmentSchemas.js
  - backend/shipment-service/prisma/schema.prisma (+2 migrations)
  - backend/api-gateway/middleware/authValidator.js
  - frontend/src/app/shipments/[id]/page.tsx
  - frontend/src/store/api/endpoints/shipmentApi.ts

[2026-03-17] End-to-End Shipment Creation Flow - COMPLETE
  Shipment Service (backend):
  - Multi-step creation: Docket → Dimensions → Delivery → Invoice → Review & Book
  - B2B/B2C support: conditional box/invoice handling
  - resolveOutletContext: uses outlet phone (not UUID) for wallet userId
    - outlet role: req.user.phone from JWT
    - admin/superadmin: req.body.outletUserId (phone number from frontend)
  - shipmentSchemas.js: outletUserId changed from Joi.string().uuid() to Joi.string()
  - paymentProcessingService.js: REWRITTEN to use wallet admin endpoints
    - /api/v1/wallet/admin/wallet (balance check)
    - /api/v1/wallet/admin/debit (payment)
    - /api/v1/wallet/admin/refund (refund)
    - Added X-Internal-Request header with INTERNAL_SECRET
  - quoteSnapshot now stores full PartnerQuote (chargeBreakdown + discount)
  - Redis v4 fix: setex() → setEx() in paymentProcessingService, trackingService

  Wallet Service (backend):
  - walletService.js: Fixed redis.setex → redis.setEx (Redis v4)
  - externalWalletClient.js: Fixed redis.setex → redis.setEx (Redis v4)
  - Admin endpoints correctly interface with external wallet API using phone + clientCode

  Frontend:
  - shipment-form-store.ts: Added outletUserId, isFragile fields
  - docket/page.tsx: Outlet selection stores outlet.phone as outletUserId; fragile checkbox
  - review/page.tsx: Sends outletUserId/isFragile/outletId in payloads; shows discount
  - shipmentApi.ts: Updated CreateShipmentRequest + PartnerQuote interfaces
  - shipments/[id]/page.tsx: Invoice-style charge breakdown, discount badge + "You saved" line

  Critical Bug Fixes:
  - Fixed: 403 "Direct access attempt blocked" — added X-Internal-Request header
  - Fixed: "Insufficient balance ₹0" — external wallet API uses phone, not UUID
  - Fixed: Admin shipment creation needed outlet phone for wallet
  - Fixed: redis.setex is not a function — Redis v4 requires setEx()
  - Fixed: Charge breakdown missing on detail page — quoteSnapshot now stores full data

[2026-03-07] Partner Channel System Cleanup & Polish - COMPLETE
  Database (partner-service):
  - Removed AggregatorType enum from Prisma schema
  - Changed aggregatorType field from enum to String @default("NONE") @db.VarChar(50)
  - Added @default("") to apiUrl and apiKey in PartnerChannelConfig
  - Migration via prisma db push (non-destructive, preserves existing values)

  Backend (partner-service):
  - partnerChannelSchemas.js: ALLOWED_AGGREGATOR_TYPES = ['DELHIVERY', 'BLUEDART'], aggregatorType required
  - partnerSchema.js: Removed channelMode and channelConfigs from create/update schemas
  - partnerChannelService.js: Added _syncChannelMode(partnerId) — auto-sets SINGLE/MULTI based on count
  - Removed: switchChannelMode() from service, controller, and routes
  - Removed: PATCH /partners/:partnerId/channel-mode route

  Frontend (RTK Query):
  - partnerChannelApi.ts: AggregatorType changed to string; removed switchChannelMode mutation
  - partnerChannelApi.ts: updateChannel/deleteChannel now accept partnerId for proper tag invalidation
  - partnersApi.ts: channelMode changed to string (read-only, auto-computed)
  - baseApi.ts: Removed verbose console.logs and dead transformResponse from fetchBaseQuery

  Frontend (Partner Detail Page - partners/[id]/page.tsx):
  - Removed "API Config" tab → replaced with "Channels" tab showing channel cards
  - Removed legacy fields: API Endpoint, API Version, API Token, Auth Status, channelMode badge
  - Removed duplicate Channel Configuration section from Overview
  - Consolidated actions: single Edit button + one ⋮ dropdown with Manage/Status/Danger groups
  - Removed backHref (breadcrumbs handle navigation)
  - Removed all 3 redundant refetch() calls (RTK Query tag invalidation handles auto-refetch)

  Frontend (Manage Channels Page - partners/[id]/channels/page.tsx):
  - Only DELHIVERY and BLUEDART in AGGREGATOR_OPTIONS
  - Default aggregatorType: "DELHIVERY"
  - ChannelCard redesigned: hover-reveal ⋮ dropdown, credential status with color-coded Key icon
  - Removed manual refetch() calls
  - Removed back button (breadcrumbs handle navigation)

  Frontend (Shared Components):
  - detail-page.tsx: Made backHref optional; wrapped <Link> in conditional

  Frontend (Cleanup):
  - Deleted: partners/add/page.tsx (dead wizard page)
  - Deleted: partners/[id]/edit/page.tsx (dead wizard page)
  - dashboard/page.jsx: Changed /partners/add links to /partners
  - routePermissions.ts: Removed /partners/add and /partners/:id/edit entries
```

### February 2026

```
[2026-02-21] Outlet Wallet Page - COMPLETE
  Backend (wallet-service):
  - New outletWalletController.js: getMyWalletInfo, getMyTransactionHistory, getMyTransactionStatistics
  - externalWalletClient.js: added getUserTransactionHistory(), getUserTransactionStatistics()
  - routes/wallet.js: added /my/wallet-info, /my/transactions, /my/statistics (wallet:read:own permission)
  - Uses req.user.phone as wallet userId (phone number = external wallet user ID)
  - Fixes: shared Redis init in config/redis.js, setex→setEx (Redis v4), getEffectivePermissions JWT fallback

  Backend (auth-service):
  - Added phone: user.phone to JWT tokenPayload in authController.js login endpoint

  Backend (shared):
  - shared/constants/permissions.js: added wallet:read:own to outlet role
  - shared/lib/auth.js: fixed setex→setEx (Redis v4), added JWT permission fallback in getEffectivePermissions

  Frontend:
  - wallet/page.jsx: added OutletWalletView component with balance card (gradient), stats row
    (topups/debits/refunds), 30-day summary bar, paginated transaction table with type badges
  - Role-based routing: WalletPage checks user.role, renders OutletWalletView or AdminWalletPage
  - Loading guard (isLoading || !user) prevents AdminWalletPage from mounting for outlet users
  - walletApi.ts: 3 new RTK Query endpoints (getMyWalletInfo, getMyTransactions, getMyStatistics)
  - authSlice.ts + authApi.ts: added phone field to User interface
  - sidebar.jsx: added outlet to wallet nav item roles

[2026-02-21] Outlet User Login & Dashboard Fix - COMPLETE
  Problem:
  - Outlet users saw admin dashboard → 403 errors on /partners, /zones, /charges-types APIs
  - Sidebar only showed Dashboard — Shipments and My Addresses missing

  Root Cause:
  - Dashboard page called admin API hooks for all users regardless of role
  - Permissions from login response never dispatched to Redux permission slice
  - AuthHydration didn't restore permissions from localStorage on page reload
  - useRole hook missing 'outlet' role entirely

  Fixes:
  - dashboard/page.jsx: Split into AdminDashboard + OutletDashboard (role-based rendering)
  - useAuth.ts: dispatch(setPermissions()) after login with user.permissions from response
  - AuthHydration.tsx: hydrate permissions from localStorage user.permissions on mount
  - authSlice.ts: added permissions field to User interface
  - useRole.ts: added outlet to SystemRole enum, ROLE_HIERARCHY (40), ROLE_GROUPS, display names, badge colors
  - useAuth.ts: added outlet to canAccess map (dashboard, shipments, addresses)

[2026-02-21] Wallet Module Overhaul (Stateless External Proxy) - COMPLETE
  Backend (wallet-service):
  - Rewritten as stateless service — no local database, all data proxied from external wallet API
  - New adminWalletController.js: getClientWallets, getClientTransactions, getWallet,
    topupWallet, debitWallet, refundWallet, updateUserStatus, syncWallets
  - externalWalletClient.js: HMAC SHA-256 auth, circuit breaker (opossum), Redis caching,
    axios interceptors, 14 methods (listClientWallets, topup, debit, refund, etc.)
  - walletSchema.js: Added adminWalletTransactionSchema (with transaction_id for refunds,
    remarks as Joi.object()), adminClientWalletsQuerySchema, adminClientTransactionsQuerySchema,
    adminGetWalletQuerySchema, adminUpdateUserStatusSchema, adminSyncWalletsSchema
  - routes/wallet.js: CRITICAL FIX — moved /admin/* routes before /:userId/* routes
    (Express matched "admin" as userId param, causing UUID validation errors)
  - Batch sync: processes userIds in batches of 3 with 500ms delay between batches

  Frontend:
  - New walletApi.ts RTK Query: 8 endpoints (getClientWallets, getClientTransactions,
    getOrCreateWallet, topupWallet, debitWallet, refundWallet, updateWalletUserStatus, syncWallets)
  - wallet/page.jsx: Complete rewrite with Wallets/Transactions tabs
  - Stats cards, filter panels, paginated tables for both tabs
  - Modals: Topup, Debit, Refund (debit-only tx selection), UpdateStatus, CreateWallet, SyncWallets
  - RemarksBuilder component for dynamic key-value remarks
  - Outlet name resolution via outletMap (phone → name lookup)
  - UI polish: header buttons grouped (utility | transactions) with divider
  - Transaction type badges: pill-shaped with icons (TrendingUp/TrendingDown/RotateCcw)
  - Dark-mode friendly: opacity-based colors (emerald-500/10, red-500/10, blue-500/10)
  - Fixed: metadata now sent as plain string (external API expects string, not object)
  - Fixed: refund dropdown only shows DEBIT transactions (removed TOP_UP)
  - Fixed: amount max 10,000 per transaction (external API limit) — added max="10000" on frontend input
  - Fixed: externalWalletClient.js now surfaces actual validation_errors from external API response
    instead of generic "Invalid request parameters" message
  - Fixed: walletSchema.js metadata field accepts both string and object (Joi.alternatives)
  - Sidebar: wallet link added

  Docker:
  - Updated docker-compose.yml, docker-compose.backend.yml, docker-compose.production.yml

[2026-02-17] Charge Discount Packages - COMPLETE
  Backend (user-service):
  - Created internalOutletController.js with getOutletByUser function
  - Added GET /api/v1/internal/outlets/by-user/:userId route

  Backend (partner-service):
  - Prisma: DiscountType enum, ChargeDiscountPackage model (@@unique partnerId+badge), ChargeDiscountPackageItem model
  - Prisma: Added partner relation on ChargeDiscountPackage + discountPackages on Partner
  - Created chargeDiscountPackageService.js (CRUD + getActivePackageForBadge)
  - Created chargeDiscountPackageController.js, chargeDiscountPackageSchemas.js, chargeDiscountPackages.js (routes)
  - Created outletContextService.js (resolves outlet badge via user-service, Redis-cached 5min TTL)
  - Modified quoteCalculationService.js: outlet badge resolution, per-rule discounts (FLAT/PERCENTAGE), cache skip for badge users
  - Valid badges: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND (no BASIC — no discounts for base tier)

  API Gateway:
  - Added /api/v1/charge-discount-packages proxy to partner-service

  Frontend:
  - Created chargeDiscountPackagesApi.ts RTK Query endpoints (5 endpoints)
  - Added ChargeDiscountPackage tag to baseApi.ts
  - Created /charge-discount-packages page with CRUD modals + charge rule info display
  - Added sidebar link (Tag icon, superadmin/admin) and route permission
  - Fixed: limit capped at 100 to match backend validation

[2026-02-14] Charges Management Module (Hard Replace) - COMPLETE
  Backend (partner-service):
  - Created ChargeRule Prisma model with 3 enums (ChargeRuleKind, ChargeRuleBase, ChargeCalcType)
  - Created chargesController.js, chargesService.js, chargesSchemas.js (Joi), charges.js (routes)
  - Created chargesRuleCalculationService.js (calculation engine)
  - Refactored quoteCalculationService.js to use new ChargeRule engine
  - Added chargesManagementLimiter (30 req/15 min)
  - Audit logging for all CRUD operations
  - Migration: 20260214_add_charge_rules_remove_charge_packages

  API Gateway:
  - Added /api/v1/charges proxy to partner-service
  - Removed legacy charge-packages proxy

  Frontend:
  - Created /charges page (page.tsx) with table + filters + modal CRUD + conditional form
  - Created chargesApi.ts RTK Query endpoints with transformResponse
  - Added Charges Management sidebar link (superadmin/admin only)
  - Updated routePermissions.ts

  Legacy Cleanup (Hard Replace):
  - Deleted: chargePackageService.js, chargePackageController.js, chargePackageSchemas.js
  - Deleted: chargePackages.js (route), chargePackagesApi.ts (RTK)
  - Removed ChargePackage model + 3 enums from Prisma schema
  - Removed ChargePackage tag from baseApi.ts
  - Updated partner _count references from chargePackages → chargeRules
  - Removed chargePackageManagementLimiter from rateLimiter.js

  Bug Fixes:
  - Fixed RTK Query data access: added transformResponse to unwrap { status, data, meta } envelope
  - Fixed page data paths for partners, chargesTypes, pincodeTypes, zones
  - Fixed APIResponse.success() meta: string → { message: "..." } to prevent char spread

[2026-02-14] Pincode Search Unification (Phase 1) - COMPLETE
  Backend:
  - Canonical endpoint confirmed as GET /api/v1/geography/pincodes/search
  - Deprecated GET /api/v1/pincodes/search now adds Deprecation/Sunset/Link headers
  - Deprecated controller path switched to geography service-backed search
  - Deprecated query validation supports q or code with at-least-one rule
  - API Gateway logs structured warning events for deprecated endpoint hits

  Frontend:
  - Updated partner pincode autocomplete endpoint to geography search path
  - Added transformResponse normalization for envelope and unwrapped payload formats

[2026-02-14] Database Initialization Reliability Fixes - COMPLETE
  Infrastructure:
  - scripts/init-databases.sh now uses strict mode (set -euo pipefail)
  - Uses .env + docker-compose.yml in dev and .env.production + docker-compose.production.yml in production
  - Waits for service readiness with exec probes and deploys committed Prisma migrations only
  - Aborts on any failed service migration to prevent partial state

  Partner Service Migrations:
  - Fixed migration 20260129102803_create_charges_types (conditional ALTER on pincode_types.type)
  - Added missing migration file 20260206080310_create_partner_pincode_assigns/migration.sql
```

### January 2026

```
[2026-01-24] Audit Logging Enhancement - COMPLETE
  Backend Standardization:
  - Fixed user-service: lowercase actions → UPPERCASE_WITH_UNDERSCORES
    - create_profile → CREATE_PROFILE
    - update_profile → UPDATE_PROFILE
    - delete_profile → DELETE_PROFILE
    - get_profile → GET_PROFILE_BY_USER_ID
    - get_my_profile → GET_MY_PROFILE
    - verify_profile → VERIFY_PROFILE
    - toggle_profile_activation → ACTIVATE_PROFILE/DEACTIVATE_PROFILE
    - profile_stats → GET_PROFILE_STATS
  - Fixed partner-service: past tense → present tense
    - PARTNER_CREATED → CREATE_PARTNER
    - PARTNER_UPDATED → UPDATE_PARTNER
    - PARTNER_DELETED → DELETE_PARTNER
    - PINCODE_TYPE_CREATED → CREATE_PINCODE_TYPE
    - PINCODE_TYPE_UPDATED → UPDATE_PINCODE_TYPE
    - PINCODE_TYPE_DELETED → DELETE_PINCODE_TYPE
  - Fixed bootstrap controller:
    - signup → SIGNUP
    - rollback → ROLLBACK_BOOTSTRAP

  Shared Constants:
  - Created shared/constants/auditActions.js with 70+ actions
  - Organized into 18 categories: CRUD, AUTH, USER, PROFILE, CLIENT, OUTLET,
    ADDRESS, INVITATION, SHIPMENT, NDR, LABEL_MANIFEST, PICKUP, PARTNER,
    PINCODE, WALLET, LICENSE, SUPPORT, SYSTEM
  - Helper functions: getAllActions(), getActionsByCategory(), isActionInCategory()

  API Gateway:
  - Added GET /api/v1/audit-log-actions endpoint
  - LogsAggregationController.getAvailableActions() method
  - RBAC: includes superadmin, admin, client, accounts, sales, support roles
  - Returns categorized action lists for frontend dropdowns

  Frontend:
  - Added getAvailableAuditActions RTK Query endpoint (logsApi.ts)
  - Updated audit-logs page with category-based filtering
  - Category selector: All Categories, CRUD Operations, Authentication, etc.
  - Dynamic action filter: shows actions based on selected category
  - Expanded resource filter: 6 → 22 resource types
  - New resources: UserProfile, Outlet, Address, UserInvitation, PartnerChannel,
    PincodeType, PincodeTypeServiceCharge, WalletTransaction, PayoutRequest,
    LicenseActivation, SupportTicket, NDRCase, PickupSchedule, ShippingLabel, Manifest

  Infrastructure:
  - Updated .env PRODUCTION_ORIGINS to include localhost:3000 and localhost:3001
  - Rebuilt and restarted API Gateway
  - Restarted user-service and partner-service
  - Copied auditActions.js and updated controller to container

[2026-01-22] Frontend Docker Proxy Connection Fix - COMPLETE
  Infrastructure:
  - Fixed ECONNREFUSED ::1:3001 error in production frontend
  - Updated frontend/next.config.js rewrites destination
  - Changed from http://localhost:3001 to http://api-gateway:3001
  - Built new production image: logistics-frontend-prod:new
  - Deployed container on logistics-agrigator_logistics-network
  - Verified: Login works through frontend proxy (port 3000)
  - Verified: API calls route correctly to api-gateway container

[2026-01-22] Pincode Import Scripts Added - COMPLETE
  Root Package Scripts:
  - import:pincodes - Run import in dev environment
  - import:pincodes:prod - Run import in production
  - load:pincodes - Run load script in dev
  - load:pincodes:prod - Run load script in production
  - seed:geo - Seed geographical data (dev)
  - seed:geo:prod - Seed geographical data (production)

  Usage: yarn run import:pincodes:prod
  Command: docker-compose -f docker-compose.production.yml exec partner-service node scripts/import-pincode-data.js
```

```
[2026-01-15] Partner Channel Management Module - COMPLETE
  Backend:
  - Added ChannelMode enum (SINGLE/MULTI) to Prisma schema
  - Created PartnerChannelConfig model with UUID format
  - Created validation schemas (partnerChannelSchemas.js)
  - Created service layer with 6 methods:
    - getActiveChannel() - Get active channel for API calls
    - listChannels() - List all channels for a partner
    - createChannels() - Create multiple channels
    - updateChannel() - Update channel configuration
    - deleteChannel() - Delete a channel
    - switchChannelMode() - Switch between SINGLE/MULTI modes
  - Created controller with proper error handling
  - Created routes with RBAC (Admin + Operations)
  - Updated partner-service server.js to register routes
  - Complete audit logging for all operations

  Frontend:
  - Created RTK Query API endpoints (partnerChannelApi.ts)
  - Updated partner creation form with channel mode toggle
  - Added dynamic multi-channel form with add/remove
  - Added channel validation logic
  - Added review step for channel configuration
  - Updated baseApi.ts with PartnerChannel tag type

  Infrastructure:
  - Ran database migration via prisma db push
  - Generated Prisma client successfully
  - Restarted partner-service container
  - Built frontend successfully
  - Restarted frontend container

[2026-01-15] Pincode Type Service Charges Module - COMPLETE
  Backend:
  - Added PincodeTypeServiceCharge model (UUID-based, many-to-many)
  - Created validation schemas (pincodeTypeServiceChargeSchemas.js)
  - Created controller with 7 endpoints (CRUD + filtered queries)
  - Created service layer with Redis caching and transactions
  - Created routes file with auth middleware
  - Updated partner-service server.js to register routes
  - Updated API Gateway proxy configuration
  - Created shared DTO (pincodeTypeServiceChargeDto.js)

  Frontend:
  - Created RTK Query API endpoints (pincodeTypeServiceChargeApi.ts)
  - Created management page at /pincode-type-service-charges
  - Implemented statistics dashboard
  - Multi-select create dialog for types and partners
  - Edit dialog with type/partner/charge/status updates
  - Delete confirmation dialogs
  - Search and filter functionality
  - Added sidebar navigation link
  - Fixed partner data access (partnersData.data.partners)

  Infrastructure:
  - Ran database migration via prisma db push
  - Generated Prisma client
  - Restarted partner-service and api-gateway containers
  - Built frontend successfully
  - Restarted frontend container
```

```
[2026-01-03] Outlet module fully implemented
  - Backend: Outlet & OutletAddress models
  - Backend: CRUD + status toggle + password reset APIs
  - Frontend: Management page with modals
  - Frontend: RTK Query integration
  - Frontend: Geo-autocomplete for addresses
  - RBAC: New 'outlet' role with permissions
```

### December 2024

```
[2024-12-29] Memory Bank initialized
[2024-12-xx] API Gateway RBAC development completed
[2024-12-xx] License service schema created
[2024-12-xx] Frontend Redux migration initiated
```

### November 2024

```
[2024-11-xx] Auth service production ready
[2024-11-xx] User service production ready
[2024-11-xx] Partner service complete
[2024-11-xx] Wallet service complete
```

## Upcoming Milestones

| Milestone                     | Target Date | Status         |
| ----------------------------- | ----------- | -------------- |
| Outlet Module Complete        | Jan 2026    | ✅ Complete    |
| Charges Management Module     | Feb 2026    | ✅ Complete    |
| Outlet Portal Pages           | Feb 2026    | ✅ Complete    |
| Shipment Creation Flow        | Mar 2026    | ✅ Complete    |
| Shipment Lifecycle Expansion  | Mar 2026    | ✅ Complete    |
| Revalue Charges + Charges Fix | Mar 2026    | ✅ Complete    |
| License Service Integration   | Apr 2026    | 🔄 In Progress |
| Remaining Adapter Actions     | Apr 2026    | 📋 Planned     |
| Shipment Bulk Operations      | Apr 2026    | 📋 Planned     |
| Support Service MVP           | Apr 2026    | 📋 Planned     |
| Platform Service (Shopify)    | May 2026    | 📋 Planned     |
| Frontend Redux Complete       | May 2026    | 📋 Planned     |

## Metrics

### Code Coverage

| Service          | Coverage |
| ---------------- | -------- |
| Auth Service     | ~80%     |
| User Service     | ~80%     |
| Partner Service  | ~70%     |
| Wallet Service   | ~70%     |
| Shipment Service | ~60%     |

### API Documentation

| Service          | Swagger Docs |
| ---------------- | ------------ |
| Auth Service     | ✅ Complete  |
| User Service     | ✅ Complete  |
| Partner Service  | ⏳ Partial   |
| Wallet Service   | ⏳ Partial   |
| Shipment Service | ⏳ Partial   |

---

**Last Updated**: March 28, 2026
**Next Update**: Weekly or after major changes
**Maintainer**: Development Team
