"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  DangerButton,
  TextField,
} from "@/components/ui";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";
import type { MobcashUser } from "@/lib/mobcash-user-types";
import { ChatBox, type ChatTransactionMeta } from "@/components/ChatBox";
import {
  RECHARGE_PROOF_STATUS,
  rechargeProofStatusLabelAr,
} from "@/lib/recharge-proof-lifecycle";

const PRESET_COMMENTS = ["سريع جداً وموثوق", "تعامل راقي", "تأخر قليلاً لكن مضمون"] as const;

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

export default function PlayerTransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "").trim();

  const [ready, setReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [tx, setTx] = useState<ChatTransactionMeta | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [disputeText, setDisputeText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [preset, setPreset] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const onUnread = useCallback((n: number) => setUnread(n), []);
  const onMeta = useCallback((m: ChatTransactionMeta) => setTx(m), []);
  const onDenied = useCallback(() => setForbidden(true), []);

  useEffect(() => {
    void (async () => {
      let u = (await fetchSessionUser()) as MobcashUser | null;
      if (!u) {
        await new Promise((r) => setTimeout(r, 200));
        u = (await fetchSessionUser()) as MobcashUser | null;
      }
      if (!u || String(u.role).toLowerCase() !== "player") {
        redirectToLogin();
        return;
      }
      try {
        localStorage.setItem("mobcash_user", JSON.stringify(u));
      } catch {
        /* ignore quota / private mode */
      }
      setReady(true);
    })();
  }, []);

  const refetchMeta = useCallback(async () => {
    const res = await fetch(`/api/transactions/${encodeURIComponent(id)}/chat`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { transaction?: ChatTransactionMeta };
    if (data.transaction) onMeta(data.transaction);
  }, [id, onMeta]);

  const postAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/player/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل الطلب");
      await refetchMeta();
      return true;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "خطأ");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = () => void postAction({ action: "confirm" });

  const onDispute = async () => {
    const t = disputeText.trim();
    if (t.length < 10) {
      setErr("يرجى وصف المشكلة (10 أحرف على الأقل)");
      return;
    }
    const ok = await postAction({ action: "dispute", disputeMessage: t });
    if (ok) {
      setShowDispute(false);
      setDisputeText("");
    }
  };

  const onFeedback = async (rating: boolean) => {
    setFeedbackBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/player/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          playerRating: rating,
          playerComment: commentText.trim(),
          predefinedComment: preset,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التقييم");
      await refetchMeta();
      setPreset("");
      setCommentText("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setFeedbackBusy(false);
    }
  };

  if (!id) {
    return (
      <SidebarShell role="player">
        <PageHeader title="معرّف غير صالح" subtitle="رابط الطلب غير صحيح." />
      </SidebarShell>
    );
  }

  if (!ready) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  if (forbidden) {
    return (
      <SidebarShell role="player">
        <PageHeader title="غير متاح" subtitle="لا يمكنك عرض هذا الطلب." />
        <GlassCard className="mx-auto max-w-xl p-8 text-center">
          <Link href="/player/dashboard" className="text-cyan-300 underline-offset-2 hover:underline">
            العودة للوحة اللاعب
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  const st = tx?.status;
  const showChat =
    tx == null ||
    st === RECHARGE_PROOF_STATUS.PROCESSING ||
    st === RECHARGE_PROOF_STATUS.AGENT_APPROVED ||
    st === RECHARGE_PROOF_STATUS.DISPUTED ||
    st === RECHARGE_PROOF_STATUS.AGENT_REJECTED ||
    msgCount > 0;
  const prominent =
    Boolean(st === RECHARGE_PROOF_STATUS.PROCESSING && msgCount > 0) ||
    Boolean(st === RECHARGE_PROOF_STATUS.AGENT_APPROVED);

  return (
    <SidebarShell role="player">
      <PageHeader title="تفاصيل طلب الشحن" subtitle="تابع الحالة، راسل الوكيل، وأكّد استلام الرصيد أو افتح شكاية." />

      <div className="mx-auto flex max-w-xl flex-col gap-6">
        {err ? (
          <div role="alert">
            <GlassCard className="border border-rose-500/25 p-3 text-sm text-rose-200">{err}</GlassCard>
          </div>
        ) : null}

        {tx ? (
          <GlassCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/55">الحالة</p>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(tx.status)}`}
              >
                {rechargeProofStatusLabelAr(tx.status)}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">المبلغ</dt>
                <dd className="font-semibold tabular-nums">{Math.round(tx.amount)} MAD</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">الاسم المُرسل</dt>
                <dd className="text-end">{tx.senderName}</dd>
              </div>
              {(tx.paymentMethodTitle || tx.paymentMethod) ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-white/45">وسيلة الدفع</dt>
                  <dd className="text-end text-white/80">{tx.paymentMethodTitle || tx.paymentMethod}</dd>
                </div>
              ) : null}
            </dl>

            {tx.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED && tx.agentRejectReason ? (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-50">
                <p className="font-semibold text-rose-200">سبب رفض الوكيل</p>
                <p className="mt-2 leading-relaxed">{tx.agentRejectReason}</p>
              </div>
            ) : null}

            {tx.status === RECHARGE_PROOF_STATUS.AGENT_APPROVED ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
                <p className="text-sm text-white/70">هل وصلك الرصيد في حسابك داخل المنصّة؟</p>
                <PrimaryButton
                  type="button"
                  className="w-full py-3"
                  disabled={busy}
                  onClick={() => void onConfirm()}
                >
                  تم التوصل بالرصيد
                </PrimaryButton>
                <button
                  type="button"
                  className="w-full text-center text-sm font-semibold text-rose-300 underline-offset-2 hover:underline"
                  disabled={busy}
                  onClick={() => {
                    setShowDispute(true);
                    setErr(null);
                  }}
                >
                  لم أتوصل بالرصيد (شكاية للإدارة)
                </button>
                {showDispute ? (
                  <GlassCard className="border border-amber-500/25 bg-amber-500/5 p-4">
                    <p className="text-xs font-medium text-amber-100/90">صف المشكلة — سيتم إرسالها للإدارة</p>
                    <textarea
                      value={disputeText}
                      onChange={(e) => setDisputeText(e.target.value)}
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="اشرح المشكلة بالتفصيل…"
                    />
                    <DangerButton
                      type="button"
                      className="mt-3 w-full py-2.5"
                      disabled={busy}
                      onClick={() => void onDispute()}
                    >
                      إرسال الشكاية
                    </DangerButton>
                  </GlassCard>
                ) : null}
              </div>
            ) : null}

            {tx.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED && tx.playerRating == null ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-white/80">تقييم سريع للوكيل</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={feedbackBusy}
                    onClick={() => void onFeedback(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 py-3 text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-5 w-5" />
                    إعجاب
                  </button>
                  <button
                    type="button"
                    disabled={feedbackBusy}
                    onClick={() => void onFeedback(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/15 py-3 text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    <ThumbsDown className="h-5 w-5" />
                    لم يعجبني
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COMMENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPreset((p) => (p === c ? "" : c))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        preset === c
                          ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-50"
                          : "border-white/15 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <TextField
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="تعليق إضافي (اختياري)"
                />
              </div>
            ) : null}

            {tx.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED && tx.playerRating != null ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <p>شكراً لتقييمك{tx.playerComment ? ` — ${tx.playerComment}` : ""}.</p>
              </div>
            ) : null}

            {tx.status === RECHARGE_PROOF_STATUS.DISPUTED ? (
              <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100/90">
                <p className="font-semibold">تم تسجيل شكايتك</p>
                <p className="mt-1 text-xs text-red-200/80">فريق الإدارة سيراجع الطلب.</p>
              </div>
            ) : null}
          </GlassCard>
        ) : null}

        {showChat ? (
          <GlassCard
            className={`p-5 ${prominent ? "ring-2 ring-cyan-400/35 ring-offset-2 ring-offset-[#070a10]" : ""}`}
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">المحادثة مع الوكيل</h2>
              {unread > 0 ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
                  title="رسائل غير مقروءة"
                  aria-label="رسائل غير مقروءة"
                />
              ) : null}
            </div>
            <p className="mb-3 text-xs text-white/45">
              تُحدَّث الرسائل تلقائياً كل بضع ثوانٍ.
            </p>
            <ChatBox
              transactionId={id}
              currentUserRole="PLAYER"
              pollMs={3000}
              onUnreadChange={onUnread}
              onTransactionMeta={onMeta}
              onMessageCount={setMsgCount}
              onAccessDenied={onDenied}
            />
          </GlassCard>
        ) : (
          <GlassCard className="p-6 text-center text-sm text-white/50">
            لا تتوفر محادثة لهذا الطلب في هذه الحالة.
          </GlassCard>
        )}

        <div className="text-center">
          <Link href="/player/dashboard" className="text-sm text-cyan-300 underline-offset-2 hover:underline">
            العودة للوحة اللاعب
          </Link>
        </div>
      </div>
    </SidebarShell>
  );
}
