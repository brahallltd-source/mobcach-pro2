"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, MessageCircle, Minus, Plus, X } from "lucide-react";
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
  rechargeProofStatusLabelAr,
} from "@/lib/recharge-proof-lifecycle";

type MethodInstructions = {
  methodTitle: string;
  copyable: { key: string; label: string; value: string }[];
} | null;

type AgentPaymentProofRow = {
  id: string;
  amount: number;
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

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: RECHARGE_PROOF_STATUS.PROCESSING, label: "قيد المعالجة" },
  { key: RECHARGE_PROOF_STATUS.AGENT_APPROVED, label: "بانتظار اللاعب" },
  { key: RECHARGE_PROOF_STATUS.AGENT_REJECTED, label: "مرفوض" },
  { key: RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED, label: "مؤكد" },
  { key: RECHARGE_PROOF_STATUS.DISPUTED, label: "شكايات" },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case RECHARGE_PROOF_STATUS.PROCESSING:
    case RECHARGE_PROOF_STATUS.PENDING_PROOF:
      return "border-amber-400/40 bg-amber-500/15 text-amber-100";
    case RECHARGE_PROOF_STATUS.AGENT_APPROVED:
      return "border-cyan-400/40 bg-cyan-500/15 text-cyan-100";
    case RECHARGE_PROOF_STATUS.AGENT_REJECTED:
      return "border-rose-400/40 bg-rose-500/15 text-rose-100";
    case RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED:
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
    case RECHARGE_PROOF_STATUS.DISPUTED:
      return "border-red-500/50 bg-red-600/20 text-red-100";
    default:
      return "border-white/15 bg-white/10 text-white/70";
  }
}

