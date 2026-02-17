---
name: Charges engine final fields
overview: "Replace the current ChargeRule (kind+slabs) system with the new final field set: Partner + Charges Base (Invoice/Weight/Zone-to-Zone/Distance), type selector only for Invoice/Weight (ChargesTypes vs PincodeTypes), new min+percentage / min+perKg pricing rules, distance rules bound to existing distance zone milestones, and remove all old fields (including Charges Kind)."
todos:
  - id: db-migration
    content: Update partner-service Prisma `ChargeRule` model, drop old enums/columns, add new fields + zoneMilestone FK, and generate committed migration.
    status: pending
  - id: backend-crud
    content: Update Joi validation, charges service/controller mapping, and swagger docs for new request/response fields.
    status: pending
  - id: backend-calculation
    content: "Refactor charges rule calculation + quote context: implement min/percentage + min/perKg formulas, milestone-based distance rules, and per-side pincode-type applicability using partner pincode assignments."
    status: pending
  - id: frontend-rtk
    content: Update `chargesApi.ts` types/params to remove kind and use new fields.
    status: pending
  - id: frontend-ui
    content: "Refactor `/charges` page: remove Kind, implement new dynamic fields per base, add distance slab multi-select, and update summaries/view/edit."
    status: pending
  - id: verification
    content: Run Docker restart + logs + module-load checks; curl-create rules and rate calculation; run frontend build and restart frontend container.
    status: pending
isProject: false
---

# Charges engine final fields (backend + frontend)

## Context (what exists today)

- **Backend (partner-service)**: `ChargeRule` currently uses `kind` (`PARTNER_CHARGES_TYPE|GEOLOGICAL|ADDON`) + `base` and legacy slab fields in `[backend/partner-service/prisma/schema.prisma](backend/partner-service/prisma/schema.prisma)`.
- **Calculation**: implemented in `[backend/partner-service/services/chargesRuleCalculationService.js](backend/partner-service/services/chargesRuleCalculationService.js)` and used by quotes in `[backend/partner-service/services/quoteCalculationService.js](backend/partner-service/services/quoteCalculationService.js)`.
- **Frontend**: `/charges` page with modal CRUD in `[frontend/src/app/charges/page.tsx](frontend/src/app/charges/page.tsx)` and RTK endpoints in `[frontend/src/store/api/endpoints/chargesApi.ts](frontend/src/store/api/endpoints/chargesApi.ts)`.
- **Distance zones/slabs already exist**: Distance zone matching returns `milestone.id` in `[backend/partner-service/services/distanceZoneService.js](backend/partner-service/services/distanceZoneService.js)`.

## Final requirements to implement (confirmed)

- **Remove**: Charges Kind (no `kind` field).
- **Charges Base**: Invoice | Weight | Weight Zone-to-Zone | Weight Distance.
- **Invoice**: Select Type (ChargesTypes or PincodeTypes) → pick specific type → `minValue` + `percentageValue`.
  - Compute: `computed = (percentageValue/100) * invoiceValue`; `final = max(minValue, computed)`.
- **Weight / Zone-to-Zone / Distance**: `computed = ceil(effectiveWeight / perKg) * perKgCharges`; `final = max(minValue, computed)`.
- **Pincode Types behavior**: apply **per-side** (pickup and delivery) and **SUM** both sides **only if that side’s pincode has that pincodeType set** via partner pincode assignment values.
- **Distance base UI**: Select **zone slab(s)** (milestones) for that partner; for each slab input `perKg` and `perKgCharges` (plus shared `minValue`).

## Proposed data model (partner-service)

Update `ChargeRule` to match the final field set and bind distance rules to milestones.

### `ChargeRuleBase` (keep, relabel in UI)

- `INVOICE_VALUE`
- `WEIGHT`
- `ZONE_TO_ZONE_WEIGHT`
- `DISTANCE_BASE_WEIGHT`

### Remove columns and enums

- Drop enum/type: `ChargeRuleKind`, `ChargeCalcType`.
- Drop columns: `kind`, `from_amount`, `to_amount`, `charge`, `calc_type`, `min_kg`, `max_kg`, `min_weight_kg`, `addon_weight_kg`, `weight_charge`, `addon_charge`, `division`, `from_km`, `to_km`.

### Add new columns

- `min_value` (Decimal)
- `percentage_value` (Decimal) — only for `INVOICE_VALUE`
- `per_kg` (Decimal) and `per_kg_charge` (Decimal) — for `WEIGHT|ZONE_TO_ZONE_WEIGHT|DISTANCE_BASE_WEIGHT`
- `zone_milestone_id` (UUID) — for `DISTANCE_BASE_WEIGHT` (FK → `ZoneMilestone.id`)
- Keep optional FKs:
  - `charges_type_id` (UUID) — for Invoice/Weight when “Charges Types” selected
  - `pincode_type_id` (UUID) — for Invoice/Weight when “Pincode Types” selected
- Keep zone pair fields for `ZONE_TO_ZONE_WEIGHT`: `from_zone_id`, `to_zone_id`

### Constraints (enforced in Joi + service validation)

- For `INVOICE_VALUE` and `WEIGHT`: require **exactly one** of `chargesTypeId` or `pincodeTypeId`.
- For `ZONE_TO_ZONE_WEIGHT`: require `fromZoneId` + `toZoneId`.
- For `DISTANCE_BASE_WEIGHT`: require `zoneMilestoneId`.

## Backend work (partner-service)

### 1) Prisma schema + migration

