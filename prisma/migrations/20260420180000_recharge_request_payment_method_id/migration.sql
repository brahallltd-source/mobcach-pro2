-- AlterTable
ALTER TABLE "RechargeRequest" ADD COLUMN "paymentMethodId" TEXT;

-- CreateIndex
CREATE INDEX "RechargeRequest_paymentMethodId_idx" ON "RechargeRequest"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "RechargeRequest" ADD CONSTRAINT "RechargeRequest_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
