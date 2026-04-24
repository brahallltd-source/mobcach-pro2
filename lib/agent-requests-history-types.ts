export type AgentRequestHistoryRow = {
  id: string;
  kind: "approved" | "rejected";
  playerLabel: string;
  decidedAt: string;
  status: "approved" | "rejected";
  rejectionReason: string | null;
};
