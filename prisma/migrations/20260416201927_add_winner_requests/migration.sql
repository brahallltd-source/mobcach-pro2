-- CreateTable
CREATE TABLE "WinnerRequest" (
    "id" TEXT NOT NULL,
    "playerEmail" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WinnerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WinnerRequest_agentId_idx" ON "WinnerRequest"("agentId");

-- CreateIndex
CREATE INDEX "WinnerRequest_playerEmail_idx" ON "WinnerRequest"("playerEmail");
