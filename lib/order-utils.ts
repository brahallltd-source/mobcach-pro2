export function getOrderStatusTone(status: string) {
  if (status === "pending") return "bg-amber-500/15 text-amber-300 border border-amber-400/20";
  if (status === "proof_uploaded") return "bg-sky-500/15 text-sky-300 border border-sky-400/20";
  if (status === "agent_approved_waiting_player") return "bg-cyan-500/15 text-cyan-300 border border-cyan-400/20";
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20";
  if (status === "flagged_for_review") return "bg-rose-500/15 text-rose-300 border border-rose-400/20";
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20";
  return "bg-white/10 text-white/70 border border-white/10";
}
