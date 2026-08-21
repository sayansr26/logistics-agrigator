-- CreateEnum
CREATE TYPE "ApiEnvironment" AS ENUM ('live', 'test');

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" UUID NOT NULL,
    "client_id" VARCHAR(64) NOT NULL,
    "secret_hash" VARCHAR(255) NOT NULL,
    "secret_last4" VARCHAR(8) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "acting_user_id" UUID NOT NULL,
    "acting_phone" VARCHAR(20),
    "tenant_id" UUID,
    "outlet_id" UUID,
    "role" "Role" NOT NULL,
    "scopes" TEXT[],
    "environment" "ApiEnvironment" NOT NULL DEFAULT 'live',
    "ip_allowlist" TEXT[],
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "pinned_version" VARCHAR(20),
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_client_id_key" ON "api_credentials"("client_id");

-- CreateIndex
CREATE INDEX "api_credentials_acting_user_id_idx" ON "api_credentials"("acting_user_id");

-- CreateIndex
CREATE INDEX "api_credentials_outlet_id_idx" ON "api_credentials"("outlet_id");

-- CreateIndex
CREATE INDEX "api_credentials_revoked_at_idx" ON "api_credentials"("revoked_at");

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_acting_user_id_fkey" FOREIGN KEY ("acting_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

