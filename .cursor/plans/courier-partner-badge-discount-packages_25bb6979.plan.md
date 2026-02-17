---
name: courier-partner-badge-discount-packages
overview: Add a new backend+frontend module to create “charge discount packages” per Partner + Outlet Badge, where selected Charge Rules receive FLAT/% discounts for outlets in that badge tier; apply and expose the discount in rate/charge breakdowns wherever quotes are calculated.
todos:
  - id: research-ui-quote-usage
    content: Identify all frontend locations that show partner quotes/charges and plan how to display the per-rule discount breakdown there.
    status: pending
  - id: user-service-internal-outlet-badge
    content: Add internal user-service endpoint to resolve outlet badge by userId (X-Internal-Request protected).
    status: pending
  - id: partner-service-db-and-crud
    content: Add Prisma models+migration and CRUD APIs for Charge Discount Packages and items with Joi validation + audit logging.
    status: pending
  - id: partner-service-apply-discounts
    content: Integrate package discount application into quote calculation for outlet users, including cache correctness and enriched breakdown fields.
    status: pending
  - id: api-gateway-proxy
    content: Expose new partner-service endpoints through API gateway under /api/v1.
    status: pending
  - id: frontend-module
    content: Add RTK Query slice + new /charge-discount-packages page with partner/badge selection, charge-rule multi-select, and per-rule discount inputs.
    status: pending
  - id: frontend-display-discounts
    content: Update quote/rate displays to show applied discounts wherever charges are presented.
    status: pending
  - id: verification
    content: Run Docker restarts, curl checks, and frontend build to confirm end-to-end behavior.
    status: pending
isProject: false
---

## Goals

- Create **Charge Discount Packages**: Partner चयन + package name + target outlet badge (BASIC→DIAMOND) + multi-select **Charge Rules** + per-rule discount (FLAT | PERCENTAGE + value).
- Apply the discount automatically when an **outlet user** (badge tier) calculates rates/charges, and include the discount details in breakdown payloads so it appears everywhere the quote is shown.

## Key design decisions (from you)

- **Scope**: Global (Partner + Badge), not per-client.
- **Selection**: Packages target **Charge Rules** (existing Charges Management rules), not Charges Types.

## Backend changes

### A) User-service: internal endpoint to resolve outlet badge

- Add a new internal route under `[backend/user-service/routes/internal.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/user-service/routes/internal.js)` protected by `requireInternalRequest`.
- Implement controller method (new file recommended) e.g. `[backend/user-service/controllers/internalOutletController.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/user-service/controllers/internalOutletController.js)`:
  - **GET** `/api/v1/internal/outlets/by-user/:userId`
  - Prisma lookup: `Outlet.findUnique({ where: { userId } })`
  - Response: `{ found: boolean, outletId?: uuid, badge?: OutletBadge }`

### B) Partner-service: new Prisma models + CRUD APIs

- Update Prisma schema `[backend/partner-service/prisma/schema.prisma](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/prisma/schema.prisma)`:
  - Add enum `DiscountType { FLAT PERCENTAGE }`
  - Add model `ChargeDiscountPackage`:
    - `id (uuid)`, `partnerId`, `name`, `badge (string or enum mirroring OutletBadge)`, `isActive`, timestamps
  - Add model `ChargeDiscountPackageItem`:
    - `id (uuid)`, `packageId`, `chargeRuleId (uuid)`, `discountType`, `discountValue (Decimal)`, timestamps
    - Unique `(packageId, chargeRuleId)`
- Create migration (partner-service) for the new tables.
- Add validation (Joi) e.g. `[backend/partner-service/validation/chargeDiscountPackageSchemas.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/validation/chargeDiscountPackageSchemas.js)`:
  - `partnerId` required
  - `badge` must be one of: BASIC/BRONZE/SILVER/GOLD/PLATINUM/DIAMOND
  - items array: `{ chargeRuleId, discountType, discountValue }`
  - percentage: 0–100; flat: >=0
- Add service + controller + routes (controller-only handlers, no inline business logic):
  - Service: `[backend/partner-service/services/chargeDiscountPackageService.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/services/chargeDiscountPackageService.js)`
  - Controller: `[backend/partner-service/controllers/chargeDiscountPackageController.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/controllers/chargeDiscountPackageController.js)`
  - Routes: `[backend/partner-service/routes/chargeDiscountPackages.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/routes/chargeDiscountPackages.js)`
  - Endpoints (all envelope responses + audit logs on CRUD):
    - `GET /api/v1/charge-discount-packages` (filters: partnerId, badge, isActive, search)
    - `GET /api/v1/charge-discount-packages/:id`
    - `POST /api/v1/charge-discount-packages`
    - `PUT /api/v1/charge-discount-packages/:id`
    - `DELETE /api/v1/charge-discount-packages/:id` (soft or hard; prefer soft via `isActive=false` + `deletedAt` if added)
  - RBAC: restrict to **superadmin/admin** initially via `authMiddleware.requirePermission("partner","manage","all")`.

