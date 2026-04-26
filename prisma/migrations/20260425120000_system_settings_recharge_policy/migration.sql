-- Min recharge + affiliate merge toggle for agent treasury top-ups
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "minRechargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 1000;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "affiliateBonusEnabled" BOOLEAN NOT NULL DEFAULT true;
