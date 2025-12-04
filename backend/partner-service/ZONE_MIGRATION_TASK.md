# Zone System Migration Tasks

## Overview

Complete redesign of the zone management system to support Distance/Geological zone types with Pincode Type management.

**Migration Type**: Clean Slate (delete all existing zone data)

---

## Task Summary

| Task ID     | Name                                 | Status      | Est. Time |
| ----------- | ------------------------------------ | ----------- | --------- |
| PARTNER-012 | Database Schema Migration            | NOT_STARTED | 0.5 day   |
| PARTNER-013 | Pincode Type Service Implementation  | NOT_STARTED | 1 day     |
| PARTNER-014 | Distance Zone Service Implementation | NOT_STARTED | 1.5 days  |
| PARTNER-015 | Zone Controller & Routes Update      | NOT_STARTED | 1 day     |
| PARTNER-016 | ServiceType Cleanup & Swagger Update | NOT_STARTED | 0.5 day   |
| PARTNER-017 | Integration Testing & Verification   | NOT_STARTED | 0.5 day   |

---

## Design Decisions (Confirmed)

| Decision             | Choice                                               |
| -------------------- | ---------------------------------------------------- |
| Distance calculation | Source pincode → Destination pincode (per shipment)  |
| Pincode type scope   | Global/Admin-managed                                 |
| Pincode multi-type   | Yes - pincode can have multiple types (Many-to-Many) |
| Geological zones     | Keep existing State→City→Area→Pincode hierarchy      |
| Milestone ranges     | Non-overlapping (0-50km, 51-500km)                   |
| Partner milestones   | Same milestones for all partners in a zone           |
| Data migration       | Clean slate - delete existing zone data              |

---

## PARTNER-012: Database Schema Migration

**Task Name**: Create Database Migration for Zone System Redesign

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Create Prisma migration to remove ServiceType system and add new zone models
- **Scope**: Schema changes only (no application code)
- **Approach**: Single migration with clean slate approach
- **Estimated Time**: 0.5 day

**Dependencies**:

- [x] Partner Service operational
- [x] PostgreSQL database accessible
- [x] Existing zone models understood

**Implementation Details**:

- [ ] Update `prisma/schema.prisma`:
  - [ ] Remove `ServiceType` model
  - [ ] Remove `ZoneServiceType` enum
  - [ ] Remove `ZoneService` model
  - [ ] Add `ZoneType` enum (DISTANCE | GEOLOGICAL)
  - [ ] Add `zoneType` field to `Zone` model
  - [ ] Add `PincodeType` model
  - [ ] Add `PincodeTypeAssignment` model (Many-to-Many)
  - [ ] Add `ZoneMilestone` model
  - [ ] Add `typeAssignments` relation to `Pincode` model
- [ ] Create migration: `npx prisma migrate dev --name zone_system_v2`
- [ ] Generate Prisma client
- [ ] Verify tables created/dropped in database

**Completion Criteria**:

- [ ] Migration runs without errors
- [ ] `service_types` table dropped
- [ ] `zone_services` table dropped
- [ ] `ZoneServiceType` enum dropped
- [ ] `pincode_types` table created
- [ ] `pincode_type_assignments` table created
- [ ] `zone_milestones` table created
- [ ] `zones.zone_type` column added
- [ ] Prisma client generated successfully

**Schema Changes**:

