# Active Context - Logistics Aggregator Portal

> Current work focus and priorities | Last Updated: December 2024

## Current Sprint Focus

### 🔒 API Gateway Security & 11-Role RBAC Implementation (P0 - Critical)

**Reference Document**: `docs/PRD_API_GATEWAY_RBAC.md`

The primary focus is implementing a robust security layer and role-based access control system across all services.

### Sprint Phases

| Phase   | Description                       | Status         |
| ------- | --------------------------------- | -------------- |
| Phase 1 | Service isolation via API Gateway | 🔄 In Progress |
| Phase 2 | Granular permission system        | 📋 Planned     |
| Phase 3 | Frontend Redux/RTK migration      | 📋 Planned     |
| Phase 4 | 100% Swagger documentation        | 📋 Planned     |

## Service Status Overview

| Service              | Port | Status        | Completion | Current Focus       |
| -------------------- | ---- | ------------- | ---------- | ------------------- |
| **API Gateway**      | 3001 | 🔄 Upgrading  | 60%        | RBAC integration    |
| **Auth Service**     | 3002 | ✅ Production | 100%       | Reference standard  |
| **User Service**     | 3003 | ✅ Production | 100%       | Stable              |
| **Shipment Service** | 3004 | 🔄 Active     | 90%        | Bulk operations     |
| **Partner Service**  | 3005 | ✅ Complete   | 100%       | Stable              |
| **Wallet Service**   | 3006 | ✅ Complete   | 100%       | Stable              |
| **License Service**  | 3009 | 🆕 New        | 30%        | Integration pending |
| **Support Service**  | 3007 | ❌ Pending    | 0%         | Not started         |
| **Platform Service** | 3008 | ❌ Pending    | 0%         | Shopify next        |
| **Frontend**         | 3000 | 🔄 Migrating  | 40%        | Redux/RTK Query     |

## Immediate Priorities

### P0 - Critical (This Week)

1. **Complete API Gateway RBAC Integration**
   - Implement permission middleware
   - Add Redis caching for permissions
   - Test with all 11 roles

2. **License Service Integration**
   - Connect license validation to auth flow
   - Implement tenant isolation
   - Add license limit enforcement

### P1 - High Priority (Next Week)

1. **Shipment Service Bulk Operations**
   - CSV upload and parsing
   - Bulk AWB generation
   - Error handling and reporting

2. **Frontend State Migration**
   - Migrate Zustand stores to Redux
   - Implement RTK Query for API calls
   - Update components for new state

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

### Technical Decisions

1. **Prisma ORM Only**: No raw SQL queries
2. **Redis for Caching**: 5-minute TTL for permissions
3. **JWT + Redis Sessions**: Scalable auth pattern
4. **HMAC for External APIs**: Partner and Wallet service auth

## Current Blockers

1. **None currently identified**

## Recent Changes

### December 2024

- ✅ Auth service production-ready
- ✅ User service production-ready
- ✅ Partner service complete
- ✅ Wallet service complete
- 🔄 API Gateway RBAC implementation started
- 🔄 License service development in progress

## Development Focus Areas

### Backend Team

- API Gateway security enhancement
- License service completion
- Shipment service bulk operations

### Frontend Team

- Redux/RTK Query migration
- Dashboard component updates
- Form validation improvements

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

## Key Reference Files

| Purpose             | Location                          |
| ------------------- | --------------------------------- |
| Auth patterns       | `backend/auth-service/`           |
| RBAC permissions    | `shared/constants/permissions.js` |
| API response format | `shared/lib/response.js`          |
| Error classes       | `shared/lib/errors.js`            |
| Current PRD         | `docs/PRD_API_GATEWAY_RBAC.md`    |

## Next Steps

1. Complete Phase 1 of API Gateway RBAC
2. Finish License service integration
3. Begin Shipment bulk operations
4. Start Frontend Redux migration

---

**Sprint**: API Gateway Security  
**Week**: Active Development  
**Next Review**: Weekly
