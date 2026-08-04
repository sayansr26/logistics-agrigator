-- CreateEnum
CREATE TYPE "ChargeApplyStage" AS ENUM ('QUOTE', 'BOOKING_OPTION', 'EVENT');

-- CreateTable
CREATE TABLE "charge_definitions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(40) NOT NULL,
    "apply_stage" "ChargeApplyStage" NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 500,
    "computation" JSONB NOT NULL,
    "booking_question" JSONB,
    "conditions" JSONB,
    "aggregation" JSONB,
    "flags" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_charge_configs" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "channel_id" UUID,
    "charge_definition_id" UUID NOT NULL,
    "config" JSONB NOT NULL,
    "conditions" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_charge_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_config_versions" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_charge_suggestions" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "input_context" JSONB NOT NULL,
    "suggestion" JSONB NOT NULL,
    "validation" JSONB,
    "model_used" VARCHAR(60),
    "created_by_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_charge_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charge_definitions_code_key" ON "charge_definitions"("code");

-- CreateIndex
CREATE INDEX "charge_definitions_apply_stage_is_active_idx" ON "charge_definitions"("apply_stage", "is_active");

-- CreateIndex
CREATE INDEX "charge_definitions_category_is_active_idx" ON "charge_definitions"("category", "is_active");

-- CreateIndex
CREATE INDEX "partner_charge_configs_partner_id_is_active_idx" ON "partner_charge_configs"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "partner_charge_configs_charge_definition_id_is_active_idx" ON "partner_charge_configs"("charge_definition_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "partner_charge_configs_partner_id_charge_definition_id_chan_key" ON "partner_charge_configs"("partner_id", "charge_definition_id", "channel_id");

-- CreateIndex
CREATE INDEX "charge_config_versions_entity_type_entity_id_idx" ON "charge_config_versions"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_config_versions_entity_type_entity_id_version_key" ON "charge_config_versions"("entity_type", "entity_id", "version");

-- CreateIndex
CREATE INDEX "ai_charge_suggestions_kind_status_idx" ON "ai_charge_suggestions"("kind", "status");

-- AddForeignKey
ALTER TABLE "partner_charge_configs" ADD CONSTRAINT "partner_charge_configs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_charge_configs" ADD CONSTRAINT "partner_charge_configs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "partner_service_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_charge_configs" ADD CONSTRAINT "partner_charge_configs_charge_definition_id_fkey" FOREIGN KEY ("charge_definition_id") REFERENCES "charge_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

