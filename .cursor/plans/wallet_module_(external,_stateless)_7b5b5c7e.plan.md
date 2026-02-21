---
name: Wallet module (external, stateless)
overview: Implement admin/accounts wallet management UI in Next.js (`/wallet`) backed by new wallet-service proxy endpoints that speak the external Wallet API from `wallet_doc.md`, with client code configured via `.env`/`.env.production` and wallet-service operating in a stateless mode (no local wallet/transaction persistence).
todos:
  - id: backend-external-wallet-proxy
    content: Update wallet-service to proxy external Wallet APIs from wallet_doc.md (wallet list+stats, transactions list+stats, topup/debit/refund, user status update) using correct HMAC signing path and standard API envelopes.
    status: pending
  - id: backend-stateless-wallet-service
    content: Make wallet-service operate in stateless mode at runtime (no Prisma reads/writes for wallets/transactions) and adjust health checks accordingly.
    status: pending
  - id: frontend-wallet-ui
    content: Replace mock wallet pages with admin/accounts management UI in `frontend/src/app/wallet` (wallet list+stats, transactions list+stats, modals for topup/debit/refund/status; dynamic remarks builder).
    status: pending
  - id: frontend-wallet-rtk
    content: Add `walletApi.ts` RTK Query endpoints with per-endpoint transformResponse unwrapping and integrate into wallet UI.
    status: pending
  - id: env-client-code
    content: Set `WALLET_DEFAULT_CLIENT_CODE=TEST` (and external wallet credentials) in `.env` and `.env.production`, and document required services to run for local dev.
    status: pending
  - id: verify-curl-and-build
    content: Verify wallet APIs via API Gateway with curl and run frontend build to ensure no TypeScript/Next errors in new wallet code.
    status: pending
isProject: false
---

# Wallet module (external, stateless)

## Goals (from `wallet_doc.md`)

- Admin/accounts UI for:
  - **Wallet list + stats** (doc **1.1**)
  - **Get/Create wallet by user_id** (doc **1.2**) and **update wallet/user status** (doc **1.7**)
  - **Topup / Debit / Refund** with **dynamic `remarks`** (doc **1.3/1.4/1.5**)
  - **Transactions list + stats** (doc **2.1**)
- All frontend calls go through **API Gateway** (`backend/api-gateway/server.js` already proxies `/api/v1/wallet/*` → `backend/wallet-service`).
- **Client code = `TEST`** and must be configurable via `.env` + `.env.production` (`WALLET_DEFAULT_CLIENT_CODE`).
- **No local wallet ledger persistence**: wallet-service should not read/write `wallets` / `transactions` tables; it should proxy external API (Redis cache is OK if you want it).

## Current state (what exists)

- Frontend wallet pages exist but are **mock-data based**:
  - `frontend/src/app/wallet/page.jsx`
  - `frontend/src/app/wallet/transactions/[id]/page.jsx`
  - `frontend/src/app/wallet/invoices/[id]/page.jsx`
- Wallet service exists and uses Prisma/local tables + an external client, but the external client currently calls endpoints like `POST /wallets` and `/wallets/{id}/debit` which **do not match** `wallet_doc.md` (which uses `/wallets/client/{client}/user/{userId}/...`). Files:
  - `backend/wallet-service/services/externalWalletClient.js`
  - `backend/wallet-service/services/walletService.js`
  - `backend/wallet-service/routes/wallet.js`

## Services required (runtime)

- **docker-compose dev**: `api-gateway`, `wallet-service`, `auth-service` (JWT), `redis` (optional cache), plus **external wallet API** configured by env.
- **user-service** only if we decide to resolve wallet user_id from outlet phone automatically; for your chosen admin/accounts UI, we can operate directly on the external `user_id` (phone) returned by wallet list.

## Implementation approach

### 1) Backend: make wallet-service a proxy for `wallet_doc.md` (stateless)

Update `backend/wallet-service` to add a **new external-wallet API adapter** that matches the contract in `wallet_doc.md`.

- **External API adapter**
  - Update `backend/wallet-service/services/externalWalletClient.js`:
    - Add methods that call the doc endpoints:
      - `listClientWallets(clientCode, query)` → `GET wallets/client/{clientCode}`
      - `getOrCreateWallet(clientCode, userId)` → `GET wallets/client/{clientCode}/user/{userId}`
      - `topup(clientCode, userId, body)` → `POST wallets/client/{clientCode}/user/{userId}/topup`
      - `debit(clientCode, userId, body)` → `POST wallets/client/{clientCode}/user/{userId}/debit`
      - `refund(clientCode, userId, body)` → `POST wallets/client/{clientCode}/user/{userId}/refund`
      - `getUserWalletInfo(clientCode, userId)` → `GET users/{clientCode}/{userId}/wallet`
      - `updateUserStatus(clientCode, userId, status)` → `PATCH users/{clientCode}/{userId}/status?status=...`
      - `listClientTransactions(clientCode, query)` → `GET transactions/client/{clientCode}`
    - **Important**: ensure the signed `path` includes `/api/v1/...` exactly like Postman (avoid losing `/api/v1` when URL starts with `/`). A safe pattern is to call axios with **relative paths without a leading `/`** (e.g. `wallets/client/...`) so `pathname` becomes `/api/v1/wallets/...`.
