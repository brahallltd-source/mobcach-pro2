"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, Loader2, MessageCircle, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  DangerButton,
} from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { ChatBox } from "@/components/ChatBox";
import {
  RECHARGE_PROOF_STATUS,
  normalizeRechargeProofStatus,
} from "@/lib/recharge-proof-lifecycle";
import { GS365_GLOW, gs365StatusBadgeClass } from "@/lib/ui/gs365-glow";
import { useTranslation } from "@/lib/i18n";

type MethodInstructions = {
  methodTitle: string;
  copyable: { key: string; label: string; value: string }[];
} | null;

type AgentPaymentProofRow = {
  id: string;
  amount: number;
  gosportUsername: string;
  senderName: string;
  senderPhone: string | null;
  status: string;
  receiptUrl: string;
  agentRejectReason: string | null;
  paymentMethodId: string | null;
  paymentMethodTitle: string | null;
  paymentMethod: string | null;
  createdAt: string;
  playerUserId: string;
  playerUsername: string;
  playerEmail: string;
  methodInstructions: MethodInstructions;
  timerStartedAt: string | null;
  isLatePenaltyApplied: boolean;
  executionWindowMinutes: number;
};

type FilterTab =
  | "all"
  | typeof RECHARGE_PROOF_STATUS.PROCESSING
  | typeof RECHARGE_PROOF_STATUS.AGENT_APPROVED
  | typeof RECHARGE_PROOF_STATUS.AGENT_REJECTED
  | typeof RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED
  | typeof RECHARGE_PROOF_STATUS.DISPUTED;

function statusBadgeClass(status: string) {
  return gs365StatusBadgeClass(status);
}

function statusAccentClass(status: string) {
  const normalized = normalizeRechargeProofStatus(status);
  if (normalized === RECHARGE_PROOF_STATUS.PROCESSING) {
    return "border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.22)]";
  }
  if (normalized === RECHARGE_PROOF_STATUS.DISPUTED) {
    return "border-amber-200/45 bg-amber-300/10 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.18)]";
  }
  return "";
}

function statusLabel(tx: (path: string, vars?: Record<string, string>) => string, status: string) {
  const normalized = normalizeRechargeProofStatus(status);
  switch (normalized) {
    case RECHARGE_PROOF_STATUS.PROCESSING:
      return tx("agent.transactionsReview.tabsProcessing");
    case RECHARGE_PROOF_STATUS.AGENT_APPROVED:
      return tx("agent.transactionsReview.tabsWaitingPlayer");
    case RECHARGE_PROOF_STATUS.AGENT_REJECTED:
      return tx("agent.transactionsReview.tabsRejected");
    case RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED:
      return tx("agent.transactionsReview.tabsConfirmed");
    case RECHARGE_PROOF_STATUS.DISPUTED:
      return tx("agent.transactionsReview.tabsDisputed");
    default:
      return status;
  }
}

