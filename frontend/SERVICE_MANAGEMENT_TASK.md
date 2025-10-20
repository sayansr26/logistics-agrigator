# Service Management CRUD Tasks

## Overview

Implementation of complete Service Management module for monitoring and managing microservices in the logistics platform.

## Reference Pattern

Following the User Management CRUD implementation as the reference pattern for:

- Redux/RTK Query integration
- TypeScript components
- UI/UX consistency
- Permission-based access control
- Error handling and loading states

## Priority Levels

- **P0**: Critical functionality (must complete)
- **P1**: Core features (should complete)
- **P2**: Enhancements (nice to have)

---

## 📋 TASK LIST

### Phase 1: Backend Preparation

#### Task ID: SM-BACKEND-001

**Task Name**: Test Existing Service Management APIs
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 30 minutes

**Objectives**:

- Test /api/v1/services-status endpoint
- Test /api/v1/system-health endpoint
- Test /api/v1/system-configuration endpoint
- Document available endpoints and their responses

**API Endpoints to Test**:

```bash
# Get services status
GET /api/v1/services-status

# Get system health
GET /api/v1/system-health

# Get system configuration
GET /api/v1/system-configuration

# Update system configuration
PUT /api/v1/system-configuration
```

#### Task ID: SM-BACKEND-002

**Task Name**: Create Missing CRUD Endpoints
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 2 hours

**Required Endpoints**:

- `POST /api/v1/services` - Create service configuration
- `GET /api/v1/services` - List all services with pagination
- `GET /api/v1/services/:id` - Get specific service details
- `PUT /api/v1/services/:id` - Update service configuration
- `DELETE /api/v1/services/:id` - Remove service
- `PATCH /api/v1/services/:id/status` - Start/stop/restart service

**Implementation Location**: `backend/partner-service/routes/serviceManagement.js`

---

### Phase 2: Frontend RTK Query Setup

#### Task ID: SM-FRONTEND-001

**Task Name**: Create Service API with RTK Query
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 1 hour

**File**: `frontend/src/store/api/endpoints/serviceApi.ts`

**Required Endpoints**:

```typescript
-useGetServicesQuery -
  useGetServiceByIdQuery -
  useCreateServiceMutation -
  useUpdateServiceMutation -
  useDeleteServiceMutation -
  useStartServiceMutation -
  useStopServiceMutation -
  useRestartServiceMutation;
```

**TypeScript Interfaces**:

```typescript
interface Service {
  id: string;
  name: string;
  displayName: string;
  status: "running" | "stopped" | "degraded" | "maintenance";
  port: number;
  version: string;
  uptime?: number;
  healthEndpoint?: string;
  description?: string;
  configuration?: ServiceConfiguration;
  statistics?: ServiceStatistics;
  lastHealthCheck?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

### Phase 3: Frontend Pages Implementation

#### Task ID: SM-FRONTEND-002

**Task Name**: Service List Page
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 2 hours

**File**: `frontend/src/app/services/page.tsx`

**Features**:

- Statistics cards (Total Services, Running, Stopped, Degraded)
- Search functionality
- Filter by status
- Sortable table with columns:
  - Service Name
  - Status (with color badges)
  - Port
  - Version
  - Uptime
  - Health
  - Actions (View, Edit, Restart, Stop/Start)
- Pagination
- Permission-based actions (admin only)

**UI Components**:

- Use Skeleton loading states
- Error boundary implementation
- Success/error toast notifications
- Confirmation dialogs for destructive actions

#### Task ID: SM-FRONTEND-003

**Task Name**: Add Service Page
**Priority**: P1
**Status**: ❌ Not Started
**Estimated Time**: 1.5 hours

**File**: `frontend/src/app/services/add/page.tsx`

**Form Fields**:

- Service Name (required, unique)
- Display Name (required)
- Port Number (required, validate range 1000-65535)
- Version (required, semantic versioning)
- Health Endpoint (required, default: /health)
- Description (optional, textarea)
- Configuration Settings:
  - Environment (dropdown)
  - Feature toggles (checkboxes)
  - Rate limiting settings
  - Dependencies (multi-select)

**Validation**:

- Joi schema validation
- Real-time field validation
- Duplicate port checking
- Submit with loading state

#### Task ID: SM-FRONTEND-004

**Task Name**: View Service Details Page
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 1.5 hours

**File**: `frontend/src/app/services/[id]/page.tsx`

**Sections**:

1. **Service Information**
   - Basic details card
   - Status indicator with real-time updates
   - Version and uptime display

2. **Health Status**
   - Component health checks
   - Last check timestamp
   - Health history graph (if available)

3. **Configuration**
   - Current configuration display
   - Feature flags status
   - Dependencies list

4. **Statistics**
   - Request count
   - Success/error rates
   - Response time metrics
   - Memory/CPU usage

5. **Actions**
   - Edit Configuration button
   - Start/Stop/Restart controls
   - Maintenance mode toggle
   - Delete service (with confirmation)

#### Task ID: SM-FRONTEND-005

**Task Name**: Edit Service Page
**Priority**: P1
**Status**: ❌ Not Started
**Estimated Time**: 1.5 hours

**File**: `frontend/src/app/services/[id]/edit/page.tsx`

**Features**:

- Pre-populated form with current values
- Only editable fields shown
- Configuration update section
- Version upgrade option
- Save with validation
- Cancel with confirmation if changes made
- Audit logging for changes

---

### Phase 4: Integration & Testing

#### Task ID: SM-TEST-001

**Task Name**: Frontend CRUD Testing
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 1 hour

**Test Scenarios**:

- Create new service
- List services with filters
- View service details
- Update service configuration
- Start/stop service
- Delete service
- Permission-based access (different roles)

#### Task ID: SM-TEST-002

**Task Name**: Build Verification
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 30 minutes

**Tasks**:

```bash
# Run build
cd frontend
pnpm run build

# Check for TypeScript errors
# Fix any ESLint warnings
# Verify no broken imports

# Restart container
docker-compose restart frontend
```

---

### Phase 5: Documentation & Memory Bank

#### Task ID: SM-DOC-001

**Task Name**: Update Memory Bank
**Priority**: P0
**Status**: ❌ Not Started
**Estimated Time**: 15 minutes

**Files to Update**:

- `memory-bank/activeContext.md` - Add Service Management as current priority
- `memory-bank/progress.md` - Document completion status

---

## Success Criteria

- [ ] All backend APIs tested and documented
- [ ] RTK Query endpoints created with TypeScript
- [ ] All CRUD pages functional with proper UX
- [ ] Permission-based access control working
- [ ] Loading states and error handling implemented
- [ ] Build passes without errors
- [ ] Frontend container restarts successfully
- [ ] Memory bank updated

## Dependencies

- User Management module (reference implementation) ✅
- Partner Management module (recently completed) ✅
- Redux/RTK Query setup ✅
- Authentication system ✅
- RBAC permissions system ✅

## Notes

1. **Backend Routing Issue**: The system management routes in partner-service have routing conflicts. May need to reorganize routes or create separate service management microservice.

2. **Mock Data**: If backend APIs are not available, use mock data in RTK Query transformResponse for development.

3. **Real-time Updates**: Consider implementing WebSocket connections for real-time service status updates in future iteration.

4. **Monitoring Integration**: Future enhancement to integrate with monitoring tools like Prometheus/Grafana.

---

**Created**: 2025-10-20
**Last Updated**: 2025-10-20
**Sprint**: Frontend Architecture Migration
**Assignee**: Claude Code