- **Wallet-service routes/controllers**
  - Extend `backend/wallet-service/routes/wallet.js` with new controller functions (no inline logic) for admin/accounts UI:
    - `GET /api/v1/wallet/admin/client-wallets` (wraps doc 1.1)
    - `GET /api/v1/wallet/admin/client-transactions` (wraps doc 2.1)
    - `GET /api/v1/wallet/admin/wallet` (wraps doc 1.2; params: `userId` (external user_id), optional clientCode)
    - `PATCH /api/v1/wallet/admin/user-status` (wraps doc 1.7; params: `userId`, `status`, optional clientCode)
    - `POST /api/v1/wallet/admin/topup` (wraps doc 1.3)
    - `POST /api/v1/wallet/admin/debit` (wraps doc 1.4)
    - `POST /api/v1/wallet/admin/refund` (wraps doc 1.5)
  - Update/extend `backend/wallet-service/validation/walletSchema.js` to validate:
    - `clientCode` (string)
    - `userId` as **wallet external user_id** (phone string; keep it flexible but validate digits/length)
    - request bodies: `amount`, `currency`, `reference_id`, `transaction_id` (for refund), `description`, `metadata`, `remarks` (object)
  - Use `backend/wallet-service/shared/lib/response` (`APIResponse.success/error`) so frontend sees standard envelopes.
- **Stateless mode (no Postgres use at runtime)**
  - Update `backend/wallet-service/server.js` and any controllers/services so wallet routes do not call Prisma.
  - Keep Prisma/migrations in repo **for now** so existing monorepo scripts don’t break, but runtime should not read/write wallet tables.
  - Update wallet-service `/health` to **skip DB checks** (or mark DB as “disabled/stateless”).

### 2) Frontend: implement admin/accounts wallet management UI (`frontend/src/app/wallet`)

Replace mock-based UI with RTK Query powered screens.

- **RTK Query endpoints**
  - Add `frontend/src/store/api/endpoints/walletApi.ts` with endpoints calling API Gateway:
    - `useGetClientWalletsQuery(params)` → `GET /api/v1/wallet/admin/client-wallets`
    - `useGetClientTransactionsQuery(params)` → `GET /api/v1/wallet/admin/client-transactions`
    - `useGetOrCreateWalletQuery({ userId, clientCode })`
    - `useTopupWalletMutation()`
    - `useDebitWalletMutation()`
    - `useRefundWalletMutation()`
    - `useUpdateWalletUserStatusMutation()`
  - Each endpoint must include `**transformResponse`\*\* to unwrap `{ status, data, meta }` (don’t rely on `baseApi`’s `transformResponse`).
- **Wallet page UI**
  - Update `frontend/src/app/wallet/page.jsx` to:
    - Add a **Wallets** tab: table using doc 1.1 fields + stats cards from `stats`.
    - Add a **Transactions** tab: table using doc 2.1 fields + stats cards.
    - Add actions per wallet row:
      - Update Status (ACTIVE/SUSPENDED/BLOCKED/CLOSED etc, depending on doc)
      - Topup / Debit / Refund
    - Implement **dynamic remarks builder** in the modals:
      - UI to add/remove key/value pairs
      - Send as `remarks: Record<string, unknown>`
      - For shipment use-cases later: we’ll standardize keys like `shipmentId`, `awb`, `service`, `reason`, etc.
  - Keep `frontend/src/app/wallet/transactions/[id]/page.jsx` and `frontend/src/app/wallet/invoices/[id]/page.jsx` as legacy/demo for now, but stop linking to them from the new tables (since external doc does not define “get transaction by id” / invoices APIs).
- **Navigation**
  - Add a Wallet entry to `frontend/src/components/layout/sidebar.jsx` for roles: `superadmin`, `admin`, `accounts`, `client`.
  - Because frontend permission fetching is currently disabled, prefer **role-gated visibility** for this nav item (omit `permission` on the sidebar item so it actually shows).

### 3) Environment configuration

- Update root `.env` and `.env.production`:
  - `WALLET_DEFAULT_CLIENT_CODE=TEST`
  - Ensure `EXTERNAL_WALLET_API_URL`, `EXTERNAL_WALLET_SECRET_KEY`, `EXTERNAL_WALLET_USER_ID`, `EXTERNAL_WALLET_JWT_TOKEN` are set correctly.

### 4) Verification (mandatory before considering done)

- **Backend (Docker)**
  - Restart `wallet-service` and `api-gateway`.
  - Curl via API Gateway to verify:
    - wallets list+stats (doc 1.1)
    - get/create wallet (doc 1.2)
    - topup/debit/refund (doc 1.3/1.4/1.5)
    - transactions list+stats (doc 2.1)
  - Confirm no `MODULE_NOT_FOUND` errors in logs.
- **Frontend**
  - `pnpm --filter frontend run build` and ensure wallet page compiles.

## Optional cleanup (after everything works)

- If you truly want “no wallet DB artifacts at all”, we can do a follow-up task to:
  - remove wallet-service from `scripts/init-databases.sh` migration flow,
  - adjust docker-compose to not provision a wallet database,
  - delete legacy Prisma tables/migrations safely.
