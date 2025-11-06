# Partner Service Geological Zone Feature Integration

## Task Overview

**Task ID**: PARTNER-010
**Task Name**: Integrate Complete Geological Zone Management System from External Partner Service
**Status**: NOT_STARTED
**Priority**: P1 (High - Core Logistics Feature)
**Estimated Time**: 5 days
**Dependencies**: Partner Service operational (COMPLETED)

---

## 🎯 Objective

Integrate the comprehensive geological zone management system from `external_partner_service/` into the production `backend/partner-service`. This feature enables:

1. **Hierarchical Geographical Management**: States → Cities → Areas → Pincodes
2. **Zone Management**: Partner-specific zone creation with geographical associations
3. **Service Type Configuration**: Pickup, Delivery, COD, Prepaid, ODA, Hill services per zone
4. **Zone Coverage Validation**: Pincode serviceability checking and overlap detection
5. **Performance Optimization**: Redis caching for geographical hierarchy and zone lookups

---

## 📊 Source Analysis

### External Partner Service Features

**Location**: `/external_partner_service/partner-services/`

**Key Components**:

- **Zone Service**: `src/services/zone.service.js` (3,798 lines)
  - Complete CRUD operations with transaction support
  - Geographical hierarchy associations (states, cities, areas, pincodes)
  - Service type configuration per zone
  - Redis caching with 2-hour TTL
  - Zone overlap validation
  - Bulk operations support

- **Zone Controller**: `src/controllers/zone.controller.js` (2,577 lines)
  - RESTful API endpoints
  - Partner-scoped operations
  - Comprehensive error handling
  - Request/response logging

- **Zone Routes**: `src/routes/zone.routes.js` (2,389 lines)
  - 20+ API endpoints
  - Joi validation integration
  - HMAC authentication
  - Rate limiting

- **Validation Schemas**: `src/schemas/zone.schema.js` (958 lines)
  - Comprehensive Joi validation
  - Swagger/OpenAPI documentation
  - Business logic validation

- **Coverage Validation**: `src/services/zoneCoverageValidation.service.js`
  - Pincode serviceability checking
  - Zone overlap detection
  - Coverage gap analysis

### Database Schema (from external_partner_service)

```sql
-- Geographical Hierarchy
states (id, name, code, status)
cities (id, state_id, name, code, status)
areas (id, city_id, name, code, status)
pincodes (id, area_id, code, state_id, latitude, longitude, oda_applicable, hill_applicable)

-- Zone Management
zones (id, partner_id, name, description, status)
zone_states (zone_id, state_id)
zone_cities (zone_id, city_id)
zone_areas (zone_id, area_id)
zone_pincodes (zone_id, pincode_id)

-- Service Types
zone_services (id, zone_id, service_type, is_available, additional_charges)
```

---

## 🏗️ Implementation Plan

### Phase 1: Database Schema Integration (Day 1)

#### Task 1.1: Create Geographical Hierarchy Models

**File**: `backend/partner-service/prisma/schema.prisma`

Add the following models:

