# Partner Service Backend Fixes

## Overview

Fix and enhance Partner Service backend API to ensure full CRUD functionality works correctly.

**Start Date**: 2025-10-20
**Priority**: P0 (CRITICAL - Blocking Frontend)
**Status**: IN PROGRESS

## Issues Identified

### 1. Field Name Mismatches

- **Frontend expects**: `apiEndpoint`, `apiKey`, `minWeight`
- **Backend accepts**: `apiUrl`, `apiToken`, `maxWeight` only
- **Solution**: Update frontend types to match backend OR update backend to accept both

### 2. Missing Features

- [ ] Search functionality not implemented (no search parameter in getAllPartners)
- [ ] Pagination not implemented (no page/limit handling)
- [ ] Sorting not implemented (no sortBy/sortOrder)
- [ ] Bulk operations not available
- [ ] Audit logging missing for CRUD operations

### 3. Validation Issues

- [ ] Duplicate code check works but needs better error message
- [ ] Some fields accept null but should have defaults
- [ ] servicePincodes requires minimum 1 item but should allow empty array

### 4. DELETE Endpoint Issue

- [ ] DELETE seems to be failing or not implemented properly
- [ ] Need to verify soft delete vs hard delete strategy

---

## Tasks

### TASK: PARTNER-BE-001

**Name**: Add Search, Pagination, and Sorting
**Status**: NOT_STARTED
**File**: `backend/partner-service/controllers/partnerController.js`

**Implementation**:

```javascript
async function getAllPartners(filters = {}) {
  const {
    isActive,
    supportsCOD,
    supportsReverse,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const where = {
    ...(typeof isActive === "boolean" && { isActive }),
    ...(typeof supportsCOD === "boolean" && { supportsCOD }),
    ...(typeof supportsReverse === "boolean" && { supportsReverse }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const skip = (page - 1) * limit;

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            shipments: true,
            rates: true,
          },
        },
      },
    }),
    prisma.partner.count({ where }),
  ]);

  return {
    partners,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

---

### TASK: PARTNER-BE-002

**Name**: Add Audit Logging
**Status**: NOT_STARTED
**File**: `backend/partner-service/controllers/partnerController.js`

**Add to createPartner, updatePartner, deletePartner**:

```javascript
// After successful operation
await prisma.auditLog.create({
  data: {
    userId: req.user?.id || "system",
    action: "CREATE", // or UPDATE, DELETE
    resource: "partner",
    resourceId: partner.id,
    changes: data, // or diff for updates
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  },
});
```

---

### TASK: PARTNER-BE-003

**Name**: Fix DELETE Endpoint
**Status**: NOT_STARTED
**File**: `backend/partner-service/controllers/partnerController.js`

**Implementation**:

```javascript
async function deletePartner(id, req = {}) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      _count: {
        select: { shipments: true },
      },
    },
  });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  // Check if partner has shipments
  if (partner._count.shipments > 0) {
    // Soft delete - just deactivate
    const updated = await prisma.partner.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || "system",
        action: "DEACTIVATE",
        resource: "partner",
        resourceId: id,
        changes: { isActive: false },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    return updated;
  }

  // Hard delete if no shipments
  await prisma.partner.delete({
    where: { id },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || "system",
      action: "DELETE",
      resource: "partner",
      resourceId: id,
      changes: null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });

  return { deleted: true };
}
```

---

### TASK: PARTNER-BE-004

**Name**: Update Routes with Query Parameters
**Status**: NOT_STARTED
**File**: `backend/partner-service/routes/partners.js`

**Update GET / route**:

```javascript
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  async (req, res, next) => {
    try {
      const {
        isActive,
        supportsCOD,
        supportsReverse,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const filters = {
        ...(typeof isActive === "string" && { isActive: isActive === "true" }),
        ...(typeof supportsCOD === "string" && {
          supportsCOD: supportsCOD === "true",
        }),
        ...(typeof supportsReverse === "string" && {
          supportsReverse: supportsReverse === "true",
        }),
        search,
        page: page || 1,
        limit: limit || 10,
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
      };

      const result = await partnerController.getAllPartners(filters);
      res.json(APIResponse.success(result)); // Returns { partners, pagination }
    } catch (error) {
      next(error);
    }
  },
);
```

---

### TASK: PARTNER-BE-005

**Name**: Add Bulk Operations
**Status**: NOT_STARTED
**Files**: Create new routes and controller methods

**New endpoints needed**:

- POST /api/partners/bulk/activate - Activate multiple partners
- POST /api/partners/bulk/deactivate - Deactivate multiple partners
- DELETE /api/partners/bulk - Delete multiple partners

**Implementation**:

```javascript
// In partnerController.js
async function bulkUpdateStatus(ids, isActive, req = {}) {
  const updated = await prisma.partner.updateMany({
    where: { id: { in: ids } },
    data: { isActive },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || "system",
      action: isActive ? "BULK_ACTIVATE" : "BULK_DEACTIVATE",
      resource: "partner",
      resourceId: ids.join(","),
      changes: { isActive, count: updated.count },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });

  return updated;
}

