# ============================================================================
# logistics-agrigator — Docker release / deploy orchestration
# ============================================================================
# Two-role workflow (mirrors the Car-QR setup):
#
#   BUILD MACHINE (Mac, has source) — build + push images to GHCR:
#     make login
#     make release-prod                 # push ghcr.io/sayansr26/logistics-*:prod
#     make release-uat                  # push ghcr.io/sayansr26/logistics-*:uat
#     make release-prod VERSION=$(git rev-parse --short HEAD)   # + immutable tag
#
#   SERVER (no source — only Makefile + docker-compose.production.yml + .env files
#   + scripts/init-databases.sql + logs/) — pull prebuilt images and run:
#     make deploy                       # PROD  (--env-file .env.production)
#     make deploy-uat                   # UAT   (--env-file .env.uat)
#
# Migrations run automatically at container startup (scripts/production-
# entrypoint.sh runs `prisma migrate deploy`), so deploy needs no migrate step.
# Run `make help` for the full target list.
# ============================================================================

# --- GHCR release settings (build machine) ---
REGISTRY ?= ghcr.io/sayansr26
PLATFORM ?= linux/amd64
# release-<env> set TAG (prod/uat). Add VERSION=<sha> for an extra immutable tag.
TAG      ?= prod

# --- Compose selection ---
# ENV_FILE picks PROD vs UAT for the production compose. deploy/deploy-uat
# (and the *-uat ops targets) override it; everything else defaults to PROD.
# docker-compose.production.yml declares both image: (pull) and build: (local),
# so `pull` uses GHCR images and `build` still works on the build machine.
ENV_FILE     ?= .env.production
COMPOSE_PROD ?= docker compose -f docker-compose.production.yml --env-file $(ENV_FILE)
# Local dev / build compose (base file, build machine only).
COMPOSE_DEV  ?= docker compose

# App services (backend build context is the repo root; -f selects the Dockerfile).
BACKEND_SERVICES = api-gateway auth-service user-service shipment-service \
                   partner-service wallet-service support-service \
                   platform-service license-service

# Services that own a Prisma schema (api-gateway has none). Order follows
# dependency order used by scripts/init-databases.sh.
PRISMA_SERVICES = auth-service user-service wallet-service partner-service \
                  shipment-service support-service platform-service license-service

.PHONY: help login release release-prod release-uat release release-backend \
        release-frontend deploy deploy-uat pull pull-uat up down down-uat \
        restart restart-uat ps ps-uat logs logs-uat \
        logs-api-gateway logs-auth logs-user logs-shipment logs-partner \
        logs-wallet logs-support logs-platform logs-license logs-frontend \
        logs-db logs-redis psql backup db-init migrate migrate-all db-sync \
        seed import-pincodes load-pincodes seed-geo dev dev-down dev-logs

