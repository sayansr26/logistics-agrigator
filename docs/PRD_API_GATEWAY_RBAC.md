# Product Requirements Document (PRD)

# API Gateway Security & RBAC Implementation

## Document Version

- **Version**: 1.0.0
- **Date**: January 2025
- **Author**: Development Team
- **Status**: Approved for Implementation

## Executive Summary

### Problem Statement

The current logistics platform has critical security vulnerabilities with all microservices exposed on public ports, direct API access bypassing the gateway, no comprehensive RBAC implementation in frontend, and inconsistent API documentation.

### Solution

Implement a zero-trust architecture with complete service isolation, centralized API gateway routing, comprehensive 11-role RBAC system, modern Redux/RTK Query frontend, and 100% API documentation coverage.

### Business Impact

- **Security**: Eliminate direct service access vulnerabilities
- **Compliance**: Meet enterprise security standards
- **Scalability**: Centralized routing and permission management
- **Developer Experience**: Unified API documentation and type safety
- **User Experience**: Role-based UI with granular permissions

## Scope & Objectives

### In Scope

1. Complete service isolation (remove all external ports)
2. API Gateway enhancement with JWT validation
3. 11-role RBAC system implementation
4. Frontend architecture with Redux/RTK Query
5. Swagger documentation aggregation
6. Permission-based UI components
7. Task and bug tracking system

### Out of Scope

- Database migration or restructuring
- Third-party service integrations
- UI/UX redesign
- Performance optimization (separate initiative)

### Success Metrics

- 0% direct service accessibility (security test)
- 100% API requests routed through gateway
- 100% API documentation coverage
- <200ms additional latency from gateway routing
- 100% frontend API calls using Redux/RTK Query

## Technical Requirements

### 1. API Gateway Security (P0 - Critical)

#### 1.1 Service Isolation

- **Requirement**: Remove all external port mappings for backend services
- **Implementation**: Modify docker-compose.yml, expose only gateway (3001) and frontend (3000)
- **Validation**: curl to service ports should return connection refused

#### 1.2 Internal Request Validation

- **Requirement**: Services accept requests only from gateway
- **Implementation**: X-Internal-Request header with secret
- **Validation**: Direct service calls return 403 Forbidden

#### 1.3 Gateway Authentication

- **Requirement**: JWT validation before proxying requests
- **Implementation**: Middleware to verify tokens
- **Validation**: Invalid tokens return 401 Unauthorized

### 2. RBAC System (P0 - Critical)

#### 2.1 Role Hierarchy

```
superadmin → admin → client → accounts/sales/support
                  ↓
              customer → customer_account/customer_sales/customer_support
                  ↓
              affiliate
```

#### 2.2 Permission Model

- **Format**: `module:action:scope`
- **Modules**: client, license, customer, shipment, wallet, partner, user, billing, analytics, support, platform, settings
- **Actions**: create, read, update, delete, list, export, manage, approve, assign
- **Scopes**: own, parent, assigned, all, wildcard

#### 2.3 Database Schema

- User model with RBAC fields
- Permission, RolePermission, UserPermission models
- AccessLevel enum (FULL, LIMITED, READ_ONLY)

#### 2.4 Caching Strategy

- Redis cache for permission checks (5-minute TTL)
- Cache invalidation on role/permission changes

### 3. Frontend Architecture (P0 - Critical)

#### 3.1 State Management

- **Technology**: Redux Toolkit with RTK Query
- **Structure**: Centralized store with API, auth, permission slices
- **Middleware**: Auth middleware for token refresh

#### 3.2 API Layer