```prisma
// ========================================
// GEOGRAPHICAL HIERARCHY MODELS
// ========================================

model State {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  code      String   @unique @db.VarChar(10)
  status    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  cities     City[]
  pincodes   Pincode[]
  zoneStates ZoneState[]

  @@index([code, status])
  @@map("states")
}

model City {
  id        String   @id @default(uuid()) @db.Uuid
  stateId   String   @db.Uuid
  name      String   @db.VarChar(255)
  code      String?  @db.VarChar(10)
  status    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  state      State      @relation(fields: [stateId], references: [id], onDelete: Cascade)
  areas      Area[]
  zoneCities ZoneCity[]

  @@index([stateId, status])
  @@index([code])
  @@map("cities")
}

model Area {
  id        String   @id @default(uuid()) @db.Uuid
  cityId    String   @db.Uuid
  name      String   @db.VarChar(255)
  code      String?  @db.VarChar(10)
  status    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  city      City       @relation(fields: [cityId], references: [id], onDelete: Cascade)
  pincodes  Pincode[]
  zoneAreas ZoneArea[]

  @@index([cityId, status])
  @@index([code])
  @@map("areas")
}

model Pincode {
  id             String   @id @default(uuid()) @db.Uuid
  areaId         String?  @db.Uuid
  stateId        String   @db.Uuid
  code           String   @unique @db.VarChar(6)
  areaName       String?  @db.VarChar(255)
  district       String?  @db.VarChar(255)
  latitude       Decimal? @db.Decimal(10, 8)
  longitude      Decimal? @db.Decimal(11, 8)
  odaApplicable  Boolean  @default(false)
  hillApplicable Boolean  @default(false)
  status         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  area         Area?         @relation(fields: [areaId], references: [id], onDelete: SetNull)
  state        State         @relation(fields: [stateId], references: [id], onDelete: Cascade)
  zonePincodes ZonePincode[]

  @@index([code, status])
  @@index([areaId, status])
  @@index([stateId, status])
  @@index([latitude, longitude])
  @@map("pincodes")
}

// ========================================
// ZONE MANAGEMENT MODELS
// ========================================

model Zone {
  id          String   @id @default(uuid()) @db.Uuid
  partnerId   String   @db.Uuid // Reference to Partner model
  name        String   @db.VarChar(255)
  description String?  @db.Text
  status      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  zoneStates   ZoneState[]
  zoneCities   ZoneCity[]
  zoneAreas    ZoneArea[]
  zonePincodes ZonePincode[]
  zoneServices ZoneService[]

  @@unique([partnerId, name])
  @@index([partnerId, status])
  @@map("zones")
}

model ZoneState {
  id        String   @id @default(uuid()) @db.Uuid
  zoneId    String   @db.Uuid
  stateId   String   @db.Uuid
  createdAt DateTime @default(now())

  // Relations
  zone  Zone  @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  state State @relation(fields: [stateId], references: [id], onDelete: Cascade)

  @@unique([zoneId, stateId])
  @@index([zoneId])
  @@index([stateId])
  @@map("zone_states")
}

model ZoneCity {
  id        String   @id @default(uuid()) @db.Uuid
  zoneId    String   @db.Uuid
  cityId    String   @db.Uuid
  createdAt DateTime @default(now())

  // Relations
  zone Zone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  city City @relation(fields: [cityId], references: [id], onDelete: Cascade)

  @@unique([zoneId, cityId])
  @@index([zoneId])
  @@index([cityId])
  @@map("zone_cities")
}

model ZoneArea {
  id        String   @id @default(uuid()) @db.Uuid
  zoneId    String   @db.Uuid
  areaId    String   @db.Uuid
  createdAt DateTime @default(now())

  // Relations
  zone Zone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  area Area @relation(fields: [areaId], references: [id], onDelete: Cascade)

  @@unique([zoneId, areaId])
  @@index([zoneId])
  @@index([areaId])
  @@map("zone_areas")
}

model ZonePincode {
  id        String   @id @default(uuid()) @db.Uuid
  zoneId    String   @db.Uuid
  pincodeId String   @db.Uuid
  createdAt DateTime @default(now())

  // Relations
  zone    Zone    @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  pincode Pincode @relation(fields: [pincodeId], references: [id], onDelete: Cascade)

  @@unique([zoneId, pincodeId])
  @@index([zoneId])
  @@index([pincodeId])
  @@map("zone_pincodes")
}

// ========================================
// SERVICE TYPE CONFIGURATION
// ========================================

enum ServiceType {
  PICKUP
  DELIVERY
  COD
  PREPAID
  ODA
  HILL

  @@map("service_type")
}

model ZoneService {
  id                String      @id @default(uuid()) @db.Uuid
  zoneId            String      @db.Uuid
  serviceType       ServiceType
  isAvailable       Boolean     @default(true)
  additionalCharges Decimal?    @db.Decimal(10, 2)
  remarks           String?     @db.Text
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  // Relations
  zone Zone @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  @@unique([zoneId, serviceType])
  @@index([zoneId, serviceType, isAvailable])
  @@map("zone_services")
}
```