```prisma
// REMOVE
model ServiceType {
  enum ZoneServiceType { PICKUP, DELIVERY, COD, PREPAID, ODA, HILL }
  model ZoneService { ... }

  // ADD
  enum ZoneType {
  DISTANCE
  GEOLOGICAL
}

model PincodeType {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(50)
  charge      Decimal  @db.Decimal(10, 2)
  description String?  @db.VarChar(255)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  assignments PincodeTypeAssignment[]

  @@index([name])
  @@index([isActive])
  @@map("pincode_types")
}

model PincodeTypeAssignment {
  id         String   @id @default(uuid()) @db.Uuid
  pincodeId  String   @map("pincode_id") @db.Uuid
  typeId     String   @map("type_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at")
  assignedBy String?  @map("assigned_by") @db.Uuid

  pincode     Pincode     @relation(fields: [pincodeId], references: [id], onDelete: Cascade)
  pincodeType PincodeType @relation(fields: [typeId], references: [id], onDelete: Cascade)

  @@unique([pincodeId, typeId])
  @@index([pincodeId])
  @@index([typeId])
  @@map("pincode_type_assignments")
}

model ZoneMilestone {
  id        String   @id @default(uuid()) @db.Uuid
  zoneId    String   @map("zone_id") @db.Uuid
  minKm     Int      @map("min_km")
  maxKm     Int      @map("max_km")
  suffix    String   @db.VarChar(5)
  sortOrder Int      @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  zone Zone @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  @@unique([zoneId, sortOrder])
  @@unique([zoneId, minKm])
  @@unique([zoneId, maxKm])
  @@index([zoneId])
  @@map("zone_milestones")
}

// MODIFY Zone model - add:
model Zone {
  // ... existing fields ...
  zoneType   ZoneType        @map("zone_type")
  milestones ZoneMilestone[]
}

// MODIFY Pincode model - add:
model Pincode {
  // ... existing fields ...
  typeAssignments PincodeTypeAssignment[]
}
```

---

## PARTNER-013: Pincode Type Service Implementation

**Task Name**: Create Pincode Type Management System

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Implement complete Pincode Type CRUD with bulk assignment
- **Scope**: Service, Controller, Routes, Validation for Pincode Types
- **Approach**: Follow auth-service patterns with function-based controllers
- **Estimated Time**: 1 day

**Dependencies**:

- [ ] PARTNER-012 completed (Database migration)

**Implementation Details**:

- [ ] Create `services/pincodeTypeService.js` (~400 lines):
  - [ ] `createPincodeType(data)` - Create type with name + charge
  - [ ] `getPincodeTypes(filters)` - List with pagination, search
  - [ ] `getPincodeTypeById(id)` - Get single type with stats
  - [ ] `updatePincodeType(id, data)` - Update type
  - [ ] `deletePincodeType(id)` - Soft delete (set isActive=false)
  - [ ] `assignPincodesToType(typeId, pincodeCodes, assignedBy)` - Bulk assign
  - [ ] `unassignPincodesFromType(typeId, pincodeCodes)` - Bulk unassign
  - [ ] `getPincodesByType(typeId, pagination)` - List assigned pincodes
  - [ ] `getTypesByPincode(pincodeCode)` - Get types for a pincode
  - [ ] Redis caching for type lookups
- [ ] Create `controllers/pincodeTypeController.js` (~300 lines):
  - [ ] `create` - POST /pincode-types
  - [ ] `list` - GET /pincode-types
  - [ ] `getById` - GET /pincode-types/:id
  - [ ] `update` - PUT /pincode-types/:id
  - [ ] `delete` - DELETE /pincode-types/:id
  - [ ] `assignPincodes` - POST /pincode-types/:id/assign
  - [ ] `unassignPincodes` - DELETE /pincode-types/:id/unassign
  - [ ] `getPincodes` - GET /pincode-types/:id/pincodes
- [ ] Create `validation/pincodeTypeSchemas.js` (~150 lines):
  - [ ] `createPincodeTypeSchema`
  - [ ] `updatePincodeTypeSchema`
  - [ ] `assignPincodesSchema`
  - [ ] `listPincodeTypesSchema`
- [ ] Create `routes/pincodeTypes.js` (~100 lines)
- [ ] Add rate limiter: `pincodeTypeManagementLimiter`
- [ ] Register routes in `server.js`

**Completion Criteria**:

- [ ] All 8 API endpoints working
- [ ] Bulk assign creates multiple assignments in transaction
- [ ] Bulk unassign removes assignments
- [ ] Pagination working on list endpoints
- [ ] Search by name working
- [ ] Validation errors return proper messages
- [ ] Audit logging for all operations

**API Endpoints**:

