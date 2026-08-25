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
        migrate-shipment-ownership-dry migrate-shipment-ownership \
        clean clean-uat clean-keep-data clean-keep-data-uat \
        clean-all clean-all-uat clean-build-cache \
        redeploy redeploy-uat redeploy-fresh redeploy-fresh-uat \
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
	@echo "  make db-restore FILE=<f>    Restore a bundle into the LOCAL DEV stack"
	@echo "                              Replaces ONLY the databases carried in the bundle."
	@echo "                              Never touches existing roles/users or their passwords,"
	@echo "                              and never drops [$(KEEP_DATABASES)]."
	@echo "                              Stops app services, restores, verifies, restarts them."
	@echo "                              Omit FILE to auto-pick the newest ./backups/*.tar.gz"
	@echo "                              KEEP_DATABASES=a,b,c to protect more databases"
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
	@echo "  make migrate-shipment-ownership-dry  Preview shipment ownership backfill (no writes)"
	@echo "  make migrate-shipment-ownership      Re-own outlet bookings to the outlet owner"
	@echo ""
	@echo "  Clean / redeploy (scoped to this ENV_FILE's project — never touches"
	@echo "  the other stacks or unrelated projects; add -uat for the UAT stack):"
	@echo "  make clean          FULL WIPE: containers + networks + images + VOLUMES."
	@echo "                      ALL DATA IS DELETED. Dumps to ./backups/ first"
	@echo "                      unless SKIP_BACKUP=1."
	@echo "  make redeploy       clean + deploy + db-init — complete rebuild from"
	@echo "                      scratch: empty volumes, fresh images, seeded schema."
	@echo "                      ^ this is the pre-release one"
	@echo "  make clean-keep-data  Same as clean but VOLUMES SURVIVE — use when the"
	@echo "                      database must stay exactly as it is."
	@echo "  make clean-build-cache  BUILD MACHINE: drop buildx cache (slow next release)"
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

# Restore a bundle into a target stack.
#
# NON-DESTRUCTIVE to the target's identity — the restore never touches:
#   * roles / users        role DDL (DROP|CREATE|ALTER ROLE) is stripped from
#                          the dump. Roles named by the bundle that are MISSING
#                          locally are created NOLOGIN (so `ALTER DATABASE ...
#                          OWNER TO x` resolves); roles that already exist —
#                          including POSTGRES_USER and its password — are left
#                          exactly as they are.
#   * template1/postgres   the bundle's sections for the cluster's own
#                          maintenance databases (which contain `DROP DATABASE
#                          template1` / `DROP DATABASE postgres`) are skipped
#                          entirely. Extend the list with KEEP_DATABASES=...
#   * \restrict/\unrestrict guards emitted by pg_dump >= 15.14 are stripped so
#                          an older psql in the target container still works.
#
# DESTRUCTIVE to the payload — every database carried IN the bundle is dropped
# and recreated, and Redis is replaced wholesale by the snapshot. That is the
# point of a restore; nothing else in the cluster is modified.
#
# Usage: make db-restore FILE=backups/logistics-dump-prod-20250101-120000.tar.gz
#        make db-restore                    (auto-picks the newest bundle)
#        make db-restore-prod FILE=...      (targets the PROD/UAT stack instead)

# Stream filter applied to postgres.sql.gz before it reaches psql. PROTECT is
# the target stack's own POSTGRES_DB. Kept on one line: a backslash-continued
# line inside single quotes would put a literal backslash into the awk program.
# Databases the restore must never drop or overwrite: template1 and postgres are
# the cluster's own maintenance databases (postgres is what the restore session
# itself connects through). Add more with e.g.
#   make db-restore KEEP_DATABASES=template1,postgres,logistics_main
KEEP_DATABASES ?= template1,postgres

