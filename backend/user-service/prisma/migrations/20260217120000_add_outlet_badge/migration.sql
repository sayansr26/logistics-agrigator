-- CreateEnum
CREATE TYPE "OutletBadge" AS ENUM ('BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- AlterTable
ALTER TABLE "outlets" ADD COLUMN "badge" "OutletBadge" NOT NULL DEFAULT 'BASIC';
