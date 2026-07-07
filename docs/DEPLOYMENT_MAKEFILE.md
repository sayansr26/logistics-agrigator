# Deployment — Makefile release/deploy workflow

A two-role Docker workflow (mirrors the Car-QR setup): images are **built + pushed
from your Mac** to GHCR, and the **server just pulls** them. The server needs **no
source tree**.

```
Mac (source)  ──make release-prod──▶  ghcr.io/sayansr26/logistics-*:prod  ──make deploy──▶  server
Mac (source)  ──make release-uat ──▶  ghcr.io/sayansr26/logistics-*:uat   ──make deploy-uat──▶ server
```

PROD and UAT run on the **same server** (`103.17.193.231`), fully isolated by
`COMPOSE_PROJECT_NAME` (separate networks + volumes), distinct container names
(`-uat` suffix), and distinct host ports.

| Env  | Image tag | Project        | API gateway host port | Frontend host port | Env file          |
|------|-----------|----------------|-----------------------|--------------------|-------------------|
| PROD | `:prod`   | `logistics-prod` | 3001                | 3000               | `.env.production` |
| UAT  | `:uat`    | `logistics-uat`  | 4001                | 4000               | `.env.uat`        |

> All 10 app images (9 backend + frontend) are **environment-agnostic** — the
> frontend uses same-origin (`NEXT_PUBLIC_API_URL=""`) plus an in-network
> `api-gateway:3001` rewrite. PROD and UAT differ only by **image tag + runtime
> env file**, never by build. Nothing is baked at build time.
>
> **Migrations run automatically at container startup** (`scripts/production-entrypoint.sh`
> runs `prisma migrate deploy`; auth-service also seeds the superadmin). `make deploy`
> needs no separate migrate step.

---

## Prerequisites

**On the Mac (build machine):**
- Docker with `buildx` (bundled with Docker Desktop).
- A GHCR Personal Access Token with `write:packages`.

**On the server:**
- Docker + Docker Compose v2.
- A GHCR PAT with `read:packages`.

---

## 1. Release from the Mac

```bash
make login                 # docker login ghcr.io  (PAT with write:packages)

make release-prod          # build+push all 10 images tagged :prod
make release-uat           # build+push all 10 images tagged :uat

# Optional immutable tag for rollbacks (pushes :prod AND :<sha>):
make release-prod VERSION=$(git rev-parse --short HEAD)
```

Each release runs `docker buildx build --platform linux/amd64 … --push` for the 9
backend services (`-f backend/<svc>/Dockerfile.prod .`) and the frontend
(`-f frontend/Dockerfile.prod .`). The first build of a given env is slow (10 amd64
images cross-built on an ARM Mac); subsequent builds reuse the buildx layer cache.

Individual groups: `make release-backend` / `make release-frontend` (respect `TAG=`).

---

## 2. One-time server setup

The server holds only the deploy set (no source). Copy these into the deploy path
(`/var/www/sub-solution`):

```
Makefile
docker-compose.production.yml
.env.production          # real secrets — never in git
.env.uat                 # real secrets — never in git
scripts/init-databases.sql
logs/                    # empty dir (bind-mounted for container logs)
```

Example (from the Mac):

```bash
DEST=gitlab-runner@103.17.193.231:/var/www/sub-solution
rsync -avz Makefile docker-compose.production.yml .env.production .env.uat "$DEST/"
rsync -avzR scripts/init-databases.sql "$DEST/"
ssh gitlab-runner@103.17.193.231 'mkdir -p /var/www/sub-solution/logs'
```

Then on the server:

```bash
cd /var/www/sub-solution
make login                 # docker login ghcr.io (PAT with read:packages)
```

> `scripts/production-entrypoint.sh` is baked **into** the images, so it does NOT
> need to be on the server — only `scripts/init-databases.sql` (postgres init
> bind-mount) does.

---

## 3. Deploy on the server

```bash
make deploy                # PROD: pull :prod images and (re)start the stack
make deploy-uat            # UAT:  pull :uat  images and (re)start the stack
```

Both stacks coexist. Verify:

```bash
make ps            &&  curl -s http://localhost:3001/health | jq .   # PROD
make ps-uat        &&  curl -s http://localhost:4001/health | jq .   # UAT
make logs-auth                # confirm "prisma migrate deploy" ran at startup
```

---

## 4. Everyday ops (server)

`ENV_FILE` selects the stack; `-uat` variants set it for you.

```bash
make ps            | make ps-uat
make logs          | make logs-uat
make logs-<svc>    # api-gateway | auth | user | shipment | partner | wallet |
                   # support | platform | license | frontend | db | redis
make restart       | make restart-uat
make down          | make down-uat
make psql          # psql shell in the postgres container
make backup        # gzip pg_dump of every DB into ./backups/
```

Target the UAT stack with any ops target via `ENV_FILE`, e.g.
`make logs-api-gateway ENV_FILE=.env.uat`.

---

## 5. Rollback

Release with an immutable tag, then pin `IMAGE_TAG` on the server:

```bash
# Mac — release with a sha tag alongside :prod
make release-prod VERSION=$(git rev-parse --short HEAD)

# Server — pin to a known-good sha and redeploy
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha>/' .env.production
make deploy
```

To return to latest: set `IMAGE_TAG=prod` and `make deploy` again.

---

## Notes

- **One compose file, two workflows.** `docker-compose.production.yml` declares
  both `image:` (a GHCR tag) and `build:` (local Dockerfile.prod) on every app
  service. `make deploy` runs `pull` + `up -d` so it uses the **pulled registry
  images** (no source needed on the server). The existing `production:build` /
  `production:up` npm scripts still build locally on the build machine for
  production-image testing.
- Registry/namespace is `ghcr.io/sayansr26` (override with `REGISTRY=` on `make`,
  or `REGISTRY=` in the env file for compose).