// In routes/partners.js
router.post(
  "/bulk/activate",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  validateBody(
    Joi.object({
      ids: Joi.array().items(Joi.string()).min(1).required(),
    }),
  ),
  async (req, res, next) => {
    try {
      const result = await partnerController.bulkUpdateStatus(
        req.body.ids,
        true,
        req,
      );
      res.json(APIResponse.success(result));
    } catch (error) {
      next(error);
    }
  },
);
```

---

### TASK: PARTNER-BE-006

**Name**: Fix Validation Schema
**Status**: NOT_STARTED
**File**: `backend/partner-service/validation/partnerSchema.js`

**Changes needed**:

```javascript
const partnerSchema = {
  create: Joi.object({
    // ... existing fields ...

    // Make servicePincodes optional with empty array default
    servicePincodes: Joi.array()
      .items(Joi.string().pattern(/^\d{6}$/))
      .default([]), // Allow empty array

    // Add minWeight field
    minWeight: Joi.number().positive().allow(null),

    // Support both field names for compatibility
    apiEndpoint: Joi.string().uri(), // Alias for apiUrl
    apiKey: Joi.string().trim(), // Alias for apiToken
  }),

  // ... similar changes for update schema
};
```

---

### TASK: PARTNER-BE-007

**Name**: Ensure Prisma Schema Has All Fields
**Status**: NOT_STARTED
**File**: `backend/partner-service/prisma/schema.prisma`

**Check for**:

- AuditLog model exists
- Partner model has all required fields
- Proper indexes for search performance

```prisma
model Partner {
  id          String  @id @default(cuid())
  name        String  @unique
  code        String  @unique
  displayName String
  isActive    Boolean @default(true)

  // API Configuration
  apiUrl      String?
  apiEndpoint String? @map("api_url") // Map to same column
  apiToken    String?
  apiKey      String? @map("api_token") // Map to same column
  apiVersion  String?

  // Service Configuration
  supportsCOD     Boolean @default(false)
  supportsReverse Boolean @default(false)
  minWeight       Float?
  maxWeight       Float?
  maxDimensions   Json?

  // Pricing
  baseRate         Float?
  perKgRate        Float?
  codChargePercent Float?
  fuelSurcharge    Float?

  // Service Areas
  servicePincodes String[]

  // Relations
  shipments Shipment[]
  rates     PartnerRate[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name, code])
  @@index([isActive])
  @@map("partners")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String?  @db.Uuid
  action     String   @db.VarChar(50)
  resource   String   @db.VarChar(100)
  resourceId String?  @db.Uuid
  changes    Json?
  ipAddress  String?  @db.VarChar(50)
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([userId, resource, createdAt])
  @@map("audit_logs")
}
```

---

## Testing Checklist

After implementing all fixes, test with curl:

- [ ] GET /api/v1/partners with search parameter
- [ ] GET /api/v1/partners with pagination (page, limit)
- [ ] GET /api/v1/partners with sorting (sortBy, sortOrder)
- [ ] POST /api/v1/partners with all fields
- [ ] POST /api/v1/partners with minWeight field
- [ ] PUT /api/v1/partners/:id with partial update
- [ ] DELETE /api/v1/partners/:id (verify soft/hard delete)
- [ ] POST /api/v1/partners/bulk/activate
- [ ] POST /api/v1/partners/bulk/deactivate
- [ ] Verify audit logs are created for all operations
- [ ] Test with both apiUrl/apiEndpoint field names
- [ ] Test with both apiToken/apiKey field names

---

## Frontend API Type Updates

After backend fixes, update `frontend/src/store/api/endpoints/partnersApi.ts`:

```typescript
interface CreatePartnerRequest {
  name: string;
  displayName: string;
  code: string;
  apiUrl?: string; // Backend field
  apiEndpoint?: string; // Alias (optional)
  apiToken?: string; // Backend field
  apiKey?: string; // Alias (optional)
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  minWeight?: number; // New field
  maxWeight?: number;
  servicePincodes?: string[];
}
```

---

## Priority Order

1. **PARTNER-BE-001** - Search/Pagination (CRITICAL for list page)
2. **PARTNER-BE-004** - Update routes (goes with BE-001)
3. **PARTNER-BE-002** - Audit logging (REQUIRED by CLAUDE.md)
4. **PARTNER-BE-003** - Fix DELETE (CRITICAL for CRUD)
5. **PARTNER-BE-006** - Fix validation (improves UX)
6. **PARTNER-BE-007** - Update schema (if needed)
7. **PARTNER-BE-005** - Bulk operations (nice to have)

---

**Last Updated**: 2025-10-20
**Assigned**: Backend Team
**Reviewer**: Lead Developer