#### Task 1.2: Create Migration

```bash
cd backend/partner-service
npx prisma migrate dev --name add_geographical_zone_management
npx prisma generate
```

#### Task 1.3: Create Seed Data

**File**: `backend/partner-service/prisma/seed-geographical-data.js`

Create seed script for:

- Indian states (28 states + 8 UTs)
- Major cities (100+ cities)
- Sample areas
- Pincode data (import from CSV if available)

---

### Phase 2: Service Layer Implementation (Day 2)

#### Task 2.1: Geographical Service

**File**: `backend/partner-service/services/geographicalService.js`

Implement:

- `getStates()` - List all states
- `getCitiesByState(stateId)` - Get cities by state
- `getAreasByCity(cityId)` - Get areas by city
- `getPincodesByArea(areaId)` - Get pincodes by area
- `searchPincodes(filters)` - Search pincodes with filters
- `getPincodeDetails(code)` - Get pincode with full hierarchy
- Redis caching with 24-hour TTL for geographical data

#### Task 2.2: Zone Service

**File**: `backend/partner-service/services/zoneService.js`

Implement:

- `createZone(partnerId, zoneData)` - Create zone with geographical associations
- `updateZone(zoneId, partnerId, zoneData)` - Update zone
- `deleteZone(zoneId, partnerId)` - Soft delete zone
- `getZone(zoneId, partnerId)` - Get zone with full details
- `listZones(partnerId, filters)` - List partner zones
- `getZoneComplete(zoneId, partnerId)` - Get zone with all associations
- `associateGeography(zoneId, geographical, transaction)` - Bulk associate geography
- `configureServices(zoneId, services, transaction)` - Configure service types
- `validateZoneOverlap(zoneId, partnerId, transaction)` - Check overlapping zones
- Redis caching with 2-hour TTL for zone data

#### Task 2.3: Zone Coverage Validation Service

**File**: `backend/partner-service/services/zoneCoverageValidationService.js`

Implement:

- `validatePincodeServiceability(partnerId, pincode)` - Check if pincode is serviceable
- `getZonesByPincode(partnerId, pincode)` - Get zones covering a pincode
- `detectZoneOverlaps(partnerId)` - Detect overlapping zones
- `getCoverageGaps(partnerId)` - Find coverage gaps
- `validateZoneCoverage(zoneId, partnerId)` - Validate zone coverage

---

### Phase 3: Controller Layer (Day 3)

#### Task 3.1: Geographical Controller

**File**: `backend/partner-service/controllers/geographicalController.js`

Implement function-based exports:

- `getStates(req, res)` - GET /api/v1/geography/states
- `getCities(req, res)` - GET /api/v1/geography/cities?stateId=:id
- `getAreas(req, res)` - GET /api/v1/geography/areas?cityId=:id
- `getPincodes(req, res)` - GET /api/v1/geography/pincodes?areaId=:id
- `searchPincodes(req, res)` - GET /api/v1/geography/pincodes/search
- `getPincodeDetails(req, res)` - GET /api/v1/geography/pincodes/:code
- `getCitiesByStates(req, res)` - POST /api/v1/geography/cities/by-states
- `getAreasByCities(req, res)` - POST /api/v1/geography/areas/by-cities
- `getPincodesByAreas(req, res)` - POST /api/v1/geography/pincodes/by-areas

#### Task 3.2: Zone Controller

**File**: `backend/partner-service/controllers/zoneController.js`

Implement function-based exports:

- `createZone(req, res)` - POST /api/v1/zones
- `updateZone(req, res)` - PUT /api/v1/zones/:id
- `deleteZone(req, res)` - DELETE /api/v1/zones/:id
- `getZone(req, res)` - GET /api/v1/zones/:id
- `listZones(req, res)` - GET /api/v1/zones
- `getZoneComplete(req, res)` - GET /api/v1/zones/:id/complete
- `getZoneServices(req, res)` - GET /api/v1/zones/:id/services
- `updateZoneServices(req, res)` - PUT /api/v1/zones/:id/services
- `getZoneGeography(req, res)` - GET /api/v1/zones/:id/geography
- `updateZoneGeography(req, res)` - PUT /api/v1/zones/:id/geography

#### Task 3.3: Zone Coverage Controller

**File**: `backend/partner-service/controllers/zoneCoverageController.js`

Implement function-based exports:

- `checkServiceability(req, res)` - POST /api/v1/zones/coverage/check
- `getZonesByPincode(req, res)` - GET /api/v1/zones/coverage/pincode/:code
- `detectOverlaps(req, res)` - GET /api/v1/zones/coverage/overlaps
- `getCoverageGaps(req, res)` - GET /api/v1/zones/coverage/gaps
- `validateCoverage(req, res)` - GET /api/v1/zones/:id/coverage/validate

---

### Phase 4: Validation & Routes (Day 4)

#### Task 4.1: Validation Schemas

**File**: `backend/partner-service/validation/zoneSchemas.js`

Implement Joi schemas:

- `createZoneSchema` - Validate zone creation
- `updateZoneSchema` - Validate zone updates
- `zoneFiltersSchema` - Validate zone listing filters
- `geographicalSelectionSchema` - Validate geographical associations
- `serviceConfigurationSchema` - Validate service type configuration
- `pincodeSearchSchema` - Validate pincode search
- `coverageCheckSchema` - Validate coverage checking

#### Task 4.2: Geographical Routes

**File**: `backend/partner-service/routes/geographical.js`

Implement routes:

```javascript
const router = require("express").Router();
const controller = require("../controllers/geographicalController");
const { auth } = require("../middleware/auth");
const { validateInput } = require("../middleware/validate");
const schemas = require("../validation/zoneSchemas");

// Public routes (no auth required for geography)
router.get("/states", controller.getStates);
router.get(
  "/cities",
  validateInput(schemas.citiesQuerySchema),
  controller.getCities,
);
router.get(
  "/areas",
  validateInput(schemas.areasQuerySchema),
  controller.getAreas,
);
router.get(
  "/pincodes",
  validateInput(schemas.pincodesQuerySchema),
  controller.getPincodes,
);
router.get(
  "/pincodes/search",
  validateInput(schemas.pincodeSearchSchema),
  controller.searchPincodes,
);
router.get("/pincodes/:code", controller.getPincodeDetails);

// Batch operations
router.post(
  "/cities/by-states",
  validateInput(schemas.batchStatesSchema),
  controller.getCitiesByStates,
);
router.post(
  "/areas/by-cities",
  validateInput(schemas.batchCitiesSchema),
  controller.getAreasByCities,
);
router.post(
  "/pincodes/by-areas",
  validateInput(schemas.batchAreasSchema),
  controller.getPincodesByAreas,
);

module.exports = router;
```

#### Task 4.3: Zone Routes

**File**: `backend/partner-service/routes/zones.js`

Implement routes:

```javascript
const router = require("express").Router();
const controller = require("../controllers/zoneController");
const { auth } = require("../middleware/auth");
const { validateInput } = require("../middleware/validate");
const schemas = require("../validation/zoneSchemas");
const { zoneManagementLimiter } = require("../middleware/rateLimiter");

// All routes require authentication
router.use(auth);
router.use(zoneManagementLimiter);

// Zone CRUD
router.post(
  "/",
  validateInput(schemas.createZoneSchema),
  controller.createZone,
);
router.get("/", validateInput(schemas.zoneFiltersSchema), controller.listZones);
router.get("/:id", controller.getZone);
router.get("/:id/complete", controller.getZoneComplete);
router.put(
  "/:id",
  validateInput(schemas.updateZoneSchema),
  controller.updateZone,
);
router.delete("/:id", controller.deleteZone);

// Zone services management
router.get("/:id/services", controller.getZoneServices);
router.put(
  "/:id/services",
  validateInput(schemas.serviceConfigurationSchema),
  controller.updateZoneServices,
);

// Zone geography management
router.get("/:id/geography", controller.getZoneGeography);
router.put(
  "/:id/geography",
  validateInput(schemas.geographicalSelectionSchema),
  controller.updateZoneGeography,
);

module.exports = router;
```

