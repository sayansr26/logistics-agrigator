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

.PHONY: help login release release-prod release-uat release release-backend \
        release-frontend deploy deploy-uat pull pull-uat up down down-uat \
        restart restart-uat ps ps-uat logs logs-uat \
        logs-api-gateway logs-auth logs-user logs-shipment logs-partner \
        logs-wallet logs-support logs-platform logs-license logs-frontend \
        logs-db logs-redis psql backup dev dev-down dev-logs

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
# Local dev — BUILD MACHINE (full source; builds locally, no registry).
# ============================================================================
dev: ## Start the dev stack (all services)
	$(COMPOSE_DEV) --profile all-services up -d

dev-down: ## Stop the dev stack
	$(COMPOSE_DEV) --profile all-services down

dev-logs: ## Tail dev stack logs
	$(COMPOSE_DEV) logs -f