| Method | Endpoint                             | Description                             |
| ------ | ------------------------------------ | --------------------------------------- |
| POST   | `/api/v1/pincode-types`              | Create type (name, charge, description) |
| GET    | `/api/v1/pincode-types`              | List types (pagination, search)         |
| GET    | `/api/v1/pincode-types/:id`          | Get type by ID                          |
| PUT    | `/api/v1/pincode-types/:id`          | Update type                             |
| DELETE | `/api/v1/pincode-types/:id`          | Delete type (soft)                      |
| POST   | `/api/v1/pincode-types/:id/assign`   | Bulk assign pincodes                    |
| DELETE | `/api/v1/pincode-types/:id/unassign` | Bulk unassign pincodes                  |
| GET    | `/api/v1/pincode-types/:id/pincodes` | Get assigned pincodes                   |

**Files to Create**:

- `services/pincodeTypeService.js`
- `controllers/pincodeTypeController.js`
- `validation/pincodeTypeSchemas.js`
- `routes/pincodeTypes.js`

---

## PARTNER-014: Distance Zone Service Implementation

**Task Name**: Create Distance Zone Service with Milestone Management

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Implement distance zone creation with milestones and distance calculation
- **Scope**: Distance zone service, milestone management, zone matching
- **Approach**: Integrate with existing geographicalDistanceService
- **Estimated Time**: 1.5 days

**Dependencies**:

- [ ] PARTNER-012 completed (Database migration)
- [x] geographicalDistanceService.js exists

**Implementation Details**:

- [ ] Create `services/distanceZoneService.js` (~500 lines):
  - [ ] `createDistanceZone(partnerId, data)` - Create zone with milestones
  - [ ] `getMilestones(zoneId, partnerId)` - Get zone milestones
  - [ ] `updateMilestones(zoneId, partnerId, milestones)` - Update milestones
  - [ ] `deleteMilestone(milestoneId, partnerId)` - Delete single milestone
  - [ ] `generateSuffix(sortOrder)` - Generate A, B, C... suffix
  - [ ] `getDisplayName(zoneName, suffix)` - "Zone Name A"
  - [ ] `validateMilestoneRanges(milestones)` - Non-overlapping check
  - [ ] `calculateShipmentDistance(sourcePincode, destPincode)` - Using Haversine
  - [ ] `matchZoneByDistance(partnerId, distance)` - Find matching milestone
  - [ ] `getZoneForShipment(partnerId, sourcePincode, destPincode)` - Full flow
  - [ ] `listDistanceZones(partnerId, filters)` - List distance zones only
- [ ] Update `services/zoneService.js`:
  - [ ] Add `zoneType` parameter to `createZone`
  - [ ] Route to appropriate service based on zoneType
  - [ ] Add zoneType filtering to `listZones`
  - [ ] Update `getZone` to include milestones for DISTANCE type
  - [ ] Update `getZoneComplete` for both types

**Completion Criteria**:

- [ ] Distance zones created with milestones
- [ ] Auto-suffix generation working (A, B, C...)
- [ ] Display name computed correctly
- [ ] Non-overlapping validation working
- [ ] Distance calculation from source to dest working
- [ ] Zone matching by distance working
- [ ] Multi-partner zone creation working (same milestones)

**Auto-Suffix Logic**:

```javascript
// sortOrder 1 = 'A', 2 = 'B', 3 = 'C', etc.
const generateSuffix = (sortOrder) => {
  return String.fromCharCode(64 + sortOrder); // 1->A, 2->B, 3->C
};

// Display name
const getDisplayName = (zoneName, suffix) => {
  return `${zoneName} ${suffix}`; // "North India Express A"
};
```

**Files to Create**:

- `services/distanceZoneService.js`

**Files to Modify**:

- `services/zoneService.js`

---

## PARTNER-015: Zone Controller & Routes Update

**Task Name**: Update Zone Controller and Routes for Dual Zone Types

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Update controllers and routes to support both zone types
- **Scope**: Controller updates, route additions, validation schema updates
- **Approach**: Conditional logic based on zoneType
- **Estimated Time**: 1 day

**Dependencies**:

- [ ] PARTNER-013 completed (Pincode Type Service)
- [ ] PARTNER-014 completed (Distance Zone Service)

**Implementation Details**:

