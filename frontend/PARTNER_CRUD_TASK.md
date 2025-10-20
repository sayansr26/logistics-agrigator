# Courier Partner CRUD Module Tasks

## Overview

Complete implementation of Courier Partner CRUD module following User Management patterns with Redux/RTK Query integration.

**Start Date**: 2025-10-20
**Target Completion**: 2025-10-21
**Priority**: P0 (Critical)
**Dependencies**: RTK Query setup (FE-002 ✅), User Management patterns (FE-011 ✅)

## Architecture Requirements

### Technology Stack

- **State Management**: Redux Toolkit + RTK Query (NO Zustand, NO direct API calls)
- **Language**: TypeScript (convert all .jsx to .tsx)
- **UI Components**: Existing UI components from User Management
- **API Layer**: All calls through API Gateway (port 3001)
- **Permissions**: RBAC with partner-specific permissions

### Patterns to Follow (from User Management)

1. **Multi-step forms** with visual stepper
2. **Statistics cards** at top of list page
3. **Advanced filtering** with visual indicators
4. **Confirmation dialogs** for destructive actions
5. **Success notifications** with query parameters
6. **Loading/error states** with proper UI feedback
7. **Permission guards** for role-based access

---

## 📋 TASK LIST

### Task ID: PARTNER-001

**Task Name**: Test Partner API Endpoints
**Priority**: P0
**Status**: COMPLETED ✅
**Estimated Time**: 30 minutes
**Actual Time**: 20 minutes
**Completed**: 2025-10-20

**Acceptance Criteria**:

- [ ] Test GET /api/v1/partners endpoint
- [ ] Test POST /api/v1/partners endpoint
- [ ] Test PUT /api/v1/partners/:id endpoint
- [ ] Test DELETE /api/v1/partners/:id endpoint
- [ ] Verify JWT authentication required
- [ ] Confirm RBAC permissions working

**Test Commands**:

```bash
# Get partners list
curl -X GET http://localhost:3001/api/v1/partners \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create partner
curl -X POST http://localhost:3001/api/v1/partners \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Blue Dart",
    "displayName": "Blue Dart Express",
    "code": "BD001",
    "apiEndpoint": "https://api.bluedart.com",
    "supportsCOD": true,
    "supportsReverse": true,
    "isActive": true,
    "baseRate": 50,
    "perKgRate": 10,
    "minWeight": 0.5,
    "maxWeight": 50
  }'

# Update partner
curl -X PUT http://localhost:3001/api/v1/partners/PARTNER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"isActive": false}'

# Delete partner
curl -X DELETE http://localhost:3001/api/v1/partners/PARTNER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Task ID: PARTNER-002

**Task Name**: Migrate Partner List Page to RTK Query
**Priority**: P0
**Status**: COMPLETED ✅
**Estimated Time**: 3 hours
**Actual Time**: 1.5 hours
**Completed**: 2025-10-20
**File**: `frontend/src/app/partners/page.jsx` → `page.tsx`

**Implementation Checklist**:

- [ ] Convert file to TypeScript (.tsx)
- [ ] Replace `usePartners` hook with `useGetPartnersQuery()`
- [ ] Add statistics cards (Total, Active, Inactive, Pending)
- [ ] Implement advanced filtering UI (copy from Users)
- [ ] Add search with debouncing
- [ ] Implement pagination with page numbers
- [ ] Add action dropdown menu
- [ ] Add confirmation dialogs for delete/status change
- [ ] Implement success notifications
- [ ] Add proper loading states
- [ ] Add error handling with retry
- [ ] Add permission checks for actions
- [ ] Remove mock data dependencies

**Key Components to Add**:

```typescript
// Statistics Cards
const stats = [
  { title: "Total Partners", value: totalPartners, icon: Truck },
  { title: "Active Partners", value: activeCount, icon: CheckCircle },
  { title: "Inactive Partners", value: inactiveCount, icon: XCircle },
  { title: "Pending Setup", value: pendingCount, icon: Clock },
];

// RTK Query Usage
const {
  data: partnersData,
  isLoading,
  error,
  refetch,
} = useGetPartnersQuery({
  page: currentPage,
  limit: itemsPerPage,
  search: searchTerm,
  isActive: statusFilter !== "all" ? statusFilter === "active" : undefined,
});

