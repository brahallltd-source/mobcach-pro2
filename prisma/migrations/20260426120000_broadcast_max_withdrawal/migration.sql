-- Global admin broadcast (player + agent banner) and platform max withdrawal per request
CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Broadcast_isActive_createdAt_idx" ON "Broadcast"("isActive", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Broadcast_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Broadcast"
      ADD CONSTRAINT "Broadcast_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "maxWithdrawalAmount" DOUBLE PRECISION NOT NULL DEFAULT 100000;
