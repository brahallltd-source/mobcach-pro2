"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Loader2, Receipt, Send, X } from "lucide-react";
import { toast } from "sonner";
import { PrimaryButton, TextField } from "@/components/ui";

export type ChatMessageRow = {
  id: string;
  transactionId: string;
  senderId: string;
  senderRole: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

export type ChatTransactionMeta = {
  id: string;
  status: string;
  amount: number;
  senderName: string;
  senderPhone: string | null;
  receiptUrl: string;
  paymentMethodTitle: string | null;
  paymentMethod?: string | null;
  agentRejectReason?: string | null;
  playerComment?: string | null;
  playerRating?: boolean | null;
  disputeMessage?: string | null;
  timerStartedAt?: string | null;
  isLatePenaltyApplied?: boolean;
  executionWindowMinutes?: number;
  createdAt: string;
};

const QUICK_REPLIES_AGENT = [
  "المرجو رفع صورة أوضح",
  "لم أتوصل بالمبلغ بعد",
  "تم تأكيد طلبك، شكراً لك",
] as const;

const CHAT_INPUT_ID = "mobcash-chatbox-input";

type ChatBoxProps = {
  transactionId: string;
  currentUserRole: "AGENT" | "PLAYER";
  /** Poll interval in ms (default 3000). */
  pollMs?: number;
  className?: string;
  /** Called after each successful poll with unread count (messages from others not yet read before this poll). */
  onUnreadChange?: (count: number) => void;
  /** Called with API `transaction` payload after each successful fetch. */
  onTransactionMeta?: (meta: ChatTransactionMeta) => void;
  /** Current message count after each successful fetch. */
  onMessageCount?: (n: number) => void;
  /** 403 / 404 when this user cannot access the transaction chat. */
  onAccessDenied?: () => void;
};

function formatBubbleTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function shortTxId(id: string): string {
  const s = String(id || "").replace(/-/g, "");
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : id;
}

export function ChatBox({
  transactionId,
  currentUserRole,
  pollMs = 3000,
  className = "",
  onUnreadChange,
  onTransactionMeta,
  onMessageCount,
  onAccessDenied,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [txMeta, setTxMeta] = useState<ChatTransactionMeta | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingPingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Avoid spamming toasts when polling returns 401. */
  const fetch401ToastRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const pingTyping = useCallback(async () => {
    try {
      await fetch(`/api/transactions/${encodeURIComponent(transactionId)}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: true }),
      });
    } catch {
      /* ignore */
    }
  }, [transactionId]);

  const fetchMessages = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}/chat`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: unknown;
        unreadCount?: unknown;
        peerTyping?: unknown;
        transaction?: unknown;
        message?: unknown;
        error?: unknown;
      };
      if (!res.ok) {
        if (res.status === 401) {
          if (!fetch401ToastRef.current) {
            fetch401ToastRef.current = true;
            toast.message("تعذّر التحقق من الجلسة للمحادثة. إن استمرّ الأمر، حدّث الصفحة.", {
              duration: 5000,
            });
          }
          return;
        }
        if (res.status === 403 || res.status === 404) {
          onAccessDenied?.();
          return;
        }
        setError(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "تعذّر تحميل الرسائل"
        );
        return;
      }
      fetch401ToastRef.current = false;
      const list = Array.isArray(data.messages) ? (data.messages as ChatMessageRow[]) : [];
      setMessages(list);
      onMessageCount?.(list.length);
      const unread = Number(data.unreadCount ?? 0);
      onUnreadChange?.(unread);
      if (data.transaction && typeof data.transaction === "object") {
        const meta = data.transaction as ChatTransactionMeta;
        setTxMeta(meta);
        onTransactionMeta?.(meta);
      }
      setPeerTyping(Boolean(data.peerTyping));
      requestAnimationFrame(() => scrollToBottom());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [transactionId, onUnreadChange, onTransactionMeta, onMessageCount, onAccessDenied, scrollToBottom]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchMessages(), pollMs);
    return () => window.clearInterval(id);
  }, [fetchMessages, pollMs]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerTyping, scrollToBottom]);

  useEffect(() => {
    const t = input.trim();
    if (typingPingRef.current) {
      clearTimeout(typingPingRef.current);
      typingPingRef.current = null;
    }
    if (!t || sending) return;
    typingPingRef.current = setTimeout(() => {
      typingPingRef.current = null;
      void pingTyping();
    }, 450);
    return () => {
      if (typingPingRef.current) clearTimeout(typingPingRef.current);
    };
  }, [input, sending, pingTyping]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: unknown;
        error?: unknown;
      };
      if (!res.ok) {
        if (res.status === 401) {
          toast.message("انتهت الجلسة أو غير صالحة. حدّث الصفحة ثم أعد المحاولة.");
          return;
        }
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "فشل الإرسال"
        );
      }
      const msg = data.message as ChatMessageRow | undefined;
      if (msg) {
        setMessages((prev) => {
          const next = [...prev, msg];
          onMessageCount?.(next.length);
          return next;
        });
      } else {
        await fetchMessages();
      }
      setInput("");
      requestAnimationFrame(() => scrollToBottom());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSending(false);
    }
  };

  const applyQuickReply = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      document.getElementById(CHAT_INPUT_ID)?.focus();
    });
  };

  const amountLabel =
    txMeta != null && Number.isFinite(txMeta.amount) ? `${Number(txMeta.amount).toLocaleString("fr-FR")} DH` : "—";

  return (
    <div
      className={`flex max-h-[min(520px,72vh)] min-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-glass ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sticky-style header (fixed stack above scroll area) */}
      <div className="shrink-0 border-b border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 gap-y-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">معرّف العملية</p>
            <p className="truncate font-mono text-xs text-cyan-100/90" dir="ltr" title={transactionId}>
              {shortTxId(transactionId)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">المبلغ</p>
            <p className="text-sm font-semibold tabular-nums text-white">{amountLabel}</p>
          </div>
          {txMeta?.receiptUrl ? (
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              <Receipt className="h-3.5 w-3.5" aria-hidden />
              عرض الإيصال
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 [dir:ltr]"
        aria-label="رسائل المحادثة"
      >
        {loading ? (
          <div className="flex justify-center py-10 text-white/45">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : (Array.isArray(messages) ? messages : []).length === 0 && !peerTyping ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50">
              <Send className="h-6 w-6 -rotate-45" aria-hidden />
            </div>
            <p className="max-w-xs text-sm font-medium text-white/70 [dir:rtl]">لا توجد رسائل</p>
            <p className="max-w-xs text-xs leading-relaxed text-white/45 [dir:rtl]">
              تواصل مع اللاعب لحل أي مشكلة بخصوص هذا الإيصال
            </p>
          </div>
        ) : (
          (Array.isArray(messages) ? messages : []).map((m) => {
            const fromPlayer = String(m.senderRole).toUpperCase() === "PLAYER";
            const mine = m.senderRole === currentUserRole;
            return (
              <div key={m.id} className={`flex w-full ${fromPlayer ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[min(85%,28rem)] shadow-sm ${
                    fromPlayer
                      ? "rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-white"
                      : "rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-[15px]">{m.content}</p>
                  <div
                    className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                      fromPlayer ? "text-white/70" : "text-white/45"
                    }`}
                  >
                    <span dir="ltr">{formatBubbleTime(m.createdAt)}</span>
                    {mine ? (
                      m.isRead ? (
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="مقروءة" />
                      ) : (
                        <Check className="h-3.5 w-3.5 shrink-0 opacity-70" aria-label="أُرسلت" />
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {peerTyping ? (
          <div className="flex w-full justify-start pt-1">
            <div
              className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/10 bg-muted px-3 py-2 text-muted-foreground shadow-sm"
              aria-live="polite"
            >
              <span className="text-xs font-medium text-white/55">يكتب</span>
              <span className="flex items-center gap-0.5 pt-0.5" aria-hidden>
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:0.15s]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} className="h-px w-full shrink-0 scroll-mt-2" aria-hidden />
      </div>

      {receiptOpen && txMeta?.receiptUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="عرض الإيصال"
          onClick={() => setReceiptOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-panel p-2 shadow-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute end-2 top-2 z-[1] rounded-full border border-white/15 bg-black/60 p-1.5 text-white/80 hover:bg-black/80"
              onClick={() => setReceiptOpen(false)}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={txMeta.receiptUrl}
              alt="إيصال الدفع"
              className="max-h-[min(80vh,720px)] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="shrink-0 border-t border-white/10 px-3 py-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {currentUserRole === "AGENT" ? (
        <div className="shrink-0 border-t border-white/10 bg-black/20 px-2 py-2">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-white/40">ردود سريعة</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_REPLIES_AGENT.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => applyQuickReply(q)}
                className="shrink-0 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 gap-2 border-t border-white/10 p-3">
        <TextField
          id={CHAT_INPUT_ID}
          className="min-w-0 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب رسالتك…"
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <PrimaryButton
          type="button"
          className="shrink-0 px-4 py-2.5"
          disabled={sending || !input.trim()}
          onClick={() => void send()}
          aria-label="إرسال"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </PrimaryButton>
      </div>

    </div>
  );
}