- **Base URL**: Gateway only (http://localhost:3001/api/v1)
- **Interceptors**: Request (add token), Response (handle 401/403)
- **Type Safety**: Generated TypeScript types from Swagger

#### 3.3 Permission Components

- **Guards**: PermissionGuard, RoleGuard components
- **Hooks**: usePermission, useRole, useCanAccess
- **Dynamic UI**: Menu items and buttons based on permissions

### 4. API Documentation (P1 - High)

#### 4.1 Swagger Aggregation

- **Endpoint**: `/swagger/[service].json` for individual specs
- **Merged**: `/swagger/all.json` for complete API
- **UI**: Optional at `/api-docs` (dev only)

#### 4.2 Documentation Standards

- Every endpoint must include:
  - Request/response schemas
  - RBAC permissions required
  - Example payloads
  - Error responses
  - Gateway URLs (not direct service)

### 5. Task Management (P2 - Medium)

#### 5.1 Tracking Documents

- `BACKEND_GATEWAY_TASK.md` - Backend implementation tasks
- `FRONTEND_ARCHITECTURE_TASK.md` - Frontend tasks
- `BACKEND_BUGS.md` - Bug tracking with fixes
- `API_DOCUMENTATION_STATUS.md` - API doc coverage

#### 5.2 Testing Protocol

1. Test API with Swagger UI
2. Validate with curl commands
3. Document bugs before fixing
4. Re-test after fixes
5. Implement in frontend only after backend validation

## Implementation Plan

### Phase 1: Security Lockdown (Day 1-2)

- Remove service ports from docker-compose
- Add internal request validation
- Implement gateway authentication
- Test service isolation

### Phase 2: RBAC Implementation (Day 3-5)

- Create permission constants
- Update database schemas
- Implement permission checking
- Add scope-based filtering
- Setup Redis caching

### Phase 3: Frontend Architecture (Day 6-9)

- Remove direct service URLs
- Setup Redux with RTK Query
- Implement auth flow
- Create permission hooks
- Add role-based guards

### Phase 4: Documentation & Testing (Day 10-12)

- Complete Swagger specs
- Setup gateway aggregation
- Create tracking documents
- Comprehensive testing
- Bug fixes and validation

## Risk Assessment

### High Risks

1. **Service Downtime**: Mitigate with staged rollout
2. **Permission Errors**: Comprehensive testing, fallback to restrictive
3. **Frontend Breaking**: Feature flags for gradual migration

### Medium Risks

1. **Performance Impact**: Monitor gateway latency
2. **Cache Invalidation**: Implement robust cache clearing
3. **Documentation Drift**: Automated validation scripts

## Testing Strategy

### Unit Tests

- Permission calculation logic
- Scope filtering functions
- Redux reducers and actions

### Integration Tests

- Gateway routing
- Service communication
- Token refresh flow

### E2E Tests

- Complete user journeys per role
- Permission denial scenarios
- API documentation validation

### Security Tests

- Port scanning for exposed services
- Direct service access attempts
- Token manipulation attempts

## Rollout Plan

### Development Environment

1. Implement all changes
2. Run comprehensive tests
3. Team review and feedback

### Staging Environment

1. Deploy with monitoring
2. Load testing
3. Security audit

### Production

1. Blue-green deployment
2. Staged rollout (10% → 50% → 100%)
3. Rollback plan ready

## Monitoring & Success Criteria

### Monitoring

- Gateway response times
- Permission check latency
- Cache hit rates
- Error rates by service
- Failed authentication attempts

### Success Criteria

- ✅ No direct service access
- ✅ 100% gateway routing
- ✅ <200ms added latency
- ✅ 100% API documentation
- ✅ Zero permission bypasses
- ✅ All frontend using Redux

## Appendices

### A. Technical Decisions

- Docker networking for isolation
- Redis for permission caching
- RTK Query for API management
- JWT for authentication

### B. Alternative Approaches Considered

- Service mesh (Istio) - Too complex for current scale
- GraphQL gateway - Would require major refactoring
- Separate permission service - Added complexity

### C. References

- [Docker Networking Documentation](https://docs.docker.com/network/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [RBAC Design Patterns](https://csrc.nist.gov/publications/detail/sp/800-162/final)
