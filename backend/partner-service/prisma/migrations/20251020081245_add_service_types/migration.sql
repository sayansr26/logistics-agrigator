-- CreateTable
CREATE TABLE "service_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(20) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "base_charge" VARCHAR(20) NOT NULL DEFAULT '0',
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "additional_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_name_key" ON "service_types"("name");

-- CreateIndex
CREATE INDEX "service_types_name_idx" ON "service_types"("name");

-- CreateIndex
CREATE INDEX "service_types_category_idx" ON "service_types"("category");

-- CreateIndex
CREATE INDEX "service_types_is_available_idx" ON "service_types"("is_available");

-- CreateIndex
CREATE INDEX "service_types_sort_order_idx" ON "service_types"("sort_order");
