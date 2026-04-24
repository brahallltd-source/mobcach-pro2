-- Treasury admin payment methods do not require an Agent row.
ALTER TABLE "PaymentMethod" DROP CONSTRAINT IF EXISTS "PaymentMethod_agentId_fkey";
ALTER TABLE "PaymentMethod" ALTER COLUMN "agentId" DROP NOT NULL;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
