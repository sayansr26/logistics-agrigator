---
name: release
description: Build and push Docker images to GHCR and deploy the stack to production or UAT via the Makefile targets. Use only when the user explicitly asks to release, deploy, or ship.
disable-model-invocation: true
---

# Release & Deploy

Deployment is two machines and two steps. **Build and push happen on the dev
machine; pull and restart happen on the server.** Running a `deploy` target
locally does not deploy anything useful, and running a `release` target on the
server rebuilds images it should have pulled.

This skill is user-invocable only. It pushes images and restarts a live stack —
never reach for it as a side effect of finishing a task.

## Before releasing

1. The work is verified: `/verify-service <service>` passes for everything touched.
2. `yarn --cwd frontend build` succeeds (this is also enforced by `.husky/pre-push`).
3. The memory bank reflects what is shipping — `activeContext` and `progress`.
4. The user has said which environment. **Never infer prod.**

## Step 1 — dev machine: build and push to GHCR

```bash
make login          # GHCR: username = GitHub user, password = PAT with write:packages

make release-uat    # build + push all 10 images tagged :uat
make release-prod   # build + push all 10 images tagged :prod
```

Narrower targets exist when only part of the stack changed:

```bash
make release-backend TAG=uat     # the 9 backend images
make release-frontend TAG=uat    # frontend only
```

`release` builds all ten images and takes a while. Prefer the narrow target when
only one side changed, but be sure nothing in `shared/` changed — that affects
every backend image.

## Step 2 — server: pull and restart

```bash
make deploy         # PROD: pull latest :prod images and (re)start the stack
make deploy-uat     # UAT:  pull latest :uat images and (re)start the stack
```

`deploy-uat` sets `ENV_FILE = .env.uat`; `deploy` uses the production env file.

Split variants when you want to stage the pull separately from the restart:

```bash
make pull     / make pull-uat        # pull images, no restart
make restart  / make restart-uat     # restart without pulling
```

## Migrations

**Production applies migrations automatically on deploy.** Development does not —
locally you run `yarn --cwd backend/<service> migrate` and `generate` by hand.
So a schema change that works locally after a manual migrate will migrate itself
in prod; do not run a manual migration against the production database unless the
automatic path has demonstrably failed.

## After deploying

```bash
make ps           / make ps-uat        # container status
make logs         / make logs-uat      # follow all logs
make logs-api-gateway                  # per-service log targets exist for each
```

Check the health endpoints through the gateway before declaring success, and watch
the logs for a minute — a container that starts and then crash-loops looks healthy
in `ps` for the first few seconds.

## Rollback

Images are tagged by environment, not by version, so `:prod` is overwritten on
each release and there is no tag to roll back to. Rolling back means re-releasing
the previous commit: check it out, `make release-prod`, then `make deploy` on the
server. Say this plainly to the user rather than implying a one-command undo.

## Rules

- Never run any of this without the user asking in that message.
- Never run a git command — if the release needs a tag or a commit, hand the user
  the command.
- `.env.production` and `.env.uat` hold live credentials and are blocked from being
  read by a PreToolUse hook. If a value is needed, ask.