#### Task 4.4: Coverage Routes

**File**: `backend/partner-service/routes/zoneCoverage.js`

Implement routes:

```javascript
const router = require("express").Router();
const controller = require("../controllers/zoneCoverageController");
const { auth } = require("../middleware/auth");
const { validateInput } = require("../middleware/validate");
const schemas = require("../validation/zoneSchemas");

router.use(auth);

// Coverage checking
router.post(
  "/check",
  validateInput(schemas.coverageCheckSchema),
  controller.checkServiceability,
);
router.get("/pincode/:code", controller.getZonesByPincode);
router.get("/overlaps", controller.detectOverlaps);
router.get("/gaps", controller.getCoverageGaps);
router.get("/:zoneId/validate", controller.validateCoverage);

module.exports = router;
```

#### Task 4.5: Register Routes in Server

**File**: `backend/partner-service/server.js`

Add route registrations:

```javascript
// Geographical hierarchy routes
app.use("/api/v1/geography", require("./routes/geographical"));

// Zone management routes
app.use("/api/v1/zones", require("./routes/zones"));

// Zone coverage routes
app.use("/api/v1/zones/coverage", require("./routes/zoneCoverage"));
```

---

### Phase 5: Swagger Documentation & Testing (Day 5)

#### Task 5.1: Update Swagger Configuration

**File**: `backend/partner-service/config/swagger.js`

Add Swagger definitions for:

- Geographical endpoints (9 endpoints)
- Zone management endpoints (10 endpoints)
- Coverage validation endpoints (5 endpoints)

#### Task 5.2: Integration Testing

Create test files:

- `test-geographical-hierarchy.js` - Test geographical API
- `test-zone-management.js` - Test zone CRUD
- `test-zone-coverage.js` - Test coverage validation

#### Task 5.3: Performance Testing

Test scenarios:

- 1000+ zones per partner
- 100,000+ pincodes
- Redis cache hit rates (>70%)
- Response times (<500ms for cached, <2s for uncached)

---

## 🎯 Completion Criteria

### Phase 1: Database Schema

- [x] All 13 Prisma models created with proper relations
- [x] Migration runs successfully without errors
- [x] Prisma client generated successfully
- [x] Seed data loaded for states and cities
- [x] Database indexes created for performance
- [x] Service restarts successfully in Docker

### Phase 2: Service Layer

- [x] GeographicalService with 6+ methods
- [x] ZoneService with 10+ methods
- [x] ZoneCoverageValidationService with 5+ methods
- [x] Redis caching implemented (24h for geo, 2h for zones)
- [x] Transaction support for zone creation
- [x] Comprehensive error handling
- [x] Audit logging for all zone operations

### Phase 3: Controller Layer

- [x] GeographicalController with 9 endpoints
- [x] ZoneController with 10 endpoints
- [x] ZoneCoverageController with 5 endpoints
- [x] Function-based exports (NO inline handlers)
- [x] Proper error handling and logging
- [x] Standard API response format

### Phase 4: Validation & Routes

- [x] 7+ Joi validation schemas
- [x] All routes registered with proper middleware
- [x] Auth middleware applied where needed
- [x] Rate limiting configured
- [x] Input validation on all endpoints

### Phase 5: Documentation & Testing

- [x] Complete Swagger documentation (24+ endpoints)
- [x] Integration tests passing
- [x] Performance benchmarks met
- [x] Health endpoint includes zone service status
- [x] Redis cache working correctly

---

## 📊 API Endpoints Summary

### Geographical Hierarchy (9 endpoints)