help:
	@echo "logistics-agrigator Docker targets:"
	@echo ""
	@echo "  Release (BUILD MACHINE / Mac — needs source + GHCR login):"
	@echo "  make login          docker login ghcr.io (PAT with write:packages)"
	@echo "  make release-prod   Build+push all 10 images (amd64) to $(REGISTRY)/logistics-*:prod"
	@echo "  make release-uat    Build+push all 10 images (amd64) to $(REGISTRY)/logistics-*:uat"
	@echo "                      Add VERSION=\$$(git rev-parse --short HEAD) for an extra immutable tag."
	@echo "  make release-backend|release-frontend   Push one group (uses TAG=$(TAG))"
	@echo ""
	@echo "  Deploy (SERVER — needs Makefile + docker-compose.production.yml + .env files):"
	@echo "  make deploy         PROD: pull latest :prod images and (re)start the stack"
	@echo "  make deploy-uat     UAT:  pull latest :uat images and (re)start the stack"
	@echo "  make pull|pull-uat  Pull images only (no restart)"
	@echo "                      PROD and UAT coexist (separate project/ports/volumes)."
	@echo "                      Migrations self-run at container start — no migrate step."
	@echo ""
	@echo "  Ops (add -uat variant or ENV_FILE=.env.uat to target the UAT stack):"
	@echo "  make ps | ps-uat            Show service status"
	@echo "  make logs | logs-uat        Tail logs from all services"
	@echo "  make logs-<svc>             Tail one service (api-gateway/auth/user/shipment/"
	@echo "                              partner/wallet/support/platform/license/frontend/db/redis)"
	@echo "  make restart | restart-uat  Restart all services"
	@echo "  make down | down-uat        Stop and remove containers (keeps volumes)"
	@echo "  make psql                   Open psql shell in the postgres container"
	@echo "  make backup                 pg_dump each DB to ./backups/<db>-<timestamp>.sql.gz"
	@echo ""
	@echo "  Data & DB (exec into the running stack; ENV_FILE=.env.uat for UAT):"
	@echo "  make db-init                Create DBs + migrate + db-sync + seed (full init)"
	@echo "  make migrate-all            Deploy committed Prisma migrations for every service"
	@echo "  make db-sync                Force schema to match schema.prisma (prisma db push)"
	@echo "  make migrate SERVICE=<svc>  Apply Prisma migrations for one service"
	@echo "  make seed                   Seed permissions/roles/superadmin (auth-service)"
	@echo "  make import-pincodes        Import pincode data (partner-service)"
	@echo "  make load-pincodes          Load pincode data (partner-service)"
	@echo "  make seed-geo               Seed geographical data (partner-service)"
	@echo ""
	@echo "  Local dev (BUILD MACHINE — full source, builds locally):"
	@echo "  make dev            Start the dev stack (docker-compose.yml, --profile all-services)"
	@echo "  make dev-down       Stop the dev stack"
	@echo "  make dev-logs       Tail dev stack logs"

# ============================================================================
# GHCR release — BUILD MACHINE (Mac) only; needs the source repo + login.
# ============================================================================
# All 10 images are environment-agnostic (the frontend uses same-origin
# NEXT_PUBLIC_API_URL="" + an in-network api-gateway:3001 rewrite), so PROD and
# UAT images are identical — only the pushed TAG differs. buildx layer cache
# makes the second env's build fast.

login: ## Log in to GHCR (username = GitHub user, password = PAT with write:packages)
	docker login ghcr.io

release-prod: TAG = prod
release-prod: release ## Build+push all images tagged :prod

release-uat: TAG = uat
release-uat: release ## Build+push all images tagged :uat

release: release-backend release-frontend ## Build+push all 10 images with TAG=$(TAG)

release-backend: ## Build+push the 9 backend images (TAG=$(TAG))
	@for svc in $(BACKEND_SERVICES); do \
	  echo ">>> Building+pushing $(REGISTRY)/logistics-$$svc:$(TAG)"; \
	  docker buildx build --platform $(PLATFORM) \
	    -f backend/$$svc/Dockerfile.prod \
	    -t $(REGISTRY)/logistics-$$svc:$(TAG) \
	    $(if $(VERSION),-t $(REGISTRY)/logistics-$$svc:$(VERSION),) \
	    --push . || exit 1; \
	done

release-frontend: ## Build+push the frontend image (TAG=$(TAG))
	@echo ">>> Building+pushing $(REGISTRY)/logistics-frontend:$(TAG)"
	docker buildx build --platform $(PLATFORM) \
	  -f frontend/Dockerfile.prod \
	  -t $(REGISTRY)/logistics-frontend:$(TAG) \
	  $(if $(VERSION),-t $(REGISTRY)/logistics-frontend:$(VERSION),) \
	  --push .

# ============================================================================
# Deploy — SERVER only; pulls prebuilt GHCR images and (re)starts the stack.
# Which tag runs comes from IMAGE_TAG in the selected env file.
# ============================================================================

deploy: ## SERVER PROD: pull latest :prod images and (re)start the stack
	$(COMPOSE_PROD) pull
	$(COMPOSE_PROD) up -d

deploy-uat: ENV_FILE = .env.uat
deploy-uat: ## SERVER UAT: pull latest :uat images and (re)start the stack
	$(COMPOSE_PROD) pull
	$(COMPOSE_PROD) up -d