- Update `[backend/partner-service/prisma/schema.prisma](backend/partner-service/prisma/schema.prisma)` for the new `ChargeRule` shape.
- Add relation: `ChargeRule.zoneMilestoneId -> ZoneMilestone.id` (new FK).
- Create a new migration under `backend/partner-service/prisma/migrations/`.
  - **Breaking change warning**: existing `charge_rules` rows won’t be representable 1:1. Plan assumes **rules will be re-entered** after migration (or we can add an optional export script before migration).

### 2) Validation

- Update `[backend/partner-service/validation/chargesSchemas.js](backend/partner-service/validation/chargesSchemas.js)`:
  - Replace `kind` validation with XOR validation for `chargesTypeId` vs `pincodeTypeId` (Invoice/Weight only).
  - Validate new numeric fields per base.

### 3) CRUD service mapping

- Update `[backend/partner-service/services/chargesService.js](backend/partner-service/services/chargesService.js)`:
  - Build `createData`/`updateData` using the new field names only.
  - FK checks:
    - `chargesTypeId` must belong to partner.
    - `pincodeTypeId` must exist.
    - `zoneMilestoneId` must belong to a `Zone` with `partnerId` and `zoneType=DISTANCE`.
    - `fromZoneId/toZoneId` must belong to `partnerId` and `zoneType=GEOLOGICAL`.

### 4) Calculation engine

- Refactor `[backend/partner-service/services/chargesRuleCalculationService.js](backend/partner-service/services/chargesRuleCalculationService.js)`:
  - Replace `calcInvoiceValue/calcWeight/calcZoneToZoneWeight/calcDistanceBaseWeight` logic with the new formulas.
  - Distance matching should use `context.distanceMilestoneId` (not division/fromKm/toKm).
  - Implement **pincode-type applicability check** using `context.pickupPincodeTypeValues` and `context.deliveryPincodeTypeValues`.
    - Only apply pincode-type rules on sides where the value indicates active (e.g. `yes_no: "yes"`; `number: >0`).
  - Keep “pick highest per category” behavior; for pincode-type rules pick highest **per-side** and sum.

### 5) Quote context enrichment

- Update `[backend/partner-service/services/quoteCalculationService.js](backend/partner-service/services/quoteCalculationService.js)`:
  - Pass `distanceMilestoneId: zoneResult.milestone?.id` into charge context.
  - Add helper to fetch pincode-type values per side:
    - Lookup `Pincode` by `code`.
    - Lookup `PartnerPincodeAssign` for `(partnerId, pincodeId, isActive=true)` and include `pincodeTypeValues`.
    - Build `{ [pincodeTypeId]: value }` map.

### 6) API Gateway

- No route changes needed (proxy already exists in `[backend/api-gateway/server.js](backend/api-gateway/server.js)` under `/api/v1/charges`).

## Frontend work

### 1) RTK Query types and payloads

- Update `[frontend/src/store/api/endpoints/chargesApi.ts](frontend/src/store/api/endpoints/chargesApi.ts)`:
  - Remove `ChargeRuleKind` and any `kind` query params.
  - Update `ChargeRule` and request DTOs to the new fields:
    - Invoice: `minValue`, `percentageValue`, plus `chargesTypeId|pincodeTypeId`.
    - Weight: `minValue`, `perKg`, `perKgCharges`, plus `chargesTypeId|pincodeTypeId`.
    - Zone-to-zone: `fromZoneId`, `toZoneId`, `minValue`, `perKg`, `perKgCharges`.
    - Distance: `zoneMilestoneId`, `minValue`, `perKg`, `perKgCharges`.

### 2) Charges management UI

- Update `[frontend/src/app/charges/page.tsx](frontend/src/app/charges/page.tsx)`:
  - **Remove Kind selection and Kind filter/column**.
  - **Invoice base** UI:
    - Partner select
    - Base select
    - Select Type: “Charges Types” | “Pincode Types”
    - Conditional dropdown for the chosen type
    - Inputs: `Min Value`, `Percentage value`
  - **Weight base** UI:
    - Same type selection + dropdown
    - Inputs: `Min Value`, `Per Kg`, `Per Kg charges`
  - **Zone-to-zone base** UI:
    - Inputs: `From zone`, `To zone`, `Min Value`, `Per Kg`, `Per Kg charges`
  - **Distance base** UI:
    - Multi-select **distance zone slabs** (use zones API: `[frontend/src/store/api/endpoints/zonesApi.ts](frontend/src/store/api/endpoints/zonesApi.ts)` with `partnerId` + `zoneType=DISTANCE`).
    - Shared `Min Value`
    - For each selected milestone: `Per Kg`, `Per Kg charges`
    - Submit strategy: create **one ChargeRule per selected milestone** (can be done with `Promise.all` over `createChargeRule`), so backend stays simple and CRUD remains per-rule.
  - Update rule summary rendering + view/edit modal to reflect new fields.

## Verification (mandatory)

### Backend (Docker)

- Deploy migration inside partner container.
- Restart partner-service and api-gateway.
- Verify load:
  - `docker exec logistics-partner-service node -e "require('./server.js')"`
- Logs:
  - `docker logs logistics-partner-service --tail=50`
  - ensure **no** `MODULE_NOT_FOUND`.
- Curl smoke tests (via gateway):
  - Create one rule for each base.
  - `GET /api/v1/charges` lists it.
  - Rate calc: `POST /api/v1/partners/calculate` (gateway → partner-service) and confirm breakdown totals reflect the new formulas.

### Frontend

- `cd frontend && pnpm run build` must succeed for changed files.
- Restart frontend container.

## Rollout notes

- This is a **hard replace** of stored fields. Existing rules will need re-entry (or we add a one-time export to JSON before migration).
