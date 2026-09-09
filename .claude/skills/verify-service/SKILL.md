---
name: verify-service
description: Run the mandatory Docker verification protocol for a backend service or the frontend - restart, check logs for errors and MODULE_NOT_FOUND, hit the health endpoint, and exercise a real endpoint. Use after any change to a service under backend/, after a frontend change, and before reporting any task as complete. Triggers on "verify the service", "is it working", "run the verification protocol", "check the logs", or a service name plus "restart".
---

# Verify Service

`CLAUDE.md` makes this protocol mandatory before any task is called complete. It
is six steps with explicit pass/fail criteria, and skipping one is how a service
gets reported working while `MODULE_NOT_FOUND` sits in its logs.

## Usage

```bash
.claude/skills/verify-service/scripts/verify.sh <service>
```

`<service>` is one of: `api-gateway`, `auth`, `user`, `shipment`, `partner`,
`wallet`, `support`, `platform`, `license`, `frontend`. The script resolves the
container name and port, runs every step, and exits non-zero on the first failure.

Run it with no argument to see the service table.

## What passes and what fails

| Step               | Pass                                    | Fail                                   |
| ------------------ | --------------------------------------- | -------------------------------------- |
| Restart            | container comes up                      | restart errors                         |
| Logs (last 50)     | no `Error`, `Cannot find`, `EADDRINUSE` | any error line                         |
| `MODULE_NOT_FOUND` | grep returns nothing                    | **any** result — zero tolerance        |
| Health             | HTTP 200, `{"status":"healthy"}`        | anything else                          |
| Endpoint           | expected response with a valid token    | 5xx, or 401/403 where auth should pass |

## Ports

| Service     | Port | Container                    |
| ----------- | ---- | ---------------------------- |
| frontend    | 3000 | `logistics-frontend`         |
| api-gateway | 3001 | `logistics-api-gateway`      |
| auth        | 3002 | `logistics-auth-service`     |
| user        | 3003 | `logistics-user-service`     |
| shipment    | 3004 | `logistics-shipment-service` |
| partner     | 3005 | `logistics-partner-service`  |
| wallet      | 3006 | `logistics-wallet-service`   |
| support     | 3007 | `logistics-support-service`  |
| platform    | 3008 | `logistics-platform-service` |
| license     | 3009 | `logistics-license-service`  |

## Frontend differences

The frontend gate is the **build**, not the type-check — the repo has a known
TypeScript error baseline and `.husky/pre-push` deliberately skips `tsc --noEmit`
for that reason.

```bash
yarn --cwd frontend build     # must print "Compiled successfully"
docker-compose restart frontend
```

Errors in files your change touched = FAIL. Errors in files it did not = the known
baseline; name them and move on. **Always restart the container after a successful
build** — without it the container keeps serving the previous build and the change
looks like it did nothing.

In day-to-day development `yarn dev` hot-reloads, so a full production build per
edit is not needed; run the build as the gate before calling work complete.

## After the protocol

Verifying that the service starts is not verifying that the feature works. Follow
with real endpoint testing — the `api-tester` agent for a thorough pass, or curl by
hand for the specific route. Test the failure paths too: invalid payload → 400,
missing token → 401, wrong role → 403.

For the full completion audit (protocol + code rule compliance + memory bank
freshness), use the `task-verifier` agent instead of this skill.