- GET `/api/v1/geography/states` - List all states
- GET `/api/v1/geography/cities?stateId=:id` - Get cities by state
- GET `/api/v1/geography/areas?cityId=:id` - Get areas by city
- GET `/api/v1/geography/pincodes?areaId=:id` - Get pincodes by area
- GET `/api/v1/geography/pincodes/search` - Search pincodes
- GET `/api/v1/geography/pincodes/:code` - Get pincode details
- POST `/api/v1/geography/cities/by-states` - Batch get cities
- POST `/api/v1/geography/areas/by-cities` - Batch get areas
- POST `/api/v1/geography/pincodes/by-areas` - Batch get pincodes

### Zone Management (10 endpoints)

- POST `/api/v1/zones` - Create zone
- GET `/api/v1/zones` - List zones
- GET `/api/v1/zones/:id` - Get zone details
- GET `/api/v1/zones/:id/complete` - Get zone with all associations
- PUT `/api/v1/zones/:id` - Update zone
- DELETE `/api/v1/zones/:id` - Delete zone
- GET `/api/v1/zones/:id/services` - Get zone services
- PUT `/api/v1/zones/:id/services` - Update zone services
- GET `/api/v1/zones/:id/geography` - Get zone geography
- PUT `/api/v1/zones/:id/geography` - Update zone geography

### Coverage Validation (5 endpoints)

- POST `/api/v1/zones/coverage/check` - Check pincode serviceability
- GET `/api/v1/zones/coverage/pincode/:code` - Get zones by pincode
- GET `/api/v1/zones/coverage/overlaps` - Detect overlapping zones
- GET `/api/v1/zones/coverage/gaps` - Find coverage gaps
- GET `/api/v1/zones/:id/coverage/validate` - Validate zone coverage

**Total**: 24 new API endpoints

---

## 🔄 Migration from External Partner Service

### Files to Adapt (Not Direct Copy)

1. **Schema Conversion**:
   - Convert SQL schema → Prisma schema
   - Change SERIAL → UUID with @db.Uuid
   - Add proper relations and indexes

2. **Service Layer**:
   - Adapt to auth-service patterns
   - Use shared libraries from `../shared/lib/`
   - Add audit logging for all operations
   - Use Prisma ORM (no raw SQL)

3. **Controller Layer**:
   - Function-based exports (not class methods)
   - Use shared APIResponse format
   - Add proper error handling
   - Partner-scoped operations (multi-tenant)

4. **Validation**:
   - Keep Joi schemas structure
   - Add business rules validation
   - Integrate with validate middleware

5. **Caching**:
   - Use shared Redis client
   - Consistent cache key patterns
   - Cache invalidation on updates

---

## ⚠️ Critical Rules to Follow

### MANDATORY Requirements

1. **Controller Pattern**: ALL business logic in controllers (NO inline route handlers)
2. **Prisma ORM Only**: NO raw SQL queries
3. **UUID Format**: Use `@default(uuid()) @db.Uuid` for all IDs
4. **Audit Logging**: Required for ALL zone create/update/delete operations
5. **Shared Libraries**: Import from `../shared/lib/` not local implementations
6. **Function Exports**: Controllers must use function-based exports
7. **Error Handling**: Comprehensive try-catch with proper error codes
8. **Input Validation**: Joi schemas for ALL endpoints
9. **Authentication**: Auth middleware for zone management endpoints
10. **Rate Limiting**: Apply zoneManagementLimiter middleware

### Redis Caching Strategy

```javascript
// Cache keys pattern
const cacheKeys = {
  states: "geo:states",
  cities: (stateId) => `geo:cities:state:${stateId}`,
  areas: (cityId) => `geo:areas:city:${cityId}`,
  pincodes: (areaId) => `geo:pincodes:area:${areaId}`,
  zone: (partnerId, zoneId) => `zones:${partnerId}:${zoneId}`,
  zoneComplete: (partnerId, zoneId) => `zones:${partnerId}:${zoneId}:complete`,
  partnerZones: (partnerId) => `zones:${partnerId}:list`,
};

// Cache TTL
const cacheTTL = {
  geographical: 24 * 60 * 60, // 24 hours (rarely changes)
  zones: 2 * 60 * 60, // 2 hours (moderate changes)
  coverage: 30 * 60, // 30 minutes (frequently queried)
};
```