- [ ] Update `controllers/zoneController.js`:
  - [ ] Modify `createZone` for zoneType handling
  - [ ] Add `getMilestones` endpoint
  - [ ] Add `updateMilestones` endpoint
  - [ ] Add `calculateDistance` endpoint
  - [ ] Add `matchZone` endpoint
  - [ ] Update `listZones` for zoneType filter
  - [ ] Update `getZone` / `getZoneComplete` for both types
- [ ] Update `validation/zoneSchemas.js`:
  - [ ] Add `zoneType` to createZoneSchema
  - [ ] Add conditional `milestones` validation (when DISTANCE)
  - [ ] Add conditional `geographical` validation (when GEOLOGICAL)
  - [ ] Add `updateMilestonesSchema`
  - [ ] Add `calculateDistanceSchema`
  - [ ] Add `matchZoneSchema`
- [ ] Update `routes/zones.js`:
  - [ ] Add `GET /zones/:id/milestones`
  - [ ] Add `PUT /zones/:id/milestones`
  - [ ] Add `POST /zones/calculate-distance`
  - [ ] Add `POST /zones/match`

**Completion Criteria**:

- [ ] Zone creation works for both DISTANCE and GEOLOGICAL
- [ ] Milestone endpoints working
- [ ] Distance calculation endpoint working
- [ ] Zone matching endpoint working
- [ ] Validation correctly enforces type-specific requirements
- [ ] Existing geological zone functionality preserved

**API Endpoints (Updated)**:

| Method | Endpoint                           | Description                     | Zone Type  |
| ------ | ---------------------------------- | ------------------------------- | ---------- |
| POST   | `/api/v1/zones`                    | Create zone                     | Both       |
| GET    | `/api/v1/zones`                    | List zones (filter by zoneType) | Both       |
| GET    | `/api/v1/zones/:id`                | Get zone                        | Both       |
| GET    | `/api/v1/zones/:id/complete`       | Get zone with associations      | Both       |
| PUT    | `/api/v1/zones/:id`                | Update zone                     | Both       |
| DELETE | `/api/v1/zones/:id`                | Delete zone                     | Both       |
| GET    | `/api/v1/zones/:id/milestones`     | Get milestones                  | DISTANCE   |
| PUT    | `/api/v1/zones/:id/milestones`     | Update milestones               | DISTANCE   |
| GET    | `/api/v1/zones/:id/geography`      | Get geography                   | GEOLOGICAL |
| PUT    | `/api/v1/zones/:id/geography`      | Update geography                | GEOLOGICAL |
| POST   | `/api/v1/zones/calculate-distance` | Calculate distance              | DISTANCE   |
| POST   | `/api/v1/zones/match`              | Match zone by distance          | DISTANCE   |

**Files to Modify**:

- `controllers/zoneController.js`
- `validation/zoneSchemas.js`
- `routes/zones.js`

---

## PARTNER-016: ServiceType Cleanup & Swagger Update

**Task Name**: Remove ServiceType System and Update Documentation

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Delete ServiceType files and update Swagger documentation
- **Scope**: File deletion, server.js cleanup, Swagger updates
- **Approach**: Remove all ServiceType references
- **Estimated Time**: 0.5 day

**Dependencies**:

- [ ] PARTNER-015 completed (Zone Controller Update)

**Implementation Details**:

- [ ] Delete files:
  - [ ] `controllers/serviceTypeController.js`
  - [ ] `services/serviceTypeService.js`
  - [ ] `routes/serviceTypes.js`
  - [ ] `validation/serviceTypeSchemas.js`
  - [ ] `prisma/seed-service-types.js` (if exists)
  - [ ] `scripts/seed-service-types.js` (if exists)
- [ ] Update `server.js`:
  - [ ] Remove `serviceTypes` route import
  - [ ] Remove `serviceTypes` route registration
  - [ ] Add `pincodeTypes` route import
  - [ ] Add `pincodeTypes` route registration
- [ ] Update `config/swagger.js`:
  - [ ] Remove ServiceType schemas
  - [ ] Remove ServiceType tag
  - [ ] Add PincodeType schemas
  - [ ] Add PincodeType tag
  - [ ] Add ZoneMilestone schemas
  - [ ] Update Zone schemas for zoneType
  - [ ] Add distance calculation schemas