function ExecutionCountdown({ deadlineMs }: { deadlineMs: number }) {
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
        انتهى مهلة التنفيذ — عند الموافقة قد يُطبَّق جزاء التأخير (مرة واحدة).
      </span>
    );
  }
  return (
    <span className="font-mono text-lg font-bold text-cyan-200 tabular-nums" dir="ltr">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function ProofImageZoom({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setScale((s) => Math.min(3, Math.max(1, Math.round((s + delta) * 100) / 100)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-white/45">معاينة الوصل (تكبير بالعجلة أو الأزرار)</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label="تصغير"
            onClick={() => setScale((s) => Math.max(1, Math.round((s - 0.15) * 100) / 100))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-white/50">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label="تكبير"
            onClick={() => setScale((s) => Math.min(3, Math.round((s + 0.15) * 100) / 100))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={wrapRef}
        className="max-h-[min(55vh,28rem)] overflow-auto rounded-2xl border border-white/10 bg-black/40"
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="mx-auto block max-w-none origin-top transition-transform duration-150 ease-out"
          style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
        />
      </div>
    </div>
  );
}

export function AgentTransactionsReviewExperience({
  layout = "page",
}: {
  /** `embedded` = render without `SidebarShell` / `PageHeader` (e.g. inside another agent page tab). */
  layout?: "page" | "embedded";
}) {
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/agent/transactions", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "تعذّر التحميل");
      }
      setItems(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

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
        throw new Error(data.message || "فشل التحديث");
      }
      await load();
      setSelected(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setActionBusy(false);
    }
  };

  const onApproveClick = (row: AgentPaymentProofRow) => {
    const amountRounded = Math.round(row.amount);
    const ok = window.confirm(`هل تأكدت من وصول المبلغ ${amountRounded} إلى حسابك؟`);
    if (!ok) return;
    void patchStatus(row, "approve");
  };

  const onRejectClick = (row: AgentPaymentProofRow) => {
    const r = rejectReason.trim();
    if (r.length < 5) {
      setActionError("سبب الرفض إلزامي (5 أحرف على الأقل).");
      return;
    }
    void patchStatus(row, "reject", r);
  };

  const rejectOk = rejectReason.trim().length >= 5;

  const countdownDeadline = useMemo(() => {
    if (!selected?.timerStartedAt) return null;
    const start = new Date(selected.timerStartedAt).getTime();
    if (!Number.isFinite(start)) return null;
    return start + selected.executionWindowMinutes * 60_000;
  }, [selected]);

  if (loading) {
    return wrap(<LoadingCard text="جاري تحميل الطلبات..." />);
  }

  return wrap(
    <>
      {!embedded ? (
        <PageHeader
          title="مراجعة إثباتات الدفع"
          subtitle="راجع الوصل، راقب العد التنازلي لزمن التنفيذ، ثم أكّد الشحن أو ارفض مع سبب واضح."
        />
      ) : null}

      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {error ? (
          <GlassCard className="border border-rose-500/25 p-4 text-sm text-rose-200">{error}</GlassCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
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

        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-start text-xs uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3 font-medium">معرّف اللاعب</th>
                  <th className="px-4 py-3 font-medium">المبلغ (MAD)</th>
                  <th className="px-4 py-3 font-medium">اسم المرسل</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-white/45">
                      لا توجد عمليات في هذا التبويب.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                      onClick={() => {
                        setSelected(row);
                        setRejectReason("");
                        setActionError(null);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-white/80" dir="ltr">
                          {row.playerUserId.slice(0, 8)}…
                        </div>
                        <div className="text-xs text-white/45">{row.playerUsername}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{Math.round(row.amount)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3">{row.senderName}</td>
                      <td className="px-4 py-3 text-white/55" dir="ltr">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                        >
                          {rechargeProofStatusLabelAr(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
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
                  مراجعة الطلب
                </h2>
                <p className="mt-0.5 break-all text-xs text-white/45" dir="ltr">
                  طلب إثبات: {selected.id}
                </p>
                <p className="mt-1 break-all text-xs text-white/35" dir="ltr">
                  معرّف اللاعب (User): {selected.playerUserId}
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
                  مراسلة اللاعب
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5"
                  aria-label="إغلاق"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selected.status === RECHARGE_PROOF_STATUS.PROCESSING && countdownDeadline ? (
                <GlassCard className="mb-4 border border-cyan-500/25 bg-cyan-500/10 p-4">
                  <p className="text-xs font-medium text-cyan-100/80">العد التنازلي لزمن التنفيذ</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <ExecutionCountdown deadlineMs={countdownDeadline} />
                    <span className="text-xs text-white/45">
                      مهلة {selected.executionWindowMinutes} دقيقة منذ رفع الإثبات
                    </span>
                  </div>
                  {selected.isLatePenaltyApplied ? (
                    <p className="mt-2 text-xs text-amber-200/90">تم تطبيق جزاء التأخير مسبقاً على هذا الطلب.</p>
                  ) : null}
                </GlassCard>
              ) : null}

              <ProofImageZoom src={selected.receiptUrl} alt="إثبات التحويل" />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <GlassCard className="p-4">
                  <h3 className="text-sm font-semibold text-cyan-200/90">ما أدخله اللاعب</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-white/40">الاسم الكامل</dt>
                      <dd className="mt-0.5 font-medium text-white">{selected.senderName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/40">الهاتف (إن وُجد)</dt>
                      <dd className="mt-0.5 font-mono text-white/90" dir="ltr">
                        {selected.senderPhone?.trim() || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/40">المبلغ</dt>
                      <dd className="mt-0.5 tabular-nums text-white">{Math.round(selected.amount)} MAD</dd>
                    </div>
                  </dl>
                </GlassCard>

                <GlassCard className="p-4">
                  <h3 className="text-sm font-semibold text-emerald-200/90">تعليمات وسيلة الدفع لديك</h3>
                  {selected.methodInstructions ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-white">{selected.methodInstructions.methodTitle}</p>
                      {selected.methodInstructions.copyable.length === 0 ? (
                        <p className="text-xs text-white/45">
                          لا توجد حقول تفصيلية محفوظة لهذه الوسيلة. راجع إعدادات الدفع إن لزم.
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
                      {selected.paymentMethodTitle || selected.paymentMethod || "وسيلة غير معروفة"}
                    </p>
                  )}
                </GlassCard>
              </div>

              {showChat ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <h3 className="mb-2 text-sm font-semibold text-white/80">محادثة مع اللاعب</h3>
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
                      سبب الرفض <span className="text-rose-300">(إلزامي عند الرفض)</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
                      placeholder="اشرح سبب الرفض بوضوح…"
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
                      رفض الطلب
                    </DangerButton>
                    <PrimaryButton
                      type="button"
                      className="order-1 flex w-full items-center justify-center gap-2 py-3 sm:order-2 sm:w-auto"
                      disabled={actionBusy}
                      onClick={() => onApproveClick(selected)}
                    >
                      {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      تأكيد الشحن
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/55">
                  {selected.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED && selected.agentRejectReason ? (
                    <p>
                      <span className="text-white/40">سبب الرفض: </span>
                      {selected.agentRejectReason}
                    </p>
                  ) : (
                    <p>تمت معالجة هذا الطلب أو هو خارج مرحلة المراجعة المباشرة.</p>
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
