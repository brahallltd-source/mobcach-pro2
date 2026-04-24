/**
 * Player ↔ agent recharge proof lifecycle (`PaymentProofTransaction.status`).
 * Stored as `String` in Prisma; use these constants everywhere.
 */
export const RECHARGE_PROOF_STATUS = {
  PENDING_PROOF: "PENDING_PROOF",
  PROCESSING: "PROCESSING",
  AGENT_APPROVED: "AGENT_APPROVED",
  AGENT_REJECTED: "AGENT_REJECTED",
  PLAYER_CONFIRMED: "PLAYER_CONFIRMED",
  DISPUTED: "DISPUTED",
} as const;

export type RechargeProofStatus = (typeof RECHARGE_PROOF_STATUS)[keyof typeof RECHARGE_PROOF_STATUS];

const LEGACY: Record<string, RechargeProofStatus> = {
  PENDING: RECHARGE_PROOF_STATUS.PROCESSING,
  APPROVED: RECHARGE_PROOF_STATUS.AGENT_APPROVED,
  REJECTED: RECHARGE_PROOF_STATUS.AGENT_REJECTED,
};

/** Normalize legacy enum strings after DB migrations. */
export function normalizeRechargeProofStatus(raw: string | null | undefined): RechargeProofStatus {
  const s = String(raw ?? "").trim();
  if (s in RECHARGE_PROOF_STATUS) {
    return s as RechargeProofStatus;
  }
  if (s in LEGACY) {
    return LEGACY[s]!;
  }
  return RECHARGE_PROOF_STATUS.PROCESSING;
}

export function rechargeProofStatusLabelAr(status: string): string {
  const n = normalizeRechargeProofStatus(status);
  switch (n) {
    case RECHARGE_PROOF_STATUS.PENDING_PROOF:
      return "بانتظار الإثبات";
    case RECHARGE_PROOF_STATUS.PROCESSING:
      return "قيد المعالجة (تم رفع الإثبات)";
    case RECHARGE_PROOF_STATUS.AGENT_APPROVED:
      return "وافق الوكيل — بانتظار تأكيدك";
    case RECHARGE_PROOF_STATUS.AGENT_REJECTED:
      return "مرفوض من الوكيل";
    case RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED:
      return "مكتمل (تأكيد اللاعب)";
    case RECHARGE_PROOF_STATUS.DISPUTED:
      return "شكاية — بانتظار الإدارة";
    default:
      return status;
  }
}

/** Minutes promised for agent action after proof timer starts. */
export function executionMinutesFromAgentSettings(
  executionTimeLabel: string | null | undefined,
  defaultExecutionTimeMinutes: number
): number {
  const fromLabel = String(executionTimeLabel ?? "").match(/^(\d+)/);
  if (fromLabel) {
    const n = parseInt(fromLabel[1]!, 10);
    if (Number.isFinite(n) && n > 0 && n <= 24 * 60) return n;
  }
  const d = Number(defaultExecutionTimeMinutes);
  if (Number.isFinite(d) && d > 0) return Math.round(d);
  return 30;
}
