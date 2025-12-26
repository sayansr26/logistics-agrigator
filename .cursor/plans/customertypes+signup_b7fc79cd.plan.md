---
name: CustomerTypes+Signup
overview: Introduce CustomerType (DIRECT vs OUTLET) using the existing user-service Customer table, add outlet fields, and implement a public signup that only creates DIRECT customers while admin-managed flows can create OUTLET customers.
todos:
  - id: schema-customerType
    content: Add CustomerType + outlet fields to user-service Customer model; implement safe uniqueness for email when clientId is null.
    status: completed
  - id: user-outlets-api
    content: Add outlets routes/controller in user-service as filtered Customer(OUTLET) CRUD, mount in server.js, update validation.
    status: completed
    dependencies:
      - schema-customerType
  - id: user-bootstrap-endpoint
    content: Add internal bootstrap endpoint in user-service to create Customer/DIRECT + UserProfile + CustomerUser for new signup users.
    status: completed
    dependencies:
      - schema-customerType
  - id: auth-register-direct
    content: Refactor auth-service /auth/register to enforce role=customer, call user-service bootstrap, and return tokens like login.
    status: completed
    dependencies:
      - user-bootstrap-endpoint
  - id: gateway-routes
    content: Add api-gateway proxy routes for /api/v1/customers and /api/v1/outlets to user-service (optional but recommended).
    status: completed
    dependencies:
      - user-outlets-api
  - id: frontend-register-page
    content: Create frontend /auth/register page + update authApi RegisterRequest + re-add signup link on login.
    status: completed
    dependencies:
      - auth-register-direct
---

# Customer types + direct-customer signup

## Goal

- Support **two customer types**: **DIRECT (B2C)** and **OUTLET (B2B)**.
- Treat **Outlets as Customers** (same DB table) by adding `customerType=OUTLET` + outlet-specific fields.
- Add a **public signup** that **only** creates **DIRECT customers**, and on signup we also create the corresponding **user-service records**.

## Key findings (current state)

- **User-service mounts customers under `/api/v1/customers`** via `app.use("/api", customerRoutes)`:

```583:590:backend/user-service/server.js
// API Routes
app.use("/api", userRoutes);
app.use("/api", clientRoutes);
app.use("/api", customerRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/v1/affiliate", affiliateRoutes);
```

- **User-service Customer model currently requires `clientId` and has no outlet/type fields**:

```236:261:backend/user-service/prisma/schema.prisma
model Customer {
  id       String  @id @default(uuid()) @db.Uuid
  clientId String  @map("client_id") @db.Uuid
  name     String  @db.VarChar(200)
  email    String  @db.VarChar(255)
  phone    String? @db.VarChar(20)
  // ...
  @@unique([clientId, email])
  @@map("customers")
}
```

- **Auth-service register currently allows only admin/finance/operations/client/support** and expects `name`, while controller expects `firstName/lastName` and returns only `{ user }` (no tokens):

```82:99:backend/auth-service/routes/auth.js
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()...,
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string()
    .valid("admin", "finance", "operations", "client", "support")
    .default("client"),
  clientId: Joi.string().uuid().optional(),
});
```

```9:76:backend/auth-service/controllers/authController.js
static async register(req, res) {
  const { email, password, role = "client", clientId, firstName, lastName, phone } = req.body;
  // creates user, audit log
  res.status(201).json(APIResponse.success({ user }));
}
```

- Frontend has routing/RTK endpoints for `/auth/register`, but **no register page exists**; `authApi.register` currently sends `{email,password,name,phone,role?}`:

```19:25:frontend/src/store/api/endpoints/authApi.ts
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: string;
}
```

- Login page currently says “Contact your administrator” (no signup link):

```229:237:frontend/src/app/auth/login/page.jsx
{/* Contact Admin */}
<div className="mt-6 text-center">
  <p className="text-sm text-muted-foreground">
    Don&apos;t have an account?{" "}
    <span className="text-logistics-600 dark:text-blue-400 font-medium">
      Contact your administrator
    </span>
  </p>
</div>
```

## Proposed data model (agreed)

You selected:

- `customer` role can be **both** B2B and B2C.
- Public signup should create **auth + user-service records**.
- Outlet should be modeled as **Customer with `customerType=OUTLET`**.

```mermaid
flowchart TD
  DirectCustomer[DirectCustomer] -->|customerType=DIRECT| CustomerTable[UserService.Customer]
  OutletCustomer[OutletCustomer] -->|customerType=OUTLET| CustomerTable
  AuthUser[AuthService.User(role=customer)] -->|id==customerId| CustomerTable
  AuthUser --> UserProfile[UserService.UserProfile(customerId)]
  AuthUser --> CustomerUser[UserService.CustomerUser(customerId,userId)]
```

## Implementation plan

### 1) User-service: extend Customer model to support DIRECT vs OUTLET