function ExecutionCountdown({
  deadlineMs,
  tx,
}: {
  deadlineMs: number;
  tx: (path: string, vars?: Record<string, string>) => string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [deadlineMs]);
  const leftSec = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  const m = Math.floor(leftSec / 60);
  const s = leftSec % 60;
  if (deadlineMs <= now) {
    return (
      <span className="text-sm font-semibold text-rose-300">
        {tx("agent.transactionsReview.countdownExpired")}
      </span>
    );
  }
  return (
    <span className="font-mono text-lg font-bold text-cyan-200 tabular-nums" dir="ltr">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function ProofImageZoom({
  src,
  alt,
  tx,
}: {
  src: string;
  alt: string;
  tx: (path: string, vars?: Record<string, string>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-white/45">{tx("agent.transactionsReview.previewHelp")}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label={tx("agent.transactionsReview.zoomOutAria")}
            onClick={() => setExpanded(true)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-white/50">100%</span>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label={tx("agent.transactionsReview.zoomInAria")}
            onClick={() => setExpanded(true)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={wrapRef}
        role="button"
        tabIndex={0}
        className="relative h-[min(55vh,28rem)] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50"
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(true);
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          style={{ touchAction: "auto" }}
        />
      </div>
      {expanded ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setExpanded(false)}
        >
          <div className="relative h-full w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-contain"
              style={{ touchAction: "auto" }}
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label={tx("agent.transactionsReview.closeAria")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AgentTransactionsReviewExperience({
  layout = "page",
}: {
  /** `embedded` = render without `SidebarShell` / `PageHeader` (e.g. inside another agent page tab). */
  layout?: "page" | "embedded";
}) {
  const { tx } = useTranslation();
  const embedded = layout === "embedded";
  const wrap = (children: ReactNode) =>
    embedded ? <div className="space-y-4">{children}</div> : <SidebarShell role="agent">{children}</SidebarShell>;

  const [items, setItems] = useState<AgentPaymentProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<AgentPaymentProofRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const tabs = useMemo<{ key: FilterTab; label: string }[]>(
    () => [
      { key: "all", label: tx("agent.transactionsReview.tabsAll") },
      { key: RECHARGE_PROOF_STATUS.PROCESSING, label: tx("agent.transactionsReview.tabsProcessing") },
      { key: RECHARGE_PROOF_STATUS.AGENT_APPROVED, label: tx("agent.transactionsReview.tabsWaitingPlayer") },
      { key: RECHARGE_PROOF_STATUS.AGENT_REJECTED, label: tx("agent.transactionsReview.tabsRejected") },
      { key: RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED, label: tx("agent.transactionsReview.tabsConfirmed") },
      { key: RECHARGE_PROOF_STATUS.DISPUTED, label: tx("agent.transactionsReview.tabsDisputed") },
    ],
    [tx],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/agent/transactions", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || tx("agent.transactionsReview.loadError"));
      }
      setItems(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tx("agent.transactionsReview.genericError"));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setRejectReason("");
      setActionError(null);
      setShowChat(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((r) => r.status === tab);
  }, [items, tab]);

  const patchStatus = async (row: AgentPaymentProofRow, action: "approve" | "reject", reason?: string) => {
    setActionBusy(true);
    setActionError(null);
    try {
      const endpoint = action === "approve" ? "/api/agent/approve-order" : "/api/agent/reject-order";
      const payload =
        action === "approve"
          ? { orderId: row.id }
          : { orderId: row.id, reason: String(reason || "").trim() };
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || tx("agent.transactionsReview.updateFailed"));
      }
      await load();
      setSelected(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : tx("agent.transactionsReview.genericError"));
    } finally {
      setActionBusy(false);
    }
  };

  const onApproveClick = (row: AgentPaymentProofRow) => {
    const amountRounded = Math.round(row.amount);
    const ok = window.confirm(
      tx("agent.transactionsReview.confirmApprovePrompt", { amount: String(amountRounded) }),
    );
    if (!ok) return;
    void patchStatus(row, "approve");
  };

  const onRejectClick = (row: AgentPaymentProofRow) => {
    const r = rejectReason.trim();
    if (r.length < 5) {
      setActionError(tx("agent.transactionsReview.rejectReasonRequired"));
      return;
    }
    void patchStatus(row, "reject", r);
  };

  const onCopyGosportUsername = useCallback(async (raw: string) => {
    const value = String(raw || "").trim();
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const rejectOk = rejectReason.trim().length >= 5;

  const countdownDeadline = useMemo(() => {
    if (!selected?.timerStartedAt) return null;
    const start = new Date(selected.timerStartedAt).getTime();
    if (!Number.isFinite(start)) return null;
    return start + selected.executionWindowMinutes * 60_000;
  }, [selected]);

  if (loading) {
    return wrap(<LoadingCard text={tx("agent.transactionsReview.loading")} />);
  }

  return wrap(
    <>
      {!embedded ? (
        <PageHeader
          title={tx("agent.transactionsReview.pageTitle")}
          subtitle={tx("agent.transactionsReview.pageSubtitle")}
        />
      ) : null}

      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {error ? (
          <GlassCard className="border border-rose-500/25 p-4 text-sm text-rose-200">{error}</GlassCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const on = tab === t.key;
            const count =
              t.key === "all"
                ? items.length
                : items.filter((i) => i.status === t.key).length;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  on
                    ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20"
                }`}
              >
                {t.label}
                <span className="ms-1 text-white/40">({count})</span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <GlassCard className="border border-white/10 p-10 text-center text-white/45">
            {tx("agent.transactionsReview.emptyTab")}
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => {
              const headline = String(row.playerUsername || row.senderName || "—").trim() || "—";
              const paymentMethod = String(
                row.paymentMethodTitle || row.paymentMethod || tx("agent.transactionsReview.unknownMethod")
              ).trim();
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={`group relative cursor-pointer rounded-2xl pt-3 ${GS365_GLOW.cardShellInteractive}`}
                  onClick={() => {
                    setSelected(row);
                    setRejectReason("");
                    setActionError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(row);
                      setRejectReason("");
                      setActionError(null);
                    }
                  }}
                >
                  <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${statusBadgeClass(row.status)} ${statusAccentClass(row.status)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                      {statusLabel(tx, row.status)}
                    </span>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 pt-2">
                        <p className="truncate text-base font-bold text-white">{headline}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{paymentMethod}</p>
                        <p className="mt-1 text-xs text-slate-400" dir="ltr">
                          {new Date(row.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end pt-2">
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                          {tx("agent.transactionsReview.requestedAmount")}
                        </p>
                      <p
                        className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent drop-shadow-[0_0_14px_rgba(34,211,238,0.38)] md:text-7xl"
                        dir="ltr"
                      >
                          {Math.round(row.amount)} DH
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-cyan-300/45 bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 px-3 text-sm font-semibold text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.28)] transition hover:brightness-110 hover:shadow-[0_0_18px_rgba(16,185,129,0.42)]"
                    >
                      {tx("agent.transactionsReview.viewDetails")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            className="flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c1018] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h2 id="proof-dialog-title" className="text-lg font-bold text-white">
                  {tx("agent.transactionsReview.dialogTitle")}
                </h2>
                <p className="mt-0.5 break-all text-xs text-white/45" dir="ltr">
                  {tx("agent.transactionsReview.proofRequestLabel")} {selected.id}
                </p>
                <p className="mt-1 break-all text-xs text-white/35" dir="ltr">
                  {tx("agent.transactionsReview.playerIdLabel")} {selected.playerUserId}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChat((v) => !v);
                  }}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {tx("agent.transactionsReview.messagePlayer")}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5"
                  aria-label={tx("agent.transactionsReview.closeAria")}
                  onClick={() => setSelected(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selected.status === RECHARGE_PROOF_STATUS.PROCESSING && countdownDeadline ? (
                <GlassCard className="mb-4 border border-cyan-500/25 bg-cyan-500/10 p-4">
                  <p className="text-xs font-medium text-cyan-100/80">{tx("agent.transactionsReview.countdownTitle")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <ExecutionCountdown deadlineMs={countdownDeadline} tx={tx} />
                    <span className="text-xs text-white/45">
                      {tx("agent.transactionsReview.deadlineMinutes", {
                        minutes: String(selected.executionWindowMinutes),
                      })}
                    </span>
                  </div>
                  {selected.isLatePenaltyApplied ? (
                    <p className="mt-2 text-xs text-amber-200/90">{tx("agent.transactionsReview.latePenaltyApplied")}</p>
                  ) : null}
                </GlassCard>
              ) : null}

              <ProofImageZoom
                src={selected.receiptUrl}
                alt={tx("agent.transactionsReview.proofAlt")}
                tx={tx}
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <GlassCard className="p-4">
                  <h3 className="text-sm font-semibold text-cyan-200/90">{tx("agent.transactionsReview.playerInputTitle")}</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-white/40">{tx("agent.transactionsReview.fullNameLabel")}</dt>
                      <dd className="mt-0.5 font-medium text-white">{selected.senderName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/40">{tx("agent.transactionsReview.phoneOptionalLabel")}</dt>
                      <dd className="mt-0.5 font-mono text-white/90" dir="ltr">
                        {selected.senderPhone?.trim() || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/40">{tx("agent.transactionsReview.amountLabel")}</dt>
                      <dd className="mt-0.5 tabular-nums text-white">{Math.round(selected.amount)} MAD</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/40">اسم مستخدم GoSport365</dt>
                      <dd className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono font-medium text-white" dir="ltr">
                          {String(selected.gosportUsername || "—").trim() || "—"}
                        </span>
                        {String(selected.gosportUsername || "").trim() ? (
                          <button
                            type="button"
                            onClick={() => void onCopyGosportUsername(selected.gosportUsername)}
                            className="inline-flex rounded-md border border-white/10 bg-white/5 p-1.5 text-white/60 transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                            aria-label="Copy GoSport365 username"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </GlassCard>

                <GlassCard className="p-4">
                  <h3 className="text-sm font-semibold text-emerald-200/90">{tx("agent.transactionsReview.paymentInstructionsTitle")}</h3>
                  {selected.methodInstructions ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-white">{selected.methodInstructions.methodTitle}</p>
                      {selected.methodInstructions.copyable.length === 0 ? (
                        <p className="text-xs text-white/45">
                          {tx("agent.transactionsReview.noDetailedFields")}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {selected.methodInstructions.copyable.map((c) => (
                            <li key={c.key} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                              <p className="text-[11px] font-medium text-white/45">{c.label}</p>
                              <p className="mt-0.5 break-all font-mono text-sm text-white" dir="auto">
                                {c.value || "—"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/50">
                      {selected.paymentMethodTitle || selected.paymentMethod || tx("agent.transactionsReview.unknownMethodFallback")}
                    </p>
                  )}
                </GlassCard>
              </div>

              {showChat ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <h3 className="mb-2 text-sm font-semibold text-white/80">{tx("agent.transactionsReview.chatTitle")}</h3>
                  <ChatBox
                    transactionId={selected.id}
                    currentUserRole="AGENT"
                    pollMs={3000}
                    className="border-cyan-500/20"
                  />
                </div>
              ) : null}

              {selected.status === RECHARGE_PROOF_STATUS.PROCESSING ? (
                <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
                  {actionError ? (
                    <p className="text-sm text-rose-300" role="alert">
                      {actionError}
                    </p>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/45">
                      {tx("agent.transactionsReview.rejectReasonLabel")}{" "}
                      <span className="text-rose-300">{tx("agent.transactionsReview.rejectRequiredNote")}</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder={tx("agent.transactionsReview.rejectPlaceholder")}
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <DangerButton
                      type="button"
                      className="order-2 flex w-full items-center justify-center gap-2 py-3 sm:order-1 sm:w-auto"
                      disabled={actionBusy || !rejectOk}
                      onClick={() => onRejectClick(selected)}
                    >
                      {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {tx("agent.transactionsReview.rejectAction")}
                    </DangerButton>
                    <PrimaryButton
                      type="button"
                      className="order-1 flex w-full items-center justify-center gap-2 py-3 sm:order-2 sm:w-auto"
                      disabled={actionBusy}
                      onClick={() => onApproveClick(selected)}
                    >
                      {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {tx("agent.transactionsReview.approveAction")}
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/55">
                  {selected.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED && selected.agentRejectReason ? (
                    <p>
                      <span className="text-white/40">{tx("agent.transactionsReview.rejectReasonDisplay")} </span>
                      {selected.agentRejectReason}
                    </p>
                  ) : (
                    <p>{tx("agent.transactionsReview.processedOutsideReview")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