// Actions Dropdown
const actions = [
  { label: "View Details", icon: Eye, onClick: handleView },
  { label: "Edit Partner", icon: Edit, onClick: handleEdit },
  { label: "Change Status", icon: Power, onClick: handleStatusChange },
  {
    label: "Delete Partner",
    icon: Trash2,
    onClick: handleDelete,
    danger: true,
  },
];
```

---

### Task ID: PARTNER-003

**Task Name**: Upgrade Add Partner Page with Multi-Step Form
**Priority**: P0
**Status**: NOT_STARTED
**Estimated Time**: 4 hours
**File**: `frontend/src/app/partners/add/page.jsx` → `page.tsx`

**Implementation Checklist**:

- [ ] Convert to TypeScript
- [ ] Implement 5-step form with visual stepper
- [ ] Replace partnersApiService with `useCreatePartnerMutation()`
- [ ] Add step-by-step validation
- [ ] Add partner preview card
- [ ] Implement permission guard
- [ ] Add success redirect with notification
- [ ] Add error handling
- [ ] Add loading states during submission

**Step Structure**:

```typescript
const steps = [
  { id: 1, title: "Basic Information", icon: Info },
  { id: 2, title: "API Configuration", icon: Settings },
  { id: 3, title: "Service Settings", icon: Package },
  { id: 4, title: "Rate Configuration", icon: DollarSign },
  { id: 5, title: "Coverage & Limits", icon: MapPin },
];

// Form Data Structure
interface PartnerFormData {
  // Step 1
  name: string;
  displayName: string;
  code: string;
  type: string;

  // Step 2
  apiEndpoint: string;
  apiKey: string;
  authType: "api_key" | "oauth" | "basic";

  // Step 3
  supportsCOD: boolean;
  supportsReverse: boolean;
  supportedServices: string[];

  // Step 4
  baseRate: number;
  perKgRate: number;
  fuelSurcharge: number;
  codCharges: number;

  // Step 5
  minWeight: number;
  maxWeight: number;
  servicePincodes: string[];
  isActive: boolean;
}
```

---

### Task ID: PARTNER-004

**Task Name**: Enhance Edit Partner Page
**Priority**: P1
**Status**: NOT_STARTED
**Estimated Time**: 2 hours
**File**: `frontend/src/app/partners/[id]/edit/page.jsx` → `page.tsx`

**Implementation Checklist**:

- [ ] Convert to TypeScript
- [ ] Use same multi-step form as Add page
- [ ] Load data with `useGetPartnerByIdQuery()`
- [ ] Update with `useUpdatePartnerMutation()`
- [ ] Disable partner code field (immutable)
- [ ] Add loading skeleton during fetch
- [ ] Handle not found errors
- [ ] Add permission checks
- [ ] Success redirect to detail page

---

### Task ID: PARTNER-005

**Task Name**: Improve Partner Detail Page
**Priority**: P1
**Status**: NOT_STARTED
**Estimated Time**: 3 hours
**File**: `frontend/src/app/partners/[id]/page.jsx` → `page.tsx`

**Implementation Checklist**:

- [ ] Convert to TypeScript
- [ ] Add hero section with partner info
- [ ] Implement tabbed interface
- [ ] Add statistics cards
- [ ] Display all information in cards
- [ ] Add action buttons
- [ ] Use `useGetPartnerByIdQuery()`
- [ ] Add permission-based actions

**Tab Structure**:

```typescript
const tabs = [
  { value: "overview", label: "Overview", icon: Info },
  { value: "services", label: "Services", icon: Package },
  { value: "rates", label: "Rates", icon: DollarSign },
  { value: "performance", label: "Performance", icon: TrendingUp },
];
```

---

### Task ID: PARTNER-006

**Task Name**: Create Reusable Partner Components
**Priority**: P2
**Status**: NOT_STARTED
**Estimated Time**: 2 hours

**Components to Create**:

- [ ] `PartnerStatusBadge.tsx` - Status indicator with colors
- [ ] `PartnerTypeBadge.tsx` - Partner type badge
- [ ] `PartnerActionsDropdown.tsx` - Reusable actions menu
- [ ] `PartnerStatsCards.tsx` - Statistics display
- [ ] `PartnerFormStepper.tsx` - Multi-step form stepper

---

### Task ID: PARTNER-007

**Task Name**: Add Permission Controls
**Priority**: P1
**Status**: NOT_STARTED
**Estimated Time**: 1 hour

**Implementation Checklist**:

- [ ] Add permission checks in list page
- [ ] Guard Add page (only certain roles)
- [ ] Guard Edit page
- [ ] Guard Delete action
- [ ] Guard Status change action
- [ ] Hide actions based on permissions

**Permission Mappings**:

```typescript
const PARTNER_PERMISSIONS = {
  CREATE: "partner:create:all",
  UPDATE: "partner:update:all",
  DELETE: "partner:delete:all",
  MANAGE: "partner:manage:all",
  VIEW: "partner:read:all",
};

// Usage
const canCreate = hasPermission("partner", "create", "all");
const canEdit = hasPermission("partner", "update", "all");
const canDelete = hasPermission("partner", "delete", "all");
```

---

### Task ID: PARTNER-008

**Task Name**: Testing & Validation
**Priority**: P0
**Status**: NOT_STARTED
**Estimated Time**: 2 hours

**Test Checklist**:

- [ ] Create new partner with all fields
- [ ] Edit existing partner
- [ ] Delete partner (with confirmation)
- [ ] Activate/Deactivate partners
- [ ] Search partners by name/code
- [ ] Filter by status
- [ ] Pagination works
- [ ] Permission checks work
- [ ] Success notifications appear
- [ ] Error handling works
- [ ] Loading states display
- [ ] Form validation on all steps
- [ ] Build passes without errors

---

## 📊 Progress Summary

| Priority | Total | Not Started | In Progress | Completed | Blocked |
| -------- | ----- | ----------- | ----------- | --------- | ------- |
| P0       | 4     | 4           | 0           | 0         | 0       |
| P1       | 3     | 3           | 0           | 0         | 0       |
| P2       | 1     | 1           | 0           | 0         | 0       |

**Overall Progress**: 0/8 tasks completed (0%)

## 🎯 Success Criteria

### Functional Requirements

- [x] All CRUD operations work via RTK Query
- [ ] Multi-step forms with validation
- [ ] Real-time search and filtering
- [ ] Permission-based access control
- [ ] Success/error notifications

### Technical Requirements

- [ ] 100% TypeScript (no .jsx files remain)
- [ ] All API calls through API Gateway
- [ ] Redux/RTK Query for state management
- [ ] Proper loading and error states
- [ ] No console errors or warnings

### UI/UX Requirements

- [ ] Matches User Management patterns exactly
- [ ] Consistent color schemes and badges
- [ ] Responsive design
- [ ] Smooth transitions
- [ ] Professional look and feel

## 🚨 Important Notes

1. **DO NOT modify User Management** - Keep Users and Partners separate
2. **Partners are NOT users** - They are courier service providers
3. **Use existing partnersApi.ts** - Has all required endpoints
4. **Follow RBAC patterns** - Check permissions before actions
5. **Test with curl first** - Verify API before UI work
6. **TypeScript only** - Convert all .jsx files to .tsx

## Common Patterns Reference

### Success Notification Pattern

```typescript
// After successful operation
router.push("/partners?success=partner-created");

// On list page
useEffect(() => {
  const success = searchParams.get("success");
  if (success === "partner-created") {
    setShowSuccessMessage(true);
    router.replace("/partners", { scroll: false });
    setTimeout(() => setShowSuccessMessage(false), 5000);
    refetch();
  }
}, [searchParams]);
```

### Confirmation Dialog Pattern

```typescript
const handleDelete = async () => {
  try {
    await deletePartner(partnerId).unwrap();
    closeDialog();
    router.push("/partners?success=partner-deleted");
  } catch (error) {
    console.error("Failed to delete:", error);
    toast.error("Failed to delete partner");
  }
};
```

### Loading State Pattern

```typescript
if (isLoading) {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    </DashboardLayout>
  );
}
```

---

**Last Updated**: 2025-10-20
**Next Review**: End of Day 1 (2025-10-20)
