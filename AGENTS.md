# Logistics Aggregator Portal — Agent Instructions

This repository is a PNPM monorepo (Node/Express microservices + Next.js frontend) for an India-focused multi-tenant logistics aggregation platform (75+ courier integrations).

## Instruction Sources (read + obey)

Treat these as authoritative project instructions:

- `CLAUDE.md` (workflow + mandatory rules)
- `memory-bank/` (project context; patterns; current priorities)
- `.cursor/rules/*.mdc` (frontend/backend standards; shared library import rules)

If any guidance conflicts, prefer:

1. existing code patterns in `backend/auth-service/` (reference implementation),
2. `memory-bank/systemPatterns.md` + `memory-bank/techContext.md`,
3. then other docs/rules.

## Session Start (MANDATORY)

Read the memory bank at the start of a session (in order):

1. `memory-bank/projectbrief.md`
2. `memory-bank/productContext.md`
3. `memory-bank/systemPatterns.md`
4. `memory-bank/techContext.md`
5. `memory-bank/activeContext.md`
6. `memory-bank/progress.md`

Use `memory-bank/activeContext.md` and its “Last Updated” date to anchor what “current” means.

## Architecture Snapshot

- Frontend (Next.js 14): `frontend/` (port `3000`)
- API Gateway: `backend/api-gateway/` (port `3001`)
- Services:
  - Auth: `backend/auth-service/` (`3002`) — reference standard
  - User: `backend/user-service/` (`3003`)
  - Shipment: `backend/shipment-service/` (`3004`)
  - Partner: `backend/partner-service/` (`3005`)
  - Wallet: `backend/wallet-service/` (`3006`) — stateless external proxy
  - License: `backend/license-service/` (`3009`) — partially implemented

Pattern: database-per-service (Postgres) + shared Redis.

## Non-Negotiable Backend Rules (NO EXCEPTIONS)

- **No inline route handlers**: routes only wire middleware + controller methods.
- **Controllers hold business logic**: controller class methods (static) implement behavior.
- **Prisma ORM only**: no raw SQL queries.
- **UUID IDs**: use `@default(uuid()) @db.Uuid` (do not introduce CUID IDs).
- **Audit logging required** for CRUD (create/update/delete; and other significant actions) using each service’s `AuditLog` model/pattern.
- **Joi validation required** for all endpoints (validate inputs before controller work).
- **Response envelope**: APIs return `{ status, data, meta }` (follow existing service patterns).
- **Shared library import paths are strict**:
  - from `controllers/`, `routes/`, `middleware/`, `services/`, etc: `require("../shared/…")`
  - from `server.js`: `require("./shared/…")`
- **Inter-service calls** must include `X-Internal-Request` header and `INTERNAL_SECRET` (see memory bank patterns).
- **Redis v4**: use `setEx()` (camelCase), not `setex()`.
- **External wallet identity**: external wallet API uses **phone number** as user ID (not auth UUID).

## Frontend Rules (High Priority)

- TypeScript-first; avoid `any` unless truly necessary.
- Tailwind for styling (avoid inline styles).
- Always implement loading + error states; keep mobile-first responsiveness and accessibility (ARIA labels).
- **RTK Query envelope unwrapping**: backend returns `{ status, data, meta }`; `fetchBaseQuery`-level `transformResponse` is ignored—each endpoint must define `transformResponse`.
- State: Zustand exists; Redux Toolkit/RTK Query migration in progress—follow existing patterns in the area you touch.

## Required Workflow (Backend ↔ Frontend)

- **Test APIs with `curl` before building/updating UI**. Do not implement UI for an unverified API.
- Prefer changing one layer at a time:
  1. backend API + docker verification
  2. curl tests (valid/invalid/auth cases)
  3. frontend integration

## Verification Before Marking a Task “Done”

Backend (minimum):

- Confirm shared imports are correct (no `MODULE_NOT_FOUND` in docker logs).
- Restart the affected docker service(s) and verify logs.
- Hit the service health endpoint(s) and key API endpoint(s).

Frontend (after any frontend change):

- Run `pnpm run build` in `frontend/` and fix any errors caused by your changes.
- **Mandatory:** after every successful `pnpm run build`, restart the frontend container (otherwise the site may keep serving the old build).
  - `docker restart logistics-frontend` (preferred)
  - or `docker-compose restart frontend`

## Common Commands (Repo Root)

- Setup: `pnpm run setup:dev`
- Dev: `pnpm run dev` (all services), `pnpm run dev:frontend`
- DB bootstrap: `pnpm run db:init`
- Logs: `pnpm run logs`
- Stop: `pnpm run stop`

## Where to Look First

- Current sprint PRD: `docs/PRD_API_GATEWAY_RBAC.md`
- Patterns: `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`
- Reference service for backend patterns: `backend/auth-service/`
- Cursor standards: `.cursor/rules/backend.mdc`, `.cursor/rules/frontend.mdc`, `.cursor/rules/shared-libraries.mdc`

## Notes

- If instructions grow large or diverge per service, add directory-scoped overrides via `AGENTS.override.md` inside the relevant folder(s).
