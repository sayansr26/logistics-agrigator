# Active Context - Logistics Aggregator Portal

> Current work focus and priorities | Last Updated: January 24, 2026

## Current Sprint Focus

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

| Service              | Port | Status        | Completion | Current Focus       |
| -------------------- | ---- | ------------- | ---------- | ------------------- |
| **API Gateway**      | 3001 | ✅ Complete   | 90%        | Outlet routes added |
| **Auth Service**     | 3002 | ✅ Production | 100%       | Reference standard  |
| **User Service**     | 3003 | ✅ Production | 100%       | Outlet module added |
| **Shipment Service** | 3004 | 🔄 Active     | 90%        | Bulk operations     |
| **Partner Service**  | 3005 | ✅ Complete   | 100%       | Pincode imports     |
| **Wallet Service**   | 3006 | ✅ Complete   | 100%       | Stable              |
| **License Service**  | 3009 | 🆕 New        | 30%        | Integration pending |
| **Support Service**  | 3007 | ❌ Pending    | 0%         | Not started         |
| **Platform Service** | 3008 | ❌ Pending    | 0%         | Shopify next        |
| **Frontend**         | 3000 | ✅ Production | 65%        | Redux/RTK Query     |

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

2. **Outlet Portal Pages**
   - `/my-shipments` - Outlet's own shipments
   - `/my-addresses` - Outlet's address management
   - Dashboard view for outlet users

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

### Technical Decisions

1. **Prisma ORM Only**: No raw SQL queries
2. **Redis for Caching**: 5-minute TTL for permissions
3. **JWT + Redis Sessions**: Scalable auth pattern
4. **HMAC for External APIs**: Partner and Wallet service auth

## Current Blockers

1. **None currently identified**

## Recent Changes

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
  - `pnpm run import:pincodes` - Dev environment
  - `pnpm run import:pincodes:prod` - Production environment

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

| Purpose             | Location                                               |
| ------------------- | ------------------------------------------------------ |
| Auth patterns       | `backend/auth-service/`                                |
| RBAC permissions    | `shared/constants/permissions.js`                      |
| Outlet routes       | `backend/user-service/routes/outlets.js`               |
| Outlet controller   | `backend/user-service/controllers/outletController.js` |
| Outlet frontend     | `frontend/src/app/outlets/page.tsx`                    |
| Outlet API (RTK)    | `frontend/src/store/api/endpoints/outletApi.ts`        |
| API response format | `shared/lib/response.js`                               |
| Error classes       | `shared/lib/errors.js`                                 |

## Next Steps

1. ~~Complete Outlet Module~~ ✅ DONE
2. Build Outlet Portal pages (my-shipments, my-addresses)
3. Finish License service integration
4. Begin Shipment bulk operations
5. Continue Frontend Redux migration

---

**Sprint**: Audit Logging Enhancement + License Service Integration
**Week**: Active Development
**Next Review**: Weekly
