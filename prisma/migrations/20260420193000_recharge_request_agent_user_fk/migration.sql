-- Link RechargeRequest.agentId to User.id (submitting agent is always a user row).
ALTER TABLE "RechargeRequest"
ADD CONSTRAINT "RechargeRequest_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RechargeRequest_agentId_idx" ON "RechargeRequest"("agentId");
