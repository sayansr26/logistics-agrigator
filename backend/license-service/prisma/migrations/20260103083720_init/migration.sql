-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'COMMISSION_BASED', 'PAY_AS_YOU_GO');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'LIFETIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'UPI', 'PAYPAL', 'RAZORPAY', 'STRIPE', 'CRYPTO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('ACTIVATION', 'DEACTIVATION', 'HEARTBEAT', 'API_CALL', 'SERVICE_START', 'SERVICE_STOP', 'LICENSE_CHECK', 'ERROR');

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "LicenseType" NOT NULL DEFAULT 'STANDARD',
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'MONTHLY',
    "status" "LicenseStatus" NOT NULL DEFAULT 'INACTIVE',
    "allowed_services" TEXT[],
    "max_activations" INTEGER NOT NULL DEFAULT 1,
    "current_activations" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "allowed_ips" TEXT[],
    "allowed_machine_ids" TEXT[],
    "metadata" JSONB,
    "features" JSONB,
    "limits" JSONB,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "last_billed_at" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "commission_rate" REAL,
    "signature" TEXT NOT NULL,
    "encrypted_config" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_activations" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "machine_id" VARCHAR(255) NOT NULL,
    "server_ip" INET NOT NULL,
    "hostname" VARCHAR(255),
    "status" "ActivationStatus" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),
    "node_version" VARCHAR(50),
    "docker_version" VARCHAR(50),
    "os_info" JSONB,
    "deployed_services" TEXT[],
    "last_heartbeat_at" TIMESTAMP(3),
    "missed_heartbeats" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_subscriptions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "license_id" UUID,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "is_commission_based" BOOLEAN NOT NULL DEFAULT false,
    "commission_rate" REAL,
    "commission_earned" DECIMAL(10,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "trial_start_date" TIMESTAMP(3),
    "trial_end_date" TIMESTAMP(3),
    "is_trial_used" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "client_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethod" NOT NULL,
    "transaction_id" VARCHAR(255),
    "gateway_response" JSONB,
    "commission_amount" DECIMAL(10,2),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "pdf_url" VARCHAR(500),
    "line_items" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_usage_logs" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "event_type" "UsageEventType" NOT NULL,
    "service_name" VARCHAR(100),
    "metrics_data" JSONB NOT NULL,
    "ip_address" INET,
    "machine_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "license_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "changes" JSONB,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" VARCHAR(100),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_key_key" ON "licenses"("key");

-- CreateIndex
CREATE INDEX "licenses_client_id_idx" ON "licenses"("client_id");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE INDEX "licenses_valid_until_idx" ON "licenses"("valid_until");

-- CreateIndex
CREATE INDEX "licenses_type_idx" ON "licenses"("type");

-- CreateIndex
CREATE INDEX "license_activations_server_ip_idx" ON "license_activations"("server_ip");

-- CreateIndex
CREATE INDEX "license_activations_status_idx" ON "license_activations"("status");

-- CreateIndex
CREATE INDEX "license_activations_last_seen_at_idx" ON "license_activations"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "license_activations_license_id_machine_id_key" ON "license_activations"("license_id", "machine_id");

-- CreateIndex
CREATE INDEX "client_subscriptions_client_id_idx" ON "client_subscriptions"("client_id");

-- CreateIndex
CREATE INDEX "client_subscriptions_status_idx" ON "client_subscriptions"("status");

-- CreateIndex
CREATE INDEX "client_subscriptions_next_billing_date_idx" ON "client_subscriptions"("next_billing_date");

-- CreateIndex
CREATE INDEX "payment_history_subscription_id_idx" ON "payment_history"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_history_status_idx" ON "payment_history"("status");

-- CreateIndex
CREATE INDEX "payment_history_created_at_idx" ON "payment_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE INDEX "license_usage_logs_license_id_idx" ON "license_usage_logs"("license_id");

-- CreateIndex
CREATE INDEX "license_usage_logs_event_type_idx" ON "license_usage_logs"("event_type");

-- CreateIndex
CREATE INDEX "license_usage_logs_created_at_idx" ON "license_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_license_id_idx" ON "audit_logs"("license_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "client_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "client_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_usage_logs" ADD CONSTRAINT "license_usage_logs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