---

## 🧪 Verification Protocol

### Pre-Implementation Checklist

- [x] Read this complete task document
- [x] Read external_partner_service zone implementation
- [x] Read BACKEND_TASK.md for reference patterns
- [x] Understand auth-service patterns
- [x] Check context remaining (>50K tokens needed)

### Phase 1 Verification (Database)

```bash
# Generate migration
npx prisma migrate dev --name add_geographical_zone_management

# Check migration success
docker logs logistics-partner-service --tail=50 | grep "migration"

# Generate Prisma client
npx prisma generate

# Restart service
docker-compose restart partner-service

# Check health
curl http://localhost:3005/health
```

### Phase 2-3 Verification (Services & Controllers)

```bash
# Restart service after code changes
docker-compose restart partner-service

# Check logs for errors
docker logs logistics-partner-service --tail=100 | grep "ERROR"

# Test geographical endpoint
curl http://localhost:3005/api/v1/geography/states | jq .

# Test with authentication
curl -X GET http://localhost:3005/api/v1/zones \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .
```

### Phase 4-5 Verification (Routes & Testing)

```bash
# Test zone creation
curl -X POST http://localhost:3005/api/v1/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "North Zone",
    "description": "Northern states coverage",
    "geographical": {
      "states": [1, 2],
      "cities": [10, 11],
      "pincodes": [110001, 110002]
    },
    "services": {
      "PICKUP": true,
      "DELIVERY": true,
      "COD": true
    }
  }' | jq .

# Check Swagger documentation
open http://localhost:3005/api-docs

# Run tests
npm run test:zones
```

### Final Verification

- [x] All 24 endpoints working
- [x] Redis caching verified (check cache hit rates)
- [x] No MODULE_NOT_FOUND errors
- [x] No inline route handlers
- [x] Audit logging working for zone operations
- [x] Health endpoint returns zone service status
- [x] Swagger documentation complete
- [x] Integration tests passing

---

## 📈 Performance Targets

- **Geographical API**: <100ms (cached), <500ms (uncached)
- **Zone Creation**: <2s (with associations)
- **Zone Listing**: <200ms (paginated)
- **Coverage Check**: <300ms
- **Cache Hit Rate**: >70% for geographical data
- **Database Queries**: <100ms (with indexes)

---

## 🎯 Success Metrics

After completion, the partner service should:

1. Support complete geographical hierarchy management
2. Enable partner-specific zone creation and management
3. Provide service type configuration per zone
4. Validate pincode serviceability efficiently
5. Detect zone overlaps and coverage gaps
6. Maintain >70% cache hit rate for geographical data
7. Handle 1000+ zones per partner smoothly
8. Provide comprehensive API documentation

---

## 📚 Reference Documents

- **Source**: `/external_partner_service/ENHANCED_ZONE_DESIGN.md`
- **Architecture**: `/external_partner_service/PRD.md`
- **Task Format**: `/backend/BACKEND_TASK.md`
- **Auth Patterns**: `/backend/auth-service/` (reference implementation)
- **Partner Tasks**: `/backend/PARTNER_SERVICE_TASK.md`

---

## 🚀 Next Steps

After completing this task:

1. Update PARTNER_SERVICE_TASK.md with completion status
2. Update memory-bank/progress.md
3. Create frontend zone management UI
4. Integrate with shipment service for serviceability checking
5. Add zone-based rate calculation support

---

**IMPORTANT NOTES**:

- This is a MAJOR feature addition (5 days estimated)
- Requires careful testing due to geographical data complexity
- Must maintain backward compatibility with existing partner endpoints
- Cache invalidation is critical for data consistency
- Zone overlaps must be detected and prevented
