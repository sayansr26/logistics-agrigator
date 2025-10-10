# RBAC-005: Service Integration & Route Protection

**Status**: IN_PROGRESS
**Started**: 2025-01-10
**Dependencies**: RBAC-001 ✅, RBAC-002 ✅, RBAC-003 ✅, RBAC-004 ✅

## Implementation Summary

### Phase 1: Scope Filtering Utility ✅

**Location**: `/Volumes/WorkPro/WebProjects/logistics-main/shared/lib/auth.js`

Added `authUtils.applyScopeFilter(req, baseWhere)` function that:

- Takes Express request with authenticated user
- Applies role-based data filtering to Prisma queries
- Supports all 11 roles (superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, affiliate)
- Filters data based on accessLevel (FULL, RESTRICTED, READ_ONLY)
- Handles assignedCustomerIds for restricted access users

### Phase 2: Route Protection Application

## Services Analysis & Protection Plan

### 1. Auth Service (Port 3002)

**Routes**: `/Volumes/WorkPro/WebProjects/logistics-main/backend/auth-service/routes/auth.js`

| Endpoint                            | Current Auth                        | Required Permission | Scope | Status              |
| ----------------------------------- | ----------------------------------- | ------------------- | ----- | ------------------- |
| POST `/auth/register`               | Rate limited                        | N/A (public)        | -     | ✅ OK               |
| POST `/auth/login`                  | Rate limited                        | N/A (public)        | -     | ✅ OK               |
| POST `/auth/refresh`                | None                                | N/A (public)        | -     | ✅ OK               |
| POST `/auth/logout`                 | None                                | N/A (semi-public)   | -     | ✅ OK               |
| POST `/auth/logout-all`             | `authenticate`                      | N/A (own user)      | own   | ✅ OK               |
| POST `/auth/admin/cleanup-sessions` | `authenticate`, `adminOnly`         | `user:manage:all`   | all   | 🔄 NEEDS PERMISSION |
| POST `/auth/admin/blacklist-token`  | `authenticate`, `adminOnly`         | `user:manage:all`   | all   | 🔄 NEEDS PERMISSION |
| GET `/auth/me`                      | `authenticate`                      | N/A (own user)      | own   | ✅ OK               |
| GET `/auth/profile`                 | `authenticate`, `enrichUserContext` | N/A (own user)      | own   | ✅ OK               |

**Action Items**:

- Add permission middleware to admin endpoints
- No scope filtering needed (auth operations don't query lists)

---

### 2. User Service (Port 3003)

**Routes**:

- `/Volumes/WorkPro/WebProjects/logistics-main/backend/user-service/routes/clients.js`
- `/Volumes/WorkPro/WebProjects/logistics-main/backend/user-service/routes/users.js`

#### Client Routes

| Endpoint                             | Current Auth                                                     | Required Permission        | Scope  | Status                      |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------- | ------ | --------------------------- |
| POST `/clients/register`             | `authenticate`                                                   | `client:register:all`      | all    | 🔄 NEEDS PERMISSION         |
| POST `/clients`                      | `adminOnly`                                                      | `client:create:all`        | all    | 🔄 NEEDS PERMISSION         |
| GET `/clients`                       | `requireRole(['admin', 'support', 'operations'])`                | `client:list:all`          | all    | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/clients/:id`                   | `authenticate`                                                   | `client:read:all/parent`   | parent | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/clients/:id`                   | `authenticate`                                                   | `client:update:all/parent` | parent | 🔄 NEEDS PERMISSION + SCOPE |
| DELETE `/clients/:id`                | `adminOnly`                                                      | `client:delete:all`        | all    | 🔄 NEEDS PERMISSION         |
| PUT `/clients/:id/activate`          | `adminOnly`                                                      | `client:manage:all`        | all    | 🔄 NEEDS PERMISSION         |
| GET `/clients/stats`                 | `requireRole(['admin', 'support'])`                              | `analytics:read:all`       | all    | 🔄 NEEDS PERMISSION         |
| GET `/clients/:clientId/users`       | `authenticate`, `requireClientAccess`, `requireOwnClientOrAdmin` | `user:read:parent`         | parent | 🔄 NEEDS PERMISSION         |
| GET `/clients/:clientId/invitations` | `authenticate`, `requireClientAccess`, `requireOwnClientOrAdmin` | `user:read:parent`         | parent | 🔄 NEEDS PERMISSION         |
| GET `/clients/:clientId/stats`       | `authenticate`, `requireClientAccess`, `requireOwnClientOrAdmin` | `analytics:read:parent`    | parent | 🔄 NEEDS PERMISSION         |

#### Client Settings Routes

| Endpoint                                  | Current Auth                           | Required Permission      | Scope  | Status                      |
| ----------------------------------------- | -------------------------------------- | ------------------------ | ------ | --------------------------- |
| POST `/client-settings`                   | `requireRole(['admin', 'operations'])` | `settings:create:all`    | all    | 🔄 NEEDS PERMISSION         |
| GET `/client-settings/:clientId`          | `authenticate`                         | `settings:read:parent`   | parent | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/client-settings/:clientId`          | `requireRole(['admin', 'operations'])` | `settings:update:parent` | parent | 🔄 NEEDS PERMISSION         |
| DELETE `/client-settings/:clientId`       | `adminOnly`                            | `settings:delete:all`    | all    | 🔄 NEEDS PERMISSION         |
| GET `/client-settings/:clientId/validate` | `authenticate`                         | `settings:read:parent`   | parent | 🔄 NEEDS PERMISSION         |
| GET `/public/branding/:slug`              | None (public)                          | N/A                      | -      | ✅ OK                       |

#### User Profile Routes

| Endpoint                           | Current Auth                                                     | Required Permission         | Scope           | Status                      |
| ---------------------------------- | ---------------------------------------------------------------- | --------------------------- | --------------- | --------------------------- |
| POST `/profiles`                   | `authenticate`                                                   | N/A (own user)              | own             | ✅ OK                       |
| GET `/profiles/me`                 | `authenticate`                                                   | N/A (own user)              | own             | ✅ OK                       |
| GET `/profiles`                    | `authenticate`, `requireClientAccess`                            | `user:list:parent/assigned` | parent/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/profiles/:id`                | `authenticate`                                                   | `user:read:own/assigned`    | own/assigned    | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/profiles/:id`                | `authenticate`                                                   | `user:update:own/assigned`  | own/assigned    | 🔄 NEEDS PERMISSION + SCOPE |
| DELETE `/profiles/:id`             | `authenticate`, `requireRole(['admin', 'client'])`               | `user:delete:own/parent`    | own/parent      | 🔄 NEEDS PERMISSION         |
| GET `/admin/profiles`              | `adminOnly`                                                      | `user:list:all`             | all             | 🔄 NEEDS PERMISSION         |
| PUT `/admin/profiles/:id/verify`   | `adminOnly`                                                      | `user:manage:all`           | all             | 🔄 NEEDS PERMISSION         |
| PUT `/admin/profiles/:id/activate` | `adminOnly`                                                      | `user:manage:all`           | all             | 🔄 NEEDS PERMISSION         |
| GET `/support/profiles/search`     | `requireRole(['support', 'admin'])`                              | `user:read:all`             | all             | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/clients/:clientId/profiles`  | `authenticate`, `requireClientAccess`, `requireOwnClientOrAdmin` | `user:list:parent`          | parent          | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/profiles/stats`              | `requireRole(['operations', 'finance', 'admin', 'support'])`     | `analytics:read:all/parent` | all/parent      | 🔄 NEEDS PERMISSION         |

#### User Invitation Routes

| Endpoint                                  | Current Auth                                      | Required Permission      | Scope      | Status                      |
| ----------------------------------------- | ------------------------------------------------- | ------------------------ | ---------- | --------------------------- |
| POST `/invitations`                       | `requireRole(['admin', 'operations'])`            | `user:create:parent`     | parent     | 🔄 NEEDS PERMISSION         |
| GET `/invitations`                        | `requireRole(['admin', 'support', 'operations'])` | `user:read:parent/all`   | parent/all | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/invitations/:id`                    | `authenticate`                                    | `user:read:parent/own`   | parent/own | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/invitations/:id`                    | `requireRole(['admin', 'operations'])`            | `user:update:parent`     | parent     | 🔄 NEEDS PERMISSION         |
| POST `/invitations/:id/cancel`            | `authenticate`                                    | `user:update:own/parent` | own/parent | 🔄 NEEDS PERMISSION         |
| POST `/invitations/:id/resend`            | `requireRole(['admin', 'operations'])`            | `user:update:parent`     | parent     | 🔄 NEEDS PERMISSION         |
| GET `/invitations/stats`                  | `requireRole(['admin', 'support'])`               | `analytics:read:all`     | all        | 🔄 NEEDS PERMISSION         |
| GET `/public/invitations/validate/:token` | None (public)                                     | N/A                      | -          | ✅ OK                       |

**Action Items**:

- Add permission middleware to ALL protected endpoints
- Apply scope filtering to all list/query endpoints (GET /clients, GET /profiles, etc.)
- Maintain backward compatibility with existing auth middleware

---

### 3. Shipment Service (Port 3004)

**Routes**: `/Volumes/WorkPro/WebProjects/logistics-main/backend/shipment-service/routes/shipments.js`

| Endpoint                                     | Current Auth                                         | Required Permission                 | Scope               | Status                      |
| -------------------------------------------- | ---------------------------------------------------- | ----------------------------------- | ------------------- | --------------------------- |
| POST `/shipments`                            | `authenticate`, `enrichUserContext`                  | `shipment:create:own/assigned`      | own/assigned        | 🔄 NEEDS PERMISSION         |
| GET `/shipments`                             | `authenticate`, `enrichUserContext`                  | `shipment:list:own/assigned/parent` | own/assigned/parent | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/shipments/:id`                         | `authenticate`, `enrichUserContext`                  | `shipment:read:own/assigned`        | own/assigned        | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/shipments/:id`                         | `authenticate`, `enrichUserContext`                  | `shipment:update:own/assigned`      | own/assigned        | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/shipments/:id/cancel`                 | `authenticate`, `enrichUserContext`                  | `shipment:delete:own/assigned`      | own/assigned        | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/shipments/:id/tracking`                | `authenticate`                                       | `shipment:read:own/assigned`        | own/assigned        | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/shipments/:id/tracking/events`        | `authenticate`, `operationsOrHigher`                 | `shipment:update:assigned/all`      | assigned/all        | 🔄 NEEDS PERMISSION         |
| POST `/shipments/calculate-rates`            | `authenticate`                                       | `shipment:read:own`                 | own                 | 🔄 NEEDS PERMISSION         |
| POST `/shipments/select-partner`             | `authenticate`                                       | `shipment:read:own`                 | own                 | 🔄 NEEDS PERMISSION         |
| POST `/shipments/serviceability`             | `authenticate`                                       | `shipment:read:own`                 | own                 | 🔄 NEEDS PERMISSION         |
| GET `/shipments/track/:awbNumber`            | None (public)                                        | N/A                                 | -                   | ✅ OK                       |
| POST `/shipments/:id/delivery-confirmation`  | `authenticate`, `authorize(['admin', 'operations'])` | `shipment:update:assigned/all`      | assigned/all        | 🔄 NEEDS PERMISSION         |
| GET `/shipments/analytics/tracking`          | `authenticate`                                       | `analytics:read:own/parent/all`     | own/parent/all      | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/shipments/bulk`                       | `authenticate`                                       | `shipment:bulk_create:assigned`     | assigned            | 🔄 NEEDS PERMISSION         |
| GET `/shipments/bulk/:jobId/status`          | `authenticate`                                       | `shipment:read:own/assigned`        | own/assigned        | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/shipments/:shipmentId/ndr`            | `authenticate`                                       | `shipment:create:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| GET `/shipments/ndr`                         | `authenticate`                                       | `shipment:list:own/assigned/parent` | own/assigned/parent | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/shipments/ndr/:ndrCaseId/action`      | `authenticate`                                       | `shipment:update:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| POST `/shipments/:shipmentId/label`          | `authenticate`                                       | `shipment:create:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| POST `/shipments/labels/bulk`                | `authenticate`                                       | `shipment:bulk_create:assigned`     | assigned            | 🔄 NEEDS PERMISSION         |
| POST `/shipments/manifest`                   | `authenticate`                                       | `shipment:create:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| POST `/shipments/pickup/schedule`            | `authenticate`                                       | `shipment:create:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| GET `/shipments/pickup/schedules`            | `authenticate`                                       | `shipment:list:own/assigned/parent` | own/assigned/parent | 🔄 NEEDS PERMISSION + SCOPE |
| PUT `/shipments/pickup/:pickupScheduleId`    | `authenticate`                                       | `shipment:update:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| DELETE `/shipments/pickup/:pickupScheduleId` | `authenticate`                                       | `shipment:delete:assigned`          | assigned            | 🔄 NEEDS PERMISSION         |
| GET `/shipments/pickup/slots`                | `authenticate`                                       | `shipment:read:own`                 | own                 | 🔄 NEEDS PERMISSION         |

**Action Items**:

- Replace all `requireRole`, `authorize` with `requirePermission`
- Apply scope filtering to ALL list/query endpoints
- Add `requireCustomerAccess` where shipments involve specific customers
- Maintain public tracking endpoint

---

### 4. Wallet Service (Port 3006)

**Routes**: `/Volumes/WorkPro/WebProjects/logistics-main/backend/wallet-service/routes/wallet.js`

| Endpoint                                        | Current Auth                                      | Required Permission          | Scope        | Status                      |
| ----------------------------------------------- | ------------------------------------------------- | ---------------------------- | ------------ | --------------------------- |
| GET `/wallet/:userId`                           | `authenticate`                                    | `wallet:read:own/assigned`   | own/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/wallet/:userId/balance`                   | `authenticate`                                    | `wallet:read:own/assigned`   | own/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/wallet/:userId/debit`                    | `authenticate`                                    | `wallet:debit:own/assigned`  | own/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/wallet/:userId/credit`                   | `authenticate`                                    | `wallet:credit:assigned/all` | assigned/all | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/wallet/:userId/load-balance`             | `authenticate`, `authorize(['admin', 'finance'])` | `wallet:load_balance:all`    | all          | 🔄 NEEDS PERMISSION         |
| GET `/wallet/:userId/transactions`              | `authenticate`                                    | `wallet:read:own/assigned`   | own/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/wallet/admin/all-wallets`                 | `authenticate`, `authorize(['admin', 'finance'])` | `wallet:list:all`            | all          | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/wallet/admin/transactions`                | `authenticate`, `authorize(['admin', 'finance'])` | `wallet:list:all`            | all          | 🔄 NEEDS PERMISSION + SCOPE |
| POST `/wallet/payment-gateway/initiate`         | `authenticate`                                    | `wallet:create:own`          | own          | 🔄 NEEDS PERMISSION         |
| POST `/wallet/payment-gateway/webhook`          | None (webhook)                                    | N/A                          | -            | ✅ OK                       |
| GET `/wallet/payment-gateway/status/:paymentId` | `authenticate`                                    | `wallet:read:own/assigned`   | own/assigned | 🔄 NEEDS PERMISSION + SCOPE |
| GET `/wallet/health`                            | `authenticate`                                    | N/A                          | -            | ✅ OK                       |

**Action Items**:

- Replace `authorize` with `requirePermission`
- Apply scope filtering to wallet/transaction queries
- Add customer access checking for userId operations
- Maintain webhook endpoint as public

---

### 5. Partner Service (Port 3005)

**Routes**: Multiple route files (partners, zones, charges, etc.)

**Note**: Partner service has 75+ endpoints across 11 route files. This requires comprehensive permission application.

| Category            | Required Permission Pattern             | Scope | Status              |
| ------------------- | --------------------------------------- | ----- | ------------------- |
| Partner CRUD        | `partner:create/read/update/delete:all` | all   | 🔄 NEEDS FULL AUDIT |
| Zone Management     | `partner:manage:all`                    | all   | 🔄 NEEDS FULL AUDIT |
| Charge Calculation  | `partner:read:all`                      | all   | 🔄 NEEDS FULL AUDIT |
| Customer Charges    | `partner:read:all`                      | all   | 🔄 NEEDS FULL AUDIT |
| Discounts           | `partner:manage:all`                    | all   | 🔄 NEEDS FULL AUDIT |
| Partner Performance | `analytics:read:all`                    | all   | 🔄 NEEDS FULL AUDIT |
| System Management   | `partner:manage:all`                    | all   | 🔄 NEEDS FULL AUDIT |

**Action Items**:

- Conduct comprehensive audit of all 11 route files
- Partner operations are typically admin-only (all scope)
- Apply uniform permission pattern across all partner endpoints

---

### 6. License Service (Port 3009)

**Routes**: Multiple route files (license, activation, admin, subscription, metrics)

| Category           | Required Permission Pattern             | Scope      | Status              |
| ------------------ | --------------------------------------- | ---------- | ------------------- |
| License Management | `license:create/read/update/delete:all` | all        | 🔄 NEEDS FULL AUDIT |
| Activation         | `license:activate:own/all`              | own/all    | 🔄 NEEDS FULL AUDIT |
| Subscription       | `license:manage:own/parent`             | own/parent | 🔄 NEEDS FULL AUDIT |
| Metrics            | `analytics:read:all`                    | all        | 🔄 NEEDS FULL AUDIT |
| Admin Operations   | `license:manage:all`                    | all        | 🔄 NEEDS FULL AUDIT |

**Action Items**:

- License activation should support both client (own) and admin (all) scopes
- Subscription endpoints need parent scope for clients
- Admin endpoints require all scope

---

## Implementation Strategy

### Step 1: Update Auth Service ✅

- Minimal changes (mostly admin endpoints)
- Test permission cache integration
- Verify existing authentication still works

### Step 2: Update User Service (CURRENT)

- Most complex service with client/customer hierarchy
- Critical for RBAC system operation
- Test scope filtering extensively

### Step 3: Update Shipment Service

- High volume endpoints (need performance testing)
- Test customer access checks
- Verify public tracking remains accessible

### Step 4: Update Wallet Service

- Financial operations (critical accuracy)
- Test admin/finance role permissions
- Verify transaction history scope filtering

### Step 5: Update Partner Service

- Admin-heavy operations
- Batch apply permissions to similar endpoints
- Test external API integration still works

### Step 6: Update License Service

- Client self-service operations
- Test activation flow with permissions
- Verify license validation works

### Step 7: Integration Testing

- End-to-end permission flows
- Performance testing with caching
- Security testing with different roles

---

## Testing Checklist

For EACH service after applying permissions:

- [ ] Docker restart successful
- [ ] No MODULE_NOT_FOUND errors in logs
- [ ] Health endpoint responding
- [ ] Superadmin can access all endpoints
- [ ] Admin can access admin-scoped endpoints
- [ ] Client can access parent-scoped endpoints
- [ ] Customer can access own-scoped endpoints only
- [ ] Scope filtering returns correct data sets
- [ ] Permission cache working (check Redis)
- [ ] Audit logging captures permission denials
- [ ] No performance degradation

---

## Files Modified

1. ✅ `/Volumes/WorkPro/WebProjects/logistics-main/shared/lib/auth.js` - Added applyScopeFilter function
2. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/auth-service/routes/auth.js`
3. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/user-service/routes/clients.js`
4. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/user-service/routes/users.js`
5. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/shipment-service/routes/shipments.js`
6. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/wallet-service/routes/wallet.js`
7. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/partner-service/routes/*.js` (11 files)
8. 🔄 `/Volumes/WorkPro/WebProjects/logistics-main/backend/license-service/routes/*.js` (5 files)

---

## Next Steps

Due to the extensive scope (100+ endpoints across 7 services), this task requires **systematic, service-by-service implementation** with verification at each step.

**Recommended Approach**:

1. Implement and verify one service at a time
2. Run Docker verification after each service
3. Test with different roles before proceeding
4. Document any breaking changes or deviations

**Current Focus**: Auth Service admin endpoints
**Next**: User Service (clients.js and users.js)

---

## Completion Criteria

Task RBAC-005 is complete when:

- ✅ All 7 backend services have permission-based route protection
- ✅ Scope filtering applied to ALL list/query endpoints
- ✅ All services restart successfully in Docker
- ✅ Health checks passing for all services
- ✅ Permission cache operational (verified in Redis)
- ✅ Different roles tested and working correctly
- ✅ No breaking changes to existing functionality
- ✅ Audit logging captures permission checks
- ✅ Documentation updated with permission requirements

---

**Task Complexity**: HIGH (100+ endpoints, 7 services)
**Estimated Time**: 4-6 hours for complete implementation and testing
**Risk Level**: MEDIUM (potential for breaking changes)
**Rollback Plan**: Revert to role-based middleware, remove permission checks

---

## Notes

- Permission strings follow `module:action:scope` format from `shared/constants/permissions.js`
- All permission checks use Redis caching (5-minute TTL)
- Scope filtering is automatic based on user role and accessLevel
- Public endpoints (tracking, webhooks) remain unchanged
- Backward compatibility maintained with existing middleware