pull: ## SERVER PROD: pull latest images (no restart)
	$(COMPOSE_PROD) pull

pull-uat: ENV_FILE = .env.uat
pull-uat: ## SERVER UAT: pull latest images (no restart)
	$(COMPOSE_PROD) pull

# ============================================================================
# Ops targets (server pull compose; ENV_FILE selects PROD vs UAT)
# ============================================================================
ps:
	$(COMPOSE_PROD) ps

ps-uat: ENV_FILE = .env.uat
ps-uat:
	$(COMPOSE_PROD) ps

restart:
	$(COMPOSE_PROD) restart

restart-uat: ENV_FILE = .env.uat
restart-uat:
	$(COMPOSE_PROD) restart

down:
	$(COMPOSE_PROD) down

down-uat: ENV_FILE = .env.uat
down-uat:
	$(COMPOSE_PROD) down

logs:
	$(COMPOSE_PROD) logs -f

logs-uat: ENV_FILE = .env.uat
logs-uat:
	$(COMPOSE_PROD) logs -f

logs-api-gateway:
	$(COMPOSE_PROD) logs -f api-gateway

logs-auth:
	$(COMPOSE_PROD) logs -f auth-service

logs-user:
	$(COMPOSE_PROD) logs -f user-service

logs-shipment:
	$(COMPOSE_PROD) logs -f shipment-service

logs-partner:
	$(COMPOSE_PROD) logs -f partner-service

logs-wallet:
	$(COMPOSE_PROD) logs -f wallet-service

logs-support:
	$(COMPOSE_PROD) logs -f support-service

logs-platform:
	$(COMPOSE_PROD) logs -f platform-service

logs-license:
	$(COMPOSE_PROD) logs -f license-service

logs-frontend:
	$(COMPOSE_PROD) logs -f frontend

logs-db:
	$(COMPOSE_PROD) logs -f postgres

logs-redis:
	$(COMPOSE_PROD) logs -f redis

psql:
	$(COMPOSE_PROD) exec postgres sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"'

# Dump every per-service database to ./backups (gitignored), gzipped. Uses the
# postgres container's own credentials; iterates the databases defined in the
# env file (falls back to the standard logistics_* set).
backup:
	@mkdir -p backups
	@ts=$$(date +%Y%m%d-%H%M%S); \
	for db in logistics_auth logistics_users logistics_shipments logistics_partners \
	          logistics_wallet logistics_support logistics_platforms logistics_license; do \
	  out="backups/$$db-$$ts.sql.gz"; \
	  echo ">>> Dumping $$db -> $$out"; \
	  $(COMPOSE_PROD) exec -T postgres sh -c "pg_dump -U \"\$$POSTGRES_USER\" $$db" | gzip > "$$out" \
	    || { echo "!!! Dump FAILED for $$db"; rm -f "$$out"; }; \
	done; \
	echo ">>> Backups written to ./backups/"

# ============================================================================
# Data & DB operations (exec into the running stack; ENV_FILE selects PROD/UAT)
# ============================================================================
# All run against the live containers — no source needed on the server. Add
# ENV_FILE=.env.uat (or use the running-stack env) to target UAT.

# Full DB init — mirrors `yarn db:init` (scripts/init-databases.sh) for the
# server, no source needed:
#   1. (Re)create the per-service databases from the init SQL already mounted in
#      the postgres container (idempotent — "already exists" errors are harmless).
#   2. Deploy Prisma migrations for every Prisma service.
# Seeds (e.g. the auth-service superadmin) run automatically at container start
# via scripts/production-entrypoint.sh, so they are not repeated here.
db-init:
	@echo ">>> Step 1: (re)creating per-service databases"
	-$(COMPOSE_PROD) exec -T postgres sh -c \
	  'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init-databases.sql'
	@echo ""
	@echo ">>> Step 2: deploying committed migrations (all services)"
	@$(MAKE) --no-print-directory migrate-all ENV_FILE=$(ENV_FILE)
	@echo ""
	@echo ">>> Step 3: syncing schema for changes with no migration (db push)"
	@$(MAKE) --no-print-directory db-sync ENV_FILE=$(ENV_FILE)
	@echo ""
	@echo ">>> Step 4: seeding (permissions, roles, superadmin)"
	@$(MAKE) --no-print-directory seed ENV_FILE=$(ENV_FILE)
	@echo ""
	@echo ">>> db-init complete"