# Stream filter applied to postgres.sql.gz before it reaches psql. KEEP is the
# comma-separated protected list. Kept on one line: a backslash-continued line
# inside single quotes would put a literal backslash into the awk program.
RESTORE_FILTER = BEGIN{c=split(KEEP,k,","); for(i=1;i<=c;i++) prot[k[i]]=1} /^\\restrict/{next} /^\\unrestrict/{next} /^-- Database "/{n=$$0; sub(/^-- Database "/,"",n); sub(/" dump$$/,"",n); skip=(n in prot)?1:0} skip{next} /^DROP ROLE /{next} /^CREATE ROLE /{next} /^ALTER ROLE /{next} /^(DROP|CREATE) DATABASE /{d=$$0; sub(/^(DROP|CREATE) DATABASE (IF EXISTS )?/,"",d); sub(/[; ].*$$/,"",d); if(d in prot) next} {print}

# Same protected list, used to enumerate the databases the bundle will replace.
RESTORE_DBLIST = BEGIN{c=split(KEEP,k,","); for(i=1;i<=c;i++) prot[k[i]]=1} /^-- Database "/{n=$$0; sub(/^-- Database "/,"",n); sub(/" dump$$/,"",n); if(!(n in prot)) print n}

db-restore: ## Restore a dump bundle into the LOCAL dev stack (data-only; roles/users preserved)
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
	echo ">>> [1/6] reading the target stack's own identity"; \
	pguser=$$($(RESTORE_COMPOSE) exec -T postgres sh -c 'printf %s "$$POSTGRES_USER"' | tr -d '\r'); \
	pgdb=$$($(RESTORE_COMPOSE) exec -T postgres sh -c 'printf %s "$$POSTGRES_DB"' | tr -d '\r'); \
	[ -n "$$pguser" ] || { echo "!!! postgres container not reachable (is the stack up?)"; exit 1; }; \
	echo "    connecting as role '$$pguser' (admin db '$$pgdb')"; \
	echo "    protected: all existing roles/passwords + databases [$(KEEP_DATABASES)]"; \
	echo ">>> [2/6] stopping app services (open connections block DROP DATABASE)"; \
	$(RESTORE_COMPOSE) stop $(BACKEND_SERVICES) frontend > /dev/null 2>&1 || true; \
	echo ">>> [3/6] reconciling roles (existing roles + passwords are NOT modified)"; \
	for r in $$(gunzip -c "$$stage/postgres.sql.gz" | awk '/^CREATE ROLE /{r=$$3; sub(/;$$/,"",r); print r}' | sort -u); do \
	  if $(RESTORE_COMPOSE) exec -T postgres sh -c "psql -U \"\$$POSTGRES_USER\" -d postgres -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$$r'\"" 2>/dev/null | grep -q 1; then \
	    echo "    role '$$r' already exists — left untouched"; \
	  else \
	    echo "    role '$$r' missing — creating it NOLOGIN (owns restored objects only)"; \
	    $(RESTORE_COMPOSE) exec -T postgres sh -c "psql -U \"\$$POSTGRES_USER\" -d postgres -q -o /dev/null -c 'CREATE ROLE \"$$r\" NOLOGIN'" \
	      || echo "    !! could not create role '$$r' — ownership statements may fail"; \
	  fi; \
	done; \
	echo ">>> [4/6] restoring Postgres (drops + recreates only the bundle's databases)"; \
	$(RESTORE_COMPOSE) exec -T postgres sh -c \
	  'psql -U "$$POSTGRES_USER" -d postgres -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IS NOT NULL AND datname NOT IN ('"'"'postgres'"'"','"'"'template0'"'"','"'"'template1'"'"') AND pid <> pg_backend_pid();"' \
	  > /dev/null 2>&1 || true; \
	gunzip -c "$$stage/postgres.sql.gz" \
	  | awk -v KEEP="$(KEEP_DATABASES)" '$(RESTORE_FILTER)' \
	  | $(RESTORE_COMPOSE) exec -T postgres sh -c \
	      'psql -U "$$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=0 --quiet -o /dev/null' \
	  2> "$$stage/psql.err" \
	  || { echo "!!! Postgres restore FAILED"; sed -n '1,40p' "$$stage/psql.err"; exit 1; }; \
	errs=$$(grep -c '^ERROR' "$$stage/psql.err" 2>/dev/null || echo 0); \
	[ "$$errs" = "0" ] || { echo "    $$errs psql ERROR line(s) — first few:"; grep '^ERROR' "$$stage/psql.err" | head -5 | sed 's/^/      /'; }; \
	echo ">>> [5/6] restoring Redis (replaces the whole keyspace)"; \
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
	echo ">>> [6/6] verifying restored databases, then starting app services"; \
	missing=0; \
	for db in $$(gunzip -c "$$stage/postgres.sql.gz" | awk -v PROTECT="$$pgdb" '/^-- Database "/{n=$$0; sub(/^-- Database "/,"",n); sub(/" dump$$/,"",n); if(n!="template1" && n!=PROTECT) print n}'); do \
	  t=$$($(RESTORE_COMPOSE) exec -T postgres sh -c "psql -U \"\$$POSTGRES_USER\" -d $$db -tAc \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" 2>/dev/null | tr -d '\r'); \
	  if [ -n "$$t" ] && [ "$$t" -gt 0 ] 2>/dev/null; then \
	    echo "    ok   $$db  ($$t tables)"; \
	  else \
	    echo "    FAIL $$db  (missing or empty)"; missing=1; \
	  fi; \
	done; \
	$(RESTORE_COMPOSE) start $(BACKEND_SERVICES) frontend > /dev/null 2>&1 || true; \
	echo ""; \
	[ "$$missing" = "0" ] || { echo ">>> Restore FINISHED WITH ERRORS — see the FAIL rows above."; exit 1; }; \
	echo ">>> Restore complete. Roles, passwords and [$(KEEP_DATABASES)] were not modified."

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

# One-time backfill for shipments booked on behalf of an outlet: user_id becomes
# the outlet owner (so the outlet portal + External API can see them) and
# outlet_id is normalized to the outlet ENTITY id. Audit-logged per row.
# ALWAYS dry-run first; add ENV_FILE=.env.uat to target the UAT stack.
migrate-shipment-ownership-dry:
	$(COMPOSE_PROD) exec -T shipment-service node backend/shipment-service/scripts/migrate-shipment-ownership.js

migrate-shipment-ownership:
	$(COMPOSE_PROD) exec -T shipment-service node backend/shipment-service/scripts/migrate-shipment-ownership.js --apply

# ============================================================================
# Clean / redeploy — wipe the stack so `make deploy` rebuilds it from scratch
# ============================================================================
# Everything here is scoped to the selected env's COMPOSE_PROJECT_NAME
# (logistics-prod / logistics-uat / logistics-dev), so cleaning PROD cannot
# touch the UAT stack, the local dev stack, or any unrelated project on the
# host. Nothing calls `docker system prune`, which would.
#
#   make clean            FULL WIPE. Containers, networks, IMAGES and VOLUMES.
#                         The databases are deleted — Postgres and Redis come
#                         back empty on the next deploy. A dump is written to
#                         ./backups/ first so the data is still recoverable;
#                         pass SKIP_BACKUP=1 to skip that.
#
#   make clean-keep-data  Same, but the volumes SURVIVE. Use this when you only
#                         want fresh containers and a genuine image re-pull and
#                         the database must stay exactly as it is.
#
#   make redeploy         clean + deploy + db-init — the complete from-scratch
#                         rebuild: empty volumes, freshly pulled images, schema
#                         migrated and seeded.
#
# -uat variants target the UAT stack. `clean-all` / `redeploy-fresh` are kept
# as aliases of `clean` / `redeploy`.

# Shared: drop this stack's images so the next deploy genuinely re-pulls.
define rm_stack_images
	imgs=$$($(COMPOSE_PROD) config --images 2>/dev/null | sort -u); \
	if [ -n "$$imgs" ]; then \
	  echo "$$imgs" | sed 's/^/      /'; \
	  docker rmi -f $$imgs > /dev/null 2>&1 || true; \
	else \
	  echo "      (no images resolved from compose config)"; \
	fi
endef

clean: ## FULL WIPE: containers, networks, images AND volumes (DELETES ALL DATA)
	@echo ">>> Cleaning stack: $(ENV_FILE)  — containers, networks, images AND VOLUMES"
	@if [ "$(SKIP_BACKUP)" = "1" ]; then \
	  echo ">>> [1/4] SKIP_BACKUP=1 — no dump taken, the data will be unrecoverable"; \
	else \
	  echo ">>> [1/4] dumping data before the wipe (SKIP_BACKUP=1 to skip)"; \
	  $(MAKE) --no-print-directory db-dump ENV_FILE=$(ENV_FILE) DUMP_LABEL=preclean-$(DUMP_LABEL) \
	    || echo "    !! dump failed (stack already down?) — continuing with the wipe"; \
	fi
	@echo ">>> [2/4] stopping and removing containers, networks AND volumes"
	-$(COMPOSE_PROD) down --volumes --remove-orphans
	@echo ">>> [3/4] removing this stack's images (forces a real re-pull on deploy)"
	@$(rm_stack_images)
	@echo ">>> [4/4] volumes remaining for this project (should be none):"
	@proj=$$(grep -E '^COMPOSE_PROJECT_NAME=' $(ENV_FILE) 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	if [ -n "$$proj" ]; then \
	  left=$$(docker volume ls --filter "label=com.docker.compose.project=$$proj" --format '{{.Name}}' 2>/dev/null); \
	  if [ -n "$$left" ]; then echo "$$left" | sed 's/^/      /'; else echo "      (none — all removed)"; fi; \
	else \
	  echo "      (COMPOSE_PROJECT_NAME not set in $(ENV_FILE))"; \
	fi
	@echo ""
	@echo ">>> Clean complete. THE DATABASES ARE EMPTY."
	@echo ">>> Rebuild everything with:  make redeploy"
	@echo ">>> Or restore the dump with: make deploy && make db-restore-prod FILE=backups/<bundle>.tar.gz"

clean-keep-data: ## Remove containers, networks and images but KEEP the volumes
	@echo ">>> Cleaning stack: $(ENV_FILE)  (volumes/data are NOT touched)"
	@echo ">>> [1/3] stopping and removing containers + networks"
	-$(COMPOSE_PROD) down --remove-orphans
	@echo ">>> [2/3] removing this stack's images (forces a real re-pull on deploy)"
	@$(rm_stack_images)
	@echo ">>> [3/3] surviving volumes (data kept):"
	@proj=$$(grep -E '^COMPOSE_PROJECT_NAME=' $(ENV_FILE) 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	if [ -n "$$proj" ]; then \
	  docker volume ls --filter "label=com.docker.compose.project=$$proj" --format '      {{.Name}}' 2>/dev/null; \
	else \
	  echo "      (COMPOSE_PROJECT_NAME not set in $(ENV_FILE))"; \
	fi
	@echo ""
	@echo ">>> Clean complete. Data is intact. Now run: make deploy"

clean-keep-data-uat: ENV_FILE = .env.uat
clean-keep-data-uat: clean-keep-data ## Keep-data clean against the UAT stack

clean-uat: ENV_FILE = .env.uat
clean-uat: clean ## Full wipe of the UAT stack

clean-all: clean ## Alias of `make clean`
clean-all-uat: clean-uat ## Alias of `make clean-uat`

# Build-machine only: buildx layer cache. Kept out of `clean` because dropping
# it makes the next `make release-*` a full rebuild of all 10 images.
clean-build-cache: ## BUILD MACHINE: drop the buildx layer cache (slow next release)
	docker buildx prune -af

# Full from-scratch rebuild: empty volumes, fresh images, schema + seed data.
redeploy: ## clean + deploy + db-init — complete from-scratch rebuild
	@$(MAKE) --no-print-directory clean ENV_FILE=$(ENV_FILE) SKIP_BACKUP=$(SKIP_BACKUP)
	@echo ""
	@$(MAKE) --no-print-directory deploy ENV_FILE=$(ENV_FILE)
	@echo ""
	@echo ">>> waiting for Postgres to accept connections"
	@for i in $$(seq 1 60); do \
	  if $(COMPOSE_PROD) exec -T postgres sh -c 'pg_isready -U "$$POSTGRES_USER"' > /dev/null 2>&1; then \
	    echo "    postgres ready after $${i}s"; break; \
	  fi; \
	  [ "$$i" = "60" ] && { echo "!!! Postgres not ready after 60s — run 'make db-init' manually."; exit 1; }; \
	  sleep 1; \
	done
	@echo ""
	@$(MAKE) --no-print-directory db-init ENV_FILE=$(ENV_FILE)
	@echo ""
	@echo ">>> Redeploy complete — empty databases, schema migrated and seeded."
	@echo ">>> Check with: make ps"

redeploy-uat: ENV_FILE = .env.uat
redeploy-uat: redeploy ## Complete from-scratch rebuild of the UAT stack

redeploy-fresh: redeploy ## Alias of `make redeploy`
redeploy-fresh-uat: redeploy-uat ## Alias of `make redeploy-uat`

# ============================================================================
# Local dev — BUILD MACHINE (full source; builds locally, no registry).
# ============================================================================
dev: ## Start the dev stack (all services)
	$(COMPOSE_DEV) --profile all-services up -d

dev-down: ## Stop the dev stack
	$(COMPOSE_DEV) --profile all-services down

dev-logs: ## Tail dev stack logs
	$(COMPOSE_DEV) logs -f