**Completion Criteria**:

- [ ] All ServiceType files deleted
- [ ] No ServiceType imports in codebase
- [ ] server.js updated with new routes
- [ ] Swagger documentation complete for new endpoints
- [ ] No broken references

**Files to Delete**:

| File                                   | Reason              |
| -------------------------------------- | ------------------- |
| `controllers/serviceTypeController.js` | ServiceType removed |
| `services/serviceTypeService.js`       | ServiceType removed |
| `routes/serviceTypes.js`               | ServiceType removed |
| `validation/serviceTypeSchemas.js`     | ServiceType removed |
| `prisma/seed-service-types.js`         | ServiceType removed |
| `scripts/seed-service-types.js`        | ServiceType removed |

**Files to Modify**:

- `server.js`
- `config/swagger.js`

---

## PARTNER-017: Integration Testing & Verification

**Task Name**: Complete Integration Testing and Docker Verification

**Status**: NOT_STARTED

**Planning**:

- **Objective**: Verify all new functionality works end-to-end
- **Scope**: API testing, Docker verification, health checks
- **Approach**: Curl-based API testing, Docker restart verification
- **Estimated Time**: 0.5 day

**Dependencies**:

- [ ] PARTNER-016 completed (Cleanup)

**Implementation Details**:

- [ ] Test Pincode Type System:
  - [ ] Create pincode type
  - [ ] List pincode types
  - [ ] Update pincode type
  - [ ] Bulk assign pincodes
  - [ ] Bulk unassign pincodes
  - [ ] Get pincodes by type
- [ ] Test Distance Zone System:
  - [ ] Create distance zone with milestones
  - [ ] Verify auto-suffix generation
  - [ ] Get milestones
  - [ ] Update milestones
  - [ ] Calculate distance (source to dest)
  - [ ] Match zone by distance
- [ ] Test Geological Zone System:
  - [ ] Create geological zone (preserved)
  - [ ] Get geography
  - [ ] Update geography
- [ ] Docker Verification:
  - [ ] `docker-compose restart partner-service`
  - [ ] Check logs: `docker logs logistics-partner-service --tail=50`
  - [ ] Verify no MODULE_NOT_FOUND errors
  - [ ] Health check: `curl http://localhost:3005/health`
- [ ] Swagger Verification:
  - [ ] Access `http://localhost:3005/api-docs`
  - [ ] Verify all new endpoints documented
  - [ ] Test endpoints via Swagger UI

**Completion Criteria**:

- [ ] All Pincode Type endpoints working
- [ ] All Distance Zone endpoints working
- [ ] All Geological Zone endpoints working (preserved)
- [ ] Docker service restarts without errors
- [ ] Health endpoint returns 200
- [ ] No MODULE_NOT_FOUND errors in logs
- [ ] Swagger documentation accessible and complete

**Verification Commands**:

```bash
# Docker restart
docker-compose restart partner-service

# Check logs
docker logs logistics-partner-service --tail=50

# Health check
curl http://localhost:3005/health | jq .

# Test Pincode Type CRUD
curl -X POST http://localhost:3005/api/v1/pincode-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "Metro", "charge": 0}'

# Test Distance Zone
curl -X POST http://localhost:3005/api/v1/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Test Zone",
    "zoneType": "DISTANCE",
    "partnerIds": ["partner-id"],
    "milestones": [
      {"minKm": 0, "maxKm": 50},
      {"minKm": 51, "maxKm": 500}
    ]
  }'
```

---

## Summary

**Total Tasks**: 6
**Total Estimated Time**: 5 days

| Phase              | Task ID     | Days |
| ------------------ | ----------- | ---- |
| Database           | PARTNER-012 | 0.5  |
| Pincode Types      | PARTNER-013 | 1.0  |
| Distance Zones     | PARTNER-014 | 1.5  |
| Controllers/Routes | PARTNER-015 | 1.0  |
| Cleanup            | PARTNER-016 | 0.5  |
| Testing            | PARTNER-017 | 0.5  |

**Execution Order**: PARTNER-012 → PARTNER-013 → PARTNER-014 → PARTNER-015 → PARTNER-016 → PARTNER-017