### C) Partner-service: apply package discounts in the quote pipeline

- Implement an outlet-badge resolver in partner-service:
  - New service `[backend/partner-service/services/outletContextService.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/services/outletContextService.js)` that calls user-service internal endpoint with `X-Internal-Request` and caches badge in Redis (short TTL like 5 min).
  - Config: add `USER_SERVICE_URL` for partner-service (default `http://user-service:3003`).
- Apply discounts after charge rule evaluation:
  - Best hook: after `chargesRuleCalcService.calculateCharges(...)` in `[backend/partner-service/services/quoteCalculationService.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/services/quoteCalculationService.js)`.
  - Only apply when `req.user.role === "outlet"` (to avoid spoofing). Pass user context into the quote call from `[backend/partner-service/controllers/partnerController.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/partner-service/controllers/partnerController.js)`.
  - Logic:
    - Resolve `outletBadge` by userId.
    - Fetch active package for `(partnerId, outletBadge)` and its items.
    - Build map `chargeRuleId → discountConfig`.
    - Walk `chargesResult.breakdown`:
      - For non-PT entries: use top-level `ruleId` to match.
      - For PT entries: match `pickup.ruleId` and `delivery.ruleId` independently.
      - Compute discount amount:
        - FLAT: `min(value, originalCharge)`
        - PERCENTAGE: `originalCharge * value/100`
      - Clamp final to `>= 0`.
      - Add fields to breakdown entry: `originalCharge`, `discount` (type/value/amount/packageId/name), `finalCharge`.
    - Recompute total.
- **Important cache note**: quote cache key currently ignores badge/packages. For correctness, when badge-based discounts are enabled either:
  - Skip caching, or
  - Include `outletBadge` (and ideally package updatedAt) in the cache key.
  - Plan default: **skip caching when outlet badge is present**.
- While touching this, fix the current shape mismatch so downstream mapping is stable:
  - Ensure quote rate object includes aliases expected by `partnerController` (e.g. set `baseRate = totalRate` and `breakdown = chargesBreakdown`) so `/api/partners/calculate` doesn’t return empty breakdown.

### D) API Gateway proxy

- Add a new proxy mapping in `[backend/api-gateway/server.js](/Volumes/S3TECH/WebProjects/logistics-agrigator/backend/api-gateway/server.js)` for `/api/v1/charge-discount-packages` to partner-service (or nest under existing `/api/v1/charges/*` if you prefer).

## Frontend changes

### A) RTK Query endpoints

- Add `[frontend/src/store/api/endpoints/chargeDiscountPackagesApi.ts](/Volumes/S3TECH/WebProjects/logistics-agrigator/frontend/src/store/api/endpoints/chargeDiscountPackagesApi.ts)`:
  - list/get/create/update/delete
  - Use endpoint-level `transformResponse` to unwrap `{ status, data, meta }`.
  - Add a new tag type in `[frontend/src/store/api/baseApi.ts](/Volumes/S3TECH/WebProjects/logistics-agrigator/frontend/src/store/api/baseApi.ts)` (e.g. `"ChargeDiscountPackage"`).

### B) UI page + form flow

- New page `[frontend/src/app/charge-discount-packages/page.tsx](/Volumes/S3TECH/WebProjects/logistics-agrigator/frontend/src/app/charge-discount-packages/page.tsx)` following the modal CRUD pattern used by `/charges` and `/outlets`.
- Create/Edit modal fields:
  - Partner select (reuse existing partners list endpoint)
  - Package name
  - Badge select (BASIC→DIAMOND)
  - **Charge Rules multi-select** (reuse `chargesApi` list filtered by partnerId)
  - For each selected rule: discountType select + value input

### C) Navigation + access control

- Add route permission entry in `[frontend/src/config/routePermissions.ts](/Volumes/S3TECH/WebProjects/logistics-agrigator/frontend/src/config/routePermissions.ts)`:
  - Path `/charge-discount-packages`
  - Roles: `superadmin`, `admin`
  - Permission: `partner:manage:all`
- Add sidebar link in the existing sidebar/navigation component (where `/charges` link lives).

### D) Show applied discounts in quote displays

- Locate where the UI calls rate calculation (e.g. shipment create quote panel) and render:
  - package name/badge applied
  - per-breakdown line: original → discount → final
  - totals (original total vs final total)

## Verification (dev)

- Docker: restart affected services (`user-service`, `partner-service`, `api-gateway`, `frontend`).
- Internal call sanity:
  - Call user-service internal badge endpoint with `X-Internal-Request`.
- API tests (curl):
  - Create package, list packages.
  - Login as an outlet user with badge GOLD and call `/api/v1/partners/calculate` to confirm discounts appear in breakdown and totals.
- Frontend: run `pnpm --filter frontend run build` and confirm the new page loads and CRUD works.