# Deploy committed Prisma migrations for EVERY Prisma service (migrations also
# self-run at container start; this is a manual re-apply for the whole stack).
migrate-all:
	@for svc in $(PRISMA_SERVICES); do \
	  echo ">>> migrate deploy: $$svc"; \
	  $(COMPOSE_PROD) exec -T $$svc npx prisma@5.22.0 migrate deploy \
	    --schema=backend/$$svc/prisma/schema.prisma \
	    || echo "  !! migrate failed for $$svc (continuing)"; \
	done

# Force the DB schema to match schema.prisma for changes that have NO migration
# file (prisma db push). This is how `yarn db:init` (scripts/init-databases.sh)
# picks up schema edits that were never turned into a migration — e.g. the
# shipments.shipment_type column and the charge_discount_packages table.
# Run AFTER migrate-all so committed migrations apply first, then this fills the
# gap. WARNING: --accept-data-loss allows db push to DROP columns/tables that
# were removed from the schema. The current drift is additive, but review before
# running against a database with real data you cannot lose.
db-sync:
	@for svc in $(PRISMA_SERVICES); do \
	  echo ">>> db push (schema sync): $$svc"; \
	  $(COMPOSE_PROD) exec -T $$svc npx prisma@5.22.0 db push \
	    --schema=backend/$$svc/prisma/schema.prisma \
	    --accept-data-loss --skip-generate \
	    || echo "  !! db push failed for $$svc (continuing)"; \
	done

# Run seed scripts for every Prisma service that ships one (backend/<svc>/prisma/
# seed.js). auth-service seeds permissions, role-permission mappings, and the
# default superadmin (admin@logistics.com / Admin@123456). Idempotent (upserts)
# and best-effort — services without a seed.js are skipped.
seed:
	@for svc in $(PRISMA_SERVICES); do \
	  if $(COMPOSE_PROD) exec -T $$svc sh -c "test -f backend/$$svc/prisma/seed.js" 2>/dev/null; then \
	    echo ">>> seeding: $$svc"; \
	    $(COMPOSE_PROD) exec -T $$svc sh -c "cd backend/$$svc/prisma && node seed.js" \
	      || echo "  !! seed failed for $$svc (continuing)"; \
	  else \
	    echo ">>> no seed for $$svc (skip)"; \
	  fi; \
	done

# Apply Prisma migrations for ONE service. Usage: make migrate SERVICE=license-service
migrate:
	@if [ -z "$(SERVICE)" ]; then \
	  echo "Usage: make migrate SERVICE=<name>  (e.g. auth-service, license-service, partner-service)"; \
	  exit 1; \
	fi
	$(COMPOSE_PROD) exec $(SERVICE) npx prisma@5.22.0 migrate deploy \
	  --schema=backend/$(SERVICE)/prisma/schema.prisma

# Partner-service data loaders (mirror the package.json *:prod scripts).
import-pincodes:
	$(COMPOSE_PROD) exec partner-service node backend/partner-service/scripts/import-pincode-data.js

load-pincodes:
	$(COMPOSE_PROD) exec partner-service node backend/partner-service/scripts/load-pincode-data.js

seed-geo:
	$(COMPOSE_PROD) exec partner-service node backend/partner-service/prisma/seed-geographical-data.js

# ============================================================================
# Local dev — BUILD MACHINE (full source; builds locally, no registry).
# ============================================================================
dev: ## Start the dev stack (all services)
	$(COMPOSE_DEV) --profile all-services up -d

dev-down: ## Stop the dev stack
	$(COMPOSE_DEV) --profile all-services down

dev-logs: ## Tail dev stack logs
	$(COMPOSE_DEV) logs -f
