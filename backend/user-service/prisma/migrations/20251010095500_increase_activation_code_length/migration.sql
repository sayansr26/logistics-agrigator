-- AlterTable: Increase activation_code column length from 255 to 1000 characters
-- Reason: License keys are JWT-style tokens that can be 500-800 characters long

ALTER TABLE "clients" ALTER COLUMN "activation_code" TYPE VARCHAR(1000);