- Update Prisma schema in [`backend/user-service/prisma/schema.prisma`](backend/user-service/prisma/schema.prisma):
- Add `enum CustomerType { DIRECT OUTLET }`
- Add `customerType CustomerType @default(DIRECT)`
- Add outlet fields (optional) matching the frontend outlet interface:
  - `outletCode`, `outletName`, `retailerName`, `contactPerson`, `status`, `type`, `businessHours`, `gstNumber`, `panNumber`, `bankDetails` (Json), `assignedCouriers` (String[]), `serviceAreas` (String[]), address fields (`address`, `city`, `state`, `pincode`)
- Make `clientId` optional to support direct customers not under a client.
- Replace the current `@@unique([clientId, email])` with a migration strategy that enforces:
  - Unique `(clientId,email)` when `clientId IS NOT NULL`
  - Unique `(email)` when `clientId IS NULL`

(implemented via SQL migration).

### 2) User-service: validation + controllers for OUTLET vs DIRECT

- Update [`backend/user-service/validation/customerSchemas.js`](backend/user-service/validation/customerSchemas.js):
- Allow `customerType`.
- If `customerType=OUTLET`, require outlet fields (`outletCode`, `outletName`, `contactPerson`, address/city/state/pincode, status, type).
- If `customerType=DIRECT`, require minimal fields (name/email; phone optional).
- Update [`backend/user-service/controllers/customerController.js`](backend/user-service/controllers/customerController.js):
- Persist new fields on create/update.
- Ensure list/get can filter by `customerType`.
- Replace the current generic scope filtering with a **customer-table-safe** scoping (because shared `applyScopeFilter` currently assumes fields like `customerId`, which do not exist on this model).

### 3) User-service: add Outlets API as a filtered view of Customers

- Add [`backend/user-service/routes/outlets.js`](backend/user-service/routes/outlets.js) and [`backend/user-service/controllers/outletController.js`](backend/user-service/controllers/outletController.js):
- `POST /api/v1/outlets` → create Customer with `customerType=OUTLET`
- `GET /api/v1/outlets` → list Customers with `customerType=OUTLET`
- `GET/PUT/DELETE /api/v1/outlets/:id` similarly guarded
- Use existing permissions (`customer:*:*`) as already used in frontend route permissions.
- Mount the new routes in [`backend/user-service/server.js`](backend/user-service/server.js) alongside customers.

### 4) User-service: internal bootstrap endpoint for signup orchestration

- Add an internal-only endpoint (requires `X-Internal-Request`) to create the **user-service side** after auth-service creates the auth user:
- Create `Customer` with **id = auth user id** and `customerType=DIRECT` (or OUTLET for future admin flows).
- Create `CustomerUser` linking `customerId=userId`.
- Create `UserProfile` with `customerId=userId` and names.
- Full audit logging in the transaction.

### 5) Auth-service: make public register create only DIRECT customers + return tokens

- Update [`backend/auth-service/routes/auth.js`](backend/auth-service/routes/auth.js) register schema:
- Accept `firstName`, `lastName`, `phone` (or accept `name` and split—pick one consistent contract).
- Remove `role` from public input (or ignore it) and enforce **role=customer**.
- Update [`backend/auth-service/controllers/authController.js`](backend/auth-service/controllers/authController.js) register:
- Create user with `role=customer`.
- Call user-service internal bootstrap endpoint to create Customer/UserProfile/CustomerUser.
- Return **same shape as login**: `{ accessToken, refreshToken, user }` so frontend auto-login works.
- If bootstrap fails, attempt to rollback by deleting the created auth user and return an error.

### 6) API Gateway: add clean routes for customers/outlets (optional but recommended)

- Update [`backend/api-gateway/server.js`](backend/api-gateway/server.js) to proxy:
- `/api/v1/customers/*` → user-service `/api/v1/customers/*`
- `/api/v1/outlets/*` → user-service `/api/v1/outlets/*`

This avoids the awkward current “/api/v1/user/v1/...” path requirement.

### 7) Frontend: implement signup page and enforce DIRECT customer signup

- Add [`frontend/src/app/auth/register/page.tsx`](frontend/src/app/auth/register/page.tsx):
- Form fields: firstName, lastName, email, phone, password, confirmPassword.
- Call `useRegisterMutation`.
- No role selection; always direct customer.
- Update [`frontend/src/store/api/endpoints/authApi.ts`](frontend/src/store/api/endpoints/authApi.ts):
- Update `RegisterRequest` to match new backend contract (remove `role`; replace `name` with first/last, or align with backend decision).
- Update login page [`frontend/src/app/auth/login/page.jsx`](frontend/src/app/auth/login/page.jsx) to show a signup link again (since we are re-allowing public signup, but restricted).

## Verification (after implementation)

- User signup flow:
- `POST /api/v1/auth/register` creates auth user + user-service Customer (DIRECT) + profile + link, returns tokens.
- Outlet flow:
