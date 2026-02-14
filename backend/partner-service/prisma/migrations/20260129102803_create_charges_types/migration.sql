-- AlterTable
ALTER TABLE "partner_channel_configs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pincode_types" ALTER COLUMN "id" DROP DEFAULT;

-- The next migration (20260129120000_simplify_pincode_types) introduces
-- pincode_types.type. On fresh databases this column does not exist yet.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pincode_types'
          AND column_name = 'type'
    ) THEN
        EXECUTE 'ALTER TABLE "pincode_types" ALTER COLUMN "type" DROP DEFAULT';
    END IF;
END $$;

-- CreateTable
CREATE TABLE "charges_types" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charges_types_partner_id_is_active_idx" ON "charges_types"("partner_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "charges_types_partner_id_name_key" ON "charges_types"("partner_id", "name");

-- AddForeignKey
ALTER TABLE "charges_types" ADD CONSTRAINT "charges_types_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
