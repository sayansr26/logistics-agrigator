# Progress - Logistics Aggregator Portal

> Development status and changelog | Last Updated: February 21, 2026

## Overall Project Status

```
Phase 1: Core Services & Auth     [█████████████████████] 97%
Phase 2: Courier Integration      [█████████████████████] 97%
Phase 3: Platform Integrations    [████░░░░░░░░░░░░░░░░] 20%
Overall Project Progress          [█████████████████░░░] 82%
```

## What Works ✅

### Backend Services

#### Auth Service (100% Complete)

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
- ✅ **Partner Channel Management** (January 15, 2026)
  - ✅ Single/Multi-channel API configuration support
  - ✅ Channel mode toggle (SINGLE/MULTI)
  - ✅ Multiple API endpoints per partner with priority
  - ✅ Channel CRUD operations (create, update, delete)
  - ✅ Active channel retrieval for API calls
  - ✅ Channel mode switching with migration
  - ✅ Audit logging for all channel operations
  - ✅ Frontend: Channel mode toggle in partner creation
  - ✅ Frontend: Dynamic multi-channel form
  - ✅ Frontend: RTK Query API endpoints
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

#### Shipment Service (90% Complete)

- ✅ Single order creation
- ✅ AWB generation
- ✅ Real-time tracking
- ✅ Status updates
- ✅ NDR management
- ⏳ Bulk operations (in progress)
- ⏳ Bulk label printing

#### API Gateway (90% Complete)

- ✅ Service routing
- ✅ Basic authentication
- ✅ Rate limiting
- ✅ RBAC integration
- ✅ Permission caching
- ✅ Scope filtering
- ✅ **Outlet routes** (NEW)

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

- ⏳ Redux/RTK Query migration (65% complete)
- ⏳ Outlet portal pages (my-shipments, my-addresses)
- ⏳ Shipment creation form
- ⏳ Bulk upload interface
- ⏳ Advanced filtering

### Infrastructure

- ✅ Docker Compose setup
- ✅ PostgreSQL with per-service databases
- ✅ Redis for sessions and caching
- ✅ PNPM monorepo configuration
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
  - Hardened `pnpm run db:init` flow via `scripts/init-databases.sh`:
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
  - Commands: `pnpm run import:pincodes` or `pnpm run import:pincodes:prod`

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

| ID  | Service  | Issue                   | Priority | Status      |
| --- | -------- | ----------------------- | -------- | ----------- |
| #1  | Shipment | Bulk operations pending | P1       | Planned     |
| #2  | Frontend | Complete outlet portal  | P1       | Next Sprint |
| #3  | License  | Integration incomplete  | P1       | In Progress |

### Recently Fixed

| ID  | Service      | Issue                         | Fixed Date |
| --- | ------------ | ----------------------------- | ---------- |
| #4  | User Service | Outlet module implementation  | Jan 2026   |
| #5  | API Gateway  | Outlet routes added           | Jan 2026   |
| #6  | Frontend     | Outlet management UI          | Jan 2026   |
| #7  | Auth         | Outlet role in RBAC           | Jan 2026   |
| #8  | User Service | Outlet badge system           | Feb 2026   |
| #9  | User Service | Unhandled rejection crash fix | Feb 2026   |

## Changelog

### February 2026

```
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

  Usage: pnpm run import:pincodes:prod
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

| Milestone                   | Target Date | Status         |
| --------------------------- | ----------- | -------------- |
| Outlet Module Complete      | Jan 2026    | ✅ Complete    |
| Charges Management Module   | Feb 2026    | ✅ Complete    |
| Outlet Portal Pages         | Feb 2026    | ✅ Complete    |
| License Service Integration | Feb 2026    | 🔄 In Progress |
| Shipment Bulk Operations    | Feb 2026    | 📋 Planned     |
| Support Service MVP         | Mar 2026    | 📋 Planned     |
| Platform Service (Shopify)  | Mar 2026    | 📋 Planned     |
| Frontend Redux Complete     | Mar 2026    | 📋 Planned     |

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

**Last Updated**: February 21, 2026
**Next Update**: Weekly or after major changes
**Maintainer**: Development Team
