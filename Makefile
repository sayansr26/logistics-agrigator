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
        logs-db logs-redis psql backup db-dump db-dump-uat db-dump-dev \
        db-restore db-restore-prod redis-flush db-init migrate migrate-all db-sync \
        seed import-pincodes classify-cities load-pincodes seed-geo \
        dev dev-down dev-logs

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
	@echo "  Full dump / restore (Postgres + Redis in ONE bundle):"
	@echo "  make db-dump                Dump PROD stack  -> ./backups/logistics-dump-<ts>.tar.gz"
	@echo "  make db-dump-uat            Dump UAT stack   -> ./backups/logistics-dump-uat-<ts>.tar.gz"
	@echo "  make db-dump-dev            Dump local dev stack (docker-compose.yml)"
	@echo "  make db-restore FILE=<f>    Restore a bundle into the LOCAL DEV stack (destructive)"
	@echo "                              Stops app services, restores, starts them back up."
	@echo "                              Omit FILE to auto-pick the newest ./backups/*.tar.gz"
	@echo "  make db-restore-prod FILE=<f>  Restore into the PROD/UAT stack (ENV_FILE selects)"
	@echo ""
	@echo "  Data & DB (exec into the running stack; ENV_FILE=.env.uat for UAT):"
	@echo "  make db-init                Create DBs + migrate + db-sync + seed (full init)"
	@echo "  make migrate-all            Deploy committed Prisma migrations for every service"
	@echo "  make db-sync                Force schema to match schema.prisma (prisma db push)"
	@echo "  make migrate SERVICE=<svc>  Apply Prisma migrations for one service"
	@echo "  make seed                   Seed permissions/roles/superadmin (auth-service)"
	@echo "  make import-pincodes        Import pincode data from the CSV baked into the image"
	@echo "  make classify-cities        Set metro/X-Y-Z class on cities (run after import)"
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
# Full dump / restore — Postgres + Redis in a single portable bundle
# ============================================================================
# db-dump produces ./backups/logistics-dump-<ts>.tar.gz containing:
#   postgres.sql.gz  pg_dumpall --clean --if-exists --no-role-passwords
#                    (ALL databases + roles; role passwords are deliberately
#                    excluded so a prod bundle carries no credentials and can't
#                    overwrite the target's local password)
#   redis.rdb        point-in-time RDB snapshot (redis-cli SAVE, then copied out)
#   MANIFEST.txt     what/when/where it came from
# db-restore imports that bundle into the LOCAL dev stack so you can work with
# real data. Both sides use only the containers — nothing needs psql/redis-cli
# installed on the host.

# Which stack each side talks to (override on the command line if needed).
DUMP_COMPOSE    ?= $(COMPOSE_PROD)
RESTORE_COMPOSE ?= $(COMPOSE_DEV)
DUMP_LABEL      ?= prod

db-dump: ## Full Postgres+Redis dump of the PROD stack
	@mkdir -p backups
	@ts=$$(date +%Y%m%d-%H%M%S); \
	stage="backups/.stage-$$ts"; \
	out="backups/logistics-dump-$(DUMP_LABEL)-$$ts.tar.gz"; \
	mkdir -p "$$stage"; \
	trap 'rm -rf "$$stage"' EXIT; \
	echo ">>> [1/3] pg_dumpall (all databases + roles)"; \
	$(DUMP_COMPOSE) exec -T postgres sh -c \
	  'pg_dumpall -U "$$POSTGRES_USER" --clean --if-exists --no-role-passwords' \
	  | gzip > "$$stage/postgres.sql.gz" \
	  || { echo "!!! Postgres dump FAILED"; exit 1; }; \
	[ -s "$$stage/postgres.sql.gz" ] || { echo "!!! Postgres dump is empty"; exit 1; }; \
	echo ">>> [2/3] Redis SAVE + copy dump.rdb"; \
	$(DUMP_COMPOSE) exec -T redis redis-cli SAVE > /dev/null \
	  || { echo "!!! Redis SAVE FAILED"; exit 1; }; \
	$(DUMP_COMPOSE) cp redis:/data/dump.rdb "$$stage/redis.rdb" \
	  || { echo "!!! Redis copy FAILED"; exit 1; }; \
	echo ">>> [3/3] packing bundle"; \
	{ echo "source     : $(DUMP_LABEL) ($(DUMP_COMPOSE))"; \
	  echo "created_at : $$(date -u +%Y-%m-%dT%H:%M:%SZ)"; \
	  echo "host       : $$(hostname)"; \
	  echo "postgres   : pg_dumpall --clean --if-exists --no-role-passwords"; \
	  echo "redis      : RDB snapshot via redis-cli SAVE"; } > "$$stage/MANIFEST.txt"; \
	tar -czf "$$out" -C "$$stage" postgres.sql.gz redis.rdb MANIFEST.txt; \
	echo ""; \
	echo ">>> Dump written: $$out ($$(du -h "$$out" | cut -f1))"; \
	echo ">>> Import locally with: make db-restore FILE=$$out"

db-dump-uat: ENV_FILE = .env.uat
db-dump-uat: DUMP_LABEL = uat
db-dump-uat: db-dump ## Full Postgres+Redis dump of the UAT stack

db-dump-dev: DUMP_COMPOSE = $(COMPOSE_DEV)
db-dump-dev: DUMP_LABEL = dev
db-dump-dev: db-dump ## Full Postgres+Redis dump of the local dev stack

