-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RTO', 'NDR');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PREPAID', 'COD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RESERVED', 'CONFIRMED', 'FAILED', 'REFUNDED', 'NO_REFUND');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('STANDARD', 'EXPRESS', 'ECONOMY');

-- CreateEnum
CREATE TYPE "ndr_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REATTEMPT_SCHEDULED', 'ADDRESS_UPDATED', 'RTO_INITIATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('BULK_SHIPMENT', 'BULK_UPDATE', 'BULK_CANCEL', 'DATA_EXPORT', 'DATA_IMPORT');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "pickup_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "client_id" UUID,
    "user_id" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "payment_type" "PaymentType" NOT NULL DEFAULT 'PREPAID',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "cod_amount" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "pickup_name" VARCHAR(100) NOT NULL,
    "pickup_phone" VARCHAR(15) NOT NULL,
    "pickup_email" VARCHAR(255),
    "pickup_line1" VARCHAR(255) NOT NULL,
    "pickup_line2" VARCHAR(255),
    "pickup_landmark" VARCHAR(100),
    "pickup_city" VARCHAR(50) NOT NULL,
    "pickup_state" VARCHAR(50) NOT NULL,
    "pickup_pincode" VARCHAR(6) NOT NULL,
    "pickup_country" VARCHAR(50) NOT NULL DEFAULT 'India',
    "delivery_name" VARCHAR(100) NOT NULL,
    "delivery_phone" VARCHAR(15) NOT NULL,
    "delivery_email" VARCHAR(255),
    "delivery_line1" VARCHAR(255) NOT NULL,
    "delivery_line2" VARCHAR(255),
    "delivery_landmark" VARCHAR(100),
    "delivery_city" VARCHAR(50) NOT NULL,
    "delivery_state" VARCHAR(50) NOT NULL,
    "delivery_pincode" VARCHAR(6) NOT NULL,
    "delivery_country" VARCHAR(50) NOT NULL DEFAULT 'India',
    "weight" DECIMAL(8,3) NOT NULL,
    "length" DECIMAL(8,2) NOT NULL,
    "width" DECIMAL(8,2) NOT NULL,
    "height" DECIMAL(8,2) NOT NULL,
    "description" VARCHAR(500),
    "value" DECIMAL(12,2),
    "fragile" BOOLEAN NOT NULL DEFAULT false,
    "service_type" "ServiceType" NOT NULL DEFAULT 'STANDARD',
    "special_instructions" VARCHAR(500),
    "partner_id" VARCHAR(50),
    "partner_name" VARCHAR(100),
    "awb_number" VARCHAR(50),
    "partner_shipment_id" VARCHAR(100),
    "wallet_transaction_id" VARCHAR(100),
    "payment_reference" VARCHAR(100),
    "refund_transaction_id" VARCHAR(100),
    "refund_amount" DECIMAL(10,2),
    "estimated_pickup" TIMESTAMP(3),
    "actual_pickup" TIMESTAMP(3),
    "estimated_delivery" TIMESTAMP(3),
    "actual_delivery" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pickup_schedule_id" UUID,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "location" VARCHAR(100),
    "event_data" JSONB,
    "source" VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "changes" JSONB,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "client_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cache" (
    "id" UUID NOT NULL,
    "cache_key" VARCHAR(255) NOT NULL,
    "from_pincode" VARCHAR(6) NOT NULL,
    "to_pincode" VARCHAR(6) NOT NULL,
    "weight" DECIMAL(8,3) NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "partner_id" VARCHAR(50),
    "rate_data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceability_cache" (
    "id" UUID NOT NULL,
    "cache_key" VARCHAR(255) NOT NULL,
    "from_pincode" VARCHAR(6) NOT NULL,
    "to_pincode" VARCHAR(6) NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "partner_id" VARCHAR(50),
    "serviceable" BOOLEAN NOT NULL,
    "response_data" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serviceability_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ndr_cases" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "status" "ndr_status" NOT NULL DEFAULT 'OPEN',
    "priority" "priority" NOT NULL DEFAULT 'MEDIUM',
    "delivery_attempt_date" TIMESTAMP(3) NOT NULL,
    "customer_feedback" TEXT,
    "delivery_person_notes" TEXT,
    "address_issue" BOOLEAN NOT NULL DEFAULT false,
    "customer_unavailable" BOOLEAN NOT NULL DEFAULT false,
    "reattempt_requested" BOOLEAN NOT NULL DEFAULT true,
    "reattempt_date" TIMESTAMP(3),
    "reattempt_notes" TEXT,
    "reattempt_scheduled_at" TIMESTAMP(3),
    "reattempt_scheduled_by_id" UUID,
    "preferred_reattempt_date" TIMESTAMP(3),
    "address_update_notes" TEXT,
    "address_updated_at" TIMESTAMP(3),
    "address_updated_by_id" UUID,
    "rto_initiated_at" TIMESTAMP(3),
    "rto_initiated_by_id" UUID,
    "rto_notes" TEXT,
    "assigned_to_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ndr_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_jobs" (
    "id" UUID NOT NULL,
    "type" "job_type" NOT NULL DEFAULT 'BULK_SHIPMENT',
    "status" "job_status" NOT NULL DEFAULT 'PENDING',
    "total_records" INTEGER NOT NULL,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "file_path" VARCHAR(500),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "processing_time_ms" INTEGER,
    "created_by_id" UUID NOT NULL,
    "client_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_schedules" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "user_id" UUID NOT NULL,
    "partner_id" VARCHAR(100) NOT NULL,
    "partner_name" VARCHAR(100) NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "time_slot" VARCHAR(20) NOT NULL,
    "status" "pickup_status" NOT NULL DEFAULT 'SCHEDULED',
    "pickup_name" VARCHAR(100) NOT NULL,
    "pickup_phone" VARCHAR(15) NOT NULL,
    "pickup_email" VARCHAR(255),
    "pickup_line1" VARCHAR(255) NOT NULL,
    "pickup_line2" VARCHAR(255),
    "pickup_landmark" VARCHAR(100),
    "pickup_city" VARCHAR(50) NOT NULL,
    "pickup_state" VARCHAR(50) NOT NULL,
    "pickup_pincode" VARCHAR(6) NOT NULL,
    "pickup_country" VARCHAR(50) NOT NULL DEFAULT 'India',
    "total_shipments" INTEGER NOT NULL DEFAULT 0,
    "total_weight" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "special_instructions" TEXT,
    "partner_request_id" VARCHAR(100),
    "partner_response" JSONB,
    "confirmation_code" VARCHAR(20),
    "picked_up_at" TIMESTAMP(3),
    "picked_up_by" VARCHAR(100),
    "actual_weight" DECIMAL(8,3),
    "actual_shipments" INTEGER,
    "pickup_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipments_client_id_status_created_at_idx" ON "shipments"("client_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "shipments_user_id_created_at_idx" ON "shipments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "shipments_order_id_client_id_idx" ON "shipments"("order_id", "client_id");

-- CreateIndex
CREATE INDEX "shipments_awb_number_idx" ON "shipments"("awb_number");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_partner_id_idx" ON "shipments"("partner_id");

-- CreateIndex
CREATE INDEX "shipments_pickup_schedule_id_idx" ON "shipments"("pickup_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_client_id_key" ON "shipments"("order_id", "client_id");

-- CreateIndex
CREATE INDEX "tracking_events_shipment_id_timestamp_idx" ON "tracking_events"("shipment_id", "timestamp");

-- CreateIndex
CREATE INDEX "tracking_events_status_idx" ON "tracking_events"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_client_id_idx" ON "audit_logs"("client_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cache_cache_key_key" ON "rate_cache"("cache_key");

-- CreateIndex
CREATE INDEX "rate_cache_cache_key_idx" ON "rate_cache"("cache_key");

-- CreateIndex
CREATE INDEX "rate_cache_from_pincode_to_pincode_idx" ON "rate_cache"("from_pincode", "to_pincode");

-- CreateIndex
CREATE INDEX "rate_cache_expires_at_idx" ON "rate_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "serviceability_cache_cache_key_key" ON "serviceability_cache"("cache_key");

-- CreateIndex
CREATE INDEX "serviceability_cache_cache_key_idx" ON "serviceability_cache"("cache_key");

-- CreateIndex
CREATE INDEX "serviceability_cache_from_pincode_to_pincode_idx" ON "serviceability_cache"("from_pincode", "to_pincode");

-- CreateIndex
CREATE INDEX "serviceability_cache_expires_at_idx" ON "serviceability_cache"("expires_at");

-- CreateIndex
CREATE INDEX "ndr_cases_shipment_id_idx" ON "ndr_cases"("shipment_id");

-- CreateIndex
CREATE INDEX "ndr_cases_status_priority_idx" ON "ndr_cases"("status", "priority");

-- CreateIndex
CREATE INDEX "ndr_cases_reason_idx" ON "ndr_cases"("reason");

-- CreateIndex
CREATE INDEX "ndr_cases_created_at_idx" ON "ndr_cases"("created_at");

-- CreateIndex
CREATE INDEX "ndr_cases_assigned_to_id_idx" ON "ndr_cases"("assigned_to_id");

-- CreateIndex
CREATE INDEX "bulk_jobs_created_by_id_type_idx" ON "bulk_jobs"("created_by_id", "type");

-- CreateIndex
CREATE INDEX "bulk_jobs_status_type_idx" ON "bulk_jobs"("status", "type");

-- CreateIndex
CREATE INDEX "bulk_jobs_created_at_idx" ON "bulk_jobs"("created_at");

-- CreateIndex
CREATE INDEX "bulk_jobs_client_id_idx" ON "bulk_jobs"("client_id");

-- CreateIndex
CREATE INDEX "pickup_schedules_scheduled_date_status_idx" ON "pickup_schedules"("scheduled_date", "status");

-- CreateIndex
CREATE INDEX "pickup_schedules_partner_id_idx" ON "pickup_schedules"("partner_id");

-- CreateIndex
CREATE INDEX "pickup_schedules_user_id_client_id_idx" ON "pickup_schedules"("user_id", "client_id");

-- CreateIndex
CREATE INDEX "pickup_schedules_status_idx" ON "pickup_schedules"("status");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pickup_schedule_id_fkey" FOREIGN KEY ("pickup_schedule_id") REFERENCES "pickup_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndr_cases" ADD CONSTRAINT "ndr_cases_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
