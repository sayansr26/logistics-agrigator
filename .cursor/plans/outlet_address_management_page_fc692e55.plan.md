---
name: Outlet address management page
overview: Add a shared outlet-address management page reachable from Outlet Management with hard-delete support, and enforce access so only admin/superadmin and the outlet user (own addresses) can use it.
todos:
  - id: backend-token-propagation
    content: Attach bearer token onto req.user in shared auth authenticate so permission fetch works.
    status: pending
  - id: backend-admin-address-rbac
    content: Restrict /outlets/:outletId/addresses* to admin/superadmin via user:*:all permissions (read/create/update/delete).
    status: pending
  - id: backend-hard-delete-address
    content: Change OutletController.deleteAddress to Prisma hard delete with audit logging.
    status: pending
  - id: frontend-shared-addresses-page
    content: Update /addresses page to work for admin (by outletId) and outlet (own), using existing RTK Query endpoints.
    status: pending
  - id: frontend-outlets-manage-addresses-action
    content: Add per-outlet “Manage Addresses” action linking to /addresses?outletId=... in Outlet Management table.
    status: pending
  - id: frontend-route-permissions
    content: Update route permissions to allow /addresses for superadmin/admin/outlet only.
    status: pending
  - id: verify-docker-and-build
    content: Restart Docker services, curl test endpoints, and run frontend build.
    status: pending
isProject: false
---

## Goal

Implement a dedicated **Manage Addresses** flow:

- From Outlet Management (`/outlets`), each outlet row gets an action **Manage Addresses**.
- Clicking it opens a **single shared page** (`/addresses`) that:
  - For **admin/superadmin**: manages addresses for a selected outlet via `outletId` query param.
  - For **outlet role**: manages **own** addresses (ignores `outletId`).
- Address delete must be **hard delete** (DB delete), not `isActive=false`.
- **Access**: admin/superadmin + outlet itself only (no client).

## What exists already (to reuse)

- Outlet address APIs already exist in user-service routes:
  - `/api/v1/outlets/me/addresses` (outlet own)
  - `/api/v1/outlets/:outletId/addresses` (admin-managed)
  - See: [backend/user-service/routes/outlets.js](backend/user-service/routes/outlets.js)
- RTK Query endpoints already exist for both own + by-outlet workflows:
  - See: [frontend/src/store/api/endpoints/outletApi.ts](frontend/src/store/api/endpoints/outletApi.ts)
- Outlet Management page already shows address count and has a dropdown action menu:
  - See: [frontend/src/app/outlets/page.tsx](frontend/src/app/outlets/page.tsx)

## Backend changes

### 1) Make permission checks actually able to fetch permissions

- Update shared auth middleware to retain the bearer token on `req.user` so `getEffectivePermissions()` can call auth-service with a real token.
- File: [shared/lib/auth.js](shared/lib/auth.js)
  - In `authMiddleware.authenticate`, after extracting token, add `token` onto `req.user`.

### 2) Restrict “admin outlet address” endpoints to admin/superadmin and align permissions

- Update address routes under `/outlets/:outletId/addresses...` to require **system-wide user permissions** (scope `all`) so only admin/superadmin can use them.
- File: [backend/user-service/routes/outlets.js](backend/user-service/routes/outlets.js)
  - Change:
    - `GET /outlets/:outletId/addresses` → requirePermission(`user`,`read`,`all`)
    - `POST /outlets/:outletId/addresses` → requirePermission(`user`,`create`,`all`)
    - `PUT /outlets/:outletId/addresses/:addressId` → requirePermission(`user`,`update`,`all`)
    - `DELETE /outlets/:outletId/addresses/:addressId` → requirePermission(`user`,`delete`,`all`)
  - Keep `/outlets/me/addresses`\* as outlet-only via `requireRole("outlet")`.

### 3) Implement hard delete for outlet addresses

- File: [backend/user-service/controllers/outletController.js](backend/user-service/controllers/outletController.js)
  - Update `OutletController.deleteAddress` to do a Prisma `delete()` inside the transaction (and keep audit logging using `existingAddress` as the “deleted” snapshot).
  - Keep the “address belongs to outlet” guard.

## Frontend changes

### 1) Convert `/addresses` into the shared manage-addresses page

- File: [frontend/src/app/addresses/page.tsx](frontend/src/app/addresses/page.tsx)
- Behavior:
  - Read role from auth state.
  - Read `outletId` from query string.
  - If role is **admin/superadmin**:
    - Require `outletId`.
    - Load outlet header info with `useGetOutletQuery(outletId)`.
    - Load addresses with `useGetOutletAddressesQuery(outletId)`.
    - Mutations use `useCreateOutletAddressMutation`, `useUpdateOutletAddressMutation`, `useDeleteOutletAddressMutation`.
  - If role is **outlet**:
    - Load with `useGetMyAddressesQuery`.
    - Mutations use `useCreateMyAddressMutation`, `useUpdateMyAddressMutation`, `useDeleteMyAddressMutation`.
  - UI:
    - Address list (cards or table) with per-address Edit/Delete.
    - Add/Edit dialogs.
    - Delete confirmation dialog.
    - Use backend-valid `addressType` values: `GENERAL | PICKUP | RETURN`.
    - Optional but recommended: reuse geo-autocomplete UX from `/outlets` address dialogs (pincode suggestions + auto-fill city/state) so admin flow matches existing patterns.
  - If admin opens page without `outletId`:
    - Show an empty-state with CTA back to `/outlets` (and/or a quick outlet picker using `useListOutletsQuery`).

### 2) Add “Manage Addresses” action per outlet row

- File: [frontend/src/app/outlets/page.tsx](frontend/src/app/outlets/page.tsx)
  - Add a dropdown item that navigates to `/addresses?outletId=<outlet.id>`.

### 3) Route access rules

- File: [frontend/src/config/routePermissions.ts](frontend/src/config/routePermissions.ts)
  - Update the `/addresses` entry to allow roles: `superadmin`, `admin`, `outlet`.
  - Keep permission requirement at a low scope (e.g. `user:read:own`) so admin/superadmin still pass via scope hierarchy on the frontend.

## Verification plan (after implementation)

### Backend (Docker)

- Restart user-service + api-gateway containers.
- Confirm no `MODULE_NOT_FOUND` in logs.
- Curl tests (via api-gateway):
  - As **admin/superadmin**:
    - `GET /api/v1/outlets/:outletId/addresses`
    - `POST /api/v1/outlets/:outletId/addresses`
    - `PUT /api/v1/outlets/:outletId/addresses/:addressId`
    - `DELETE /api/v1/outlets/:outletId/addresses/:addressId` → verify record is removed (subsequent GET doesn’t return it).
  - As **outlet**:
    - `GET/POST/PUT/DELETE /api/v1/outlets/me/addresses...`

### Frontend

- `pnpm --filter frontend run build`
- Smoke test:
  - Admin: from `/outlets` → Manage Addresses → add/edit/delete.
  - Outlet: sidebar → My Addresses → add/edit/delete.