# Restore a bundle. DESTRUCTIVE: pg_dumpall --clean drops and recreates every
# database in the target, and Redis is replaced wholesale by the snapshot.
# Usage: make db-restore FILE=backups/logistics-dump-prod-20250101-120000.tar.gz
#        make db-restore                    (auto-picks the newest bundle)
#        make db-restore-prod FILE=...      (targets the PROD/UAT stack instead)
db-restore: ## Restore a dump bundle into the LOCAL dev stack (destructive)
	@file="$(FILE)$(BACKUP)"; \
	if [ -z "$$file" ]; then \
	  file=$$(ls -t backups/logistics-dump-*.tar.gz 2>/dev/null | head -1); \
	  [ -n "$$file" ] || { echo "No bundle found. Usage: make db-restore FILE=backups/<bundle>.tar.gz"; exit 1; }; \
	  echo ">>> No FILE given — using newest bundle: $$file"; \
	fi; \
	[ -f "$$file" ] || { echo "!!! Not found: $$file"; exit 1; }; \
	stage="backups/.restore-$$$$"; \
	mkdir -p "$$stage"; \
	trap 'rm -rf "$$stage"' EXIT; \
	tar -xzf "$$file" -C "$$stage" || { echo "!!! Could not unpack $$file"; exit 1; }; \
	echo ">>> Restoring $$file"; \
	cat "$$stage/MANIFEST.txt" 2>/dev/null; \
	echo ""; \
	echo ">>> [1/4] stopping app services (open connections block DROP DATABASE)"; \
	$(RESTORE_COMPOSE) stop $(BACKEND_SERVICES) frontend > /dev/null 2>&1 || true; \
	echo ">>> [2/4] restoring Postgres (drops + recreates every database)"; \
	$(RESTORE_COMPOSE) exec -T postgres sh -c \
	  'psql -U "$$POSTGRES_USER" -d postgres -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IS NOT NULL AND datname NOT IN ('"'"'postgres'"'"','"'"'template0'"'"','"'"'template1'"'"') AND pid <> pg_backend_pid();"' \
	  > /dev/null 2>&1 || true; \
	gunzip -c "$$stage/postgres.sql.gz" \
	  | $(RESTORE_COMPOSE) exec -T postgres sh -c \
	      'psql -U "$$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=0 --quiet -o /dev/null' \
	  || { echo "!!! Postgres restore FAILED"; exit 1; }; \
	echo "    (benign: \"role ... already exists\" / \"current user cannot be dropped\")"; \
	echo ">>> resetting the DB role password to this stack's own POSTGRES_PASSWORD"; \
	$(RESTORE_COMPOSE) exec -T postgres sh -c \
	  'psql -U "$$POSTGRES_USER" -d postgres -q -o /dev/null -c "ALTER ROLE \"$$POSTGRES_USER\" WITH LOGIN SUPERUSER PASSWORD '"'"'$$POSTGRES_PASSWORD'"'"';"' \
	  || echo "  !! could not reset role password — services may fail to authenticate"; \
	echo ">>> [3/4] restoring Redis (replaces the whole keyspace)"; \
	if [ -f "$$stage/redis.rdb" ]; then \
	  $(RESTORE_COMPOSE) exec -T redis redis-cli FLUSHALL > /dev/null; \
	  $(RESTORE_COMPOSE) stop redis; \
	  $(RESTORE_COMPOSE) cp "$$stage/redis.rdb" redis:/data/dump.rdb \
	    || { echo "!!! Redis copy FAILED"; $(RESTORE_COMPOSE) start redis; exit 1; }; \
	  $(RESTORE_COMPOSE) run --rm --no-deps --entrypoint sh -T redis -c \
	    'rm -rf /data/appendonlydir /data/appendonly.aof' > /dev/null 2>&1 || true; \
	  $(RESTORE_COMPOSE) start redis; \
	else \
	  echo "  (no redis.rdb in bundle — skipping Redis)"; \
	fi; \
	echo ">>> [4/4] starting app services back up"; \
	$(RESTORE_COMPOSE) start $(BACKEND_SERVICES) frontend > /dev/null 2>&1 || true; \
	echo ""; \
	echo ">>> Restore complete."

db-restore-prod: RESTORE_COMPOSE = $(COMPOSE_PROD)
db-restore-prod: db-restore ## Restore a bundle into the PROD/UAT stack (ENV_FILE selects)

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
# import-pincodes reads the merged CSV baked into the image at release time
# (data/merged_pincode_data.csv). Non-TTY exec means the importer's live-vs-
# local prompt auto-selects LOCAL — it never calls data.gov.in from the server.
# To ship NEWER pincode data: refresh locally (yarn fetch:india-post &&
# yarn build:pincodes), commit, make release-prod, then on the server run
# make deploy && make import-pincodes && make classify-cities.
import-pincodes:
	$(COMPOSE_PROD) exec -T partner-service node backend/partner-service/scripts/import-pincode-data.js

# Set cityClass (X/Y/Z) + isMetro on every city from the official MoF list
# (data/city-classification.json, also baked into the image). Idempotent.
# Run after import-pincodes so newly created cities get classified.
classify-cities:
	$(COMPOSE_PROD) exec -T partner-service node backend/partner-service/scripts/classify-cities.js

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
