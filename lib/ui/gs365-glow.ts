/** Shared GS365 "premium glowing dark" UI tokens. */
export const GS365_GLOW = {
  cardShell:
    "relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] via-emerald-950/40 to-slate-950/90 p-[1px] shadow-[0_0_48px_-12px_rgba(16,185,129,0.45)] backdrop-blur-xl",
  cardShellInteractive:
    "transition hover:shadow-[0_0_56px_-10px_rgba(16,185,129,0.52)]",
  cardInner: "rounded-2xl bg-slate-950/55 px-4 py-4 sm:px-5 sm:py-5",
  amountPanel: "mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.08] p-4",
  amountValue:
    "mt-1 bg-gradient-to-r from-emerald-300 via-amber-200 to-teal-300 bg-clip-text text-2xl font-extrabold tabular-nums text-transparent drop-shadow-[0_0_22px_rgba(52,211,153,0.55)]",
  ctaButton:
    "rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-100 transition hover:bg-emerald-500/20",
} as const;

/** Unified status badge tones for player + agent surfaces. */
export const GS365_STATUS_BADGE: Record<string, string> = {
  pending: "border-amber-400/35 bg-amber-500/12 text-amber-100/95 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
  pending_payment:
    "border-amber-400/35 bg-amber-500/12 text-amber-100/95 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
  proof_uploaded:
    "border-cyan-400/35 bg-cyan-500/12 text-cyan-100/95 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
  agent_approved_waiting_player:
    "border-cyan-400/35 bg-cyan-500/12 text-cyan-100/95 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
  completed:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/95 shadow-[0_0_18px_rgba(16,185,129,0.2)]",
  resolved:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/95 shadow-[0_0_18px_rgba(16,185,129,0.2)]",
  flagged_for_review:
    "border-rose-400/35 bg-rose-500/12 text-rose-100/95 shadow-[0_0_18px_rgba(251,113,133,0.18)]",
  cancelled:
    "border-red-500/45 bg-red-600/15 text-red-100/95 shadow-[0_0_18px_rgba(239,68,68,0.18)]",
  disputed:
    "border-red-500/45 bg-red-600/15 text-red-100/95 shadow-[0_0_18px_rgba(239,68,68,0.18)]",
  processing:
    "border-amber-400/35 bg-amber-500/12 text-amber-100/95 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
  pending_proof:
    "border-amber-400/35 bg-amber-500/12 text-amber-100/95 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
  agent_approved:
    "border-cyan-400/35 bg-cyan-500/12 text-cyan-100/95 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
  agent_rejected:
    "border-rose-400/35 bg-rose-500/12 text-rose-100/95 shadow-[0_0_18px_rgba(251,113,133,0.18)]",
  player_confirmed:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/95 shadow-[0_0_18px_rgba(16,185,129,0.2)]",
};

export function gs365StatusBadgeClass(status: string): string {
  const key = String(status ?? "").trim().toLowerCase();
  return GS365_STATUS_BADGE[key] ?? "border-white/20 bg-white/[0.06] text-white/75";
}
