"use client";

import { clsx } from "clsx";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { FlagBadges } from "@/components/FlagBadges";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { formatCurrencyDhEn } from "@/lib/format-dh";

/** One row from `GET /api/admin/recharge-requests` (Prisma `RechargeRequest` + safe `User` / `PaymentMethod` picks). */
export type RechargeRequestRow = {
  id: string;
  agentEmail: string;
  amount: number;
  bonus10Percent: number;
  totalWithBonusApprox: number;
  methodDisplayName: string;
  paymentMethod?: {
    id: string;
    methodName: string;
    type: string;
    currency: string;
    accountName: string | null;
    rib: string | null;
  } | null;
  proofUrl: string | null;
  note: string | null;
  status: string;
  flags?: string[];
  createdAt: string;
  /** Player GoSport365 account for this recharge (may be null on older rows stored only in `note`). */
  gosport365Username?: string | null;
  agent: {
    username: string;
    email: string;
  } | null;
};

/** Prefer DB column; legacy requests may store username only inside `note` as `[gosportUsername:…]`. */
function gosport365Display(r: RechargeRequestRow): string {
  const direct = String(r.gosport365Username ?? "").trim();
  if (direct) return direct;
  const m = String(r.note ?? "").match(/\[gosportUsername:([^\]]+)\]/);
  return String(m?.[1] ?? "").trim();
}

/** Copy only when the API field is set (not `note` fallback), per product rules. */
function canCopyGosport365Username(r: RechargeRequestRow): boolean {
  const raw = String(r.gosport365Username ?? "").trim();
  return raw.length > 0 && raw !== "-";
}

function bankDisplayName(r: RechargeRequestRow): string {
  return (
    r.paymentMethod?.methodName?.trim() ||
    r.paymentMethod?.accountName?.trim() ||
    r.methodDisplayName ||
    "—"
  );
}

function normStatus(s: string) {
  return String(s ?? "").trim().toUpperCase();
}

function statusBadgeClass(status: string) {
  const u = normStatus(status);
  if (u === "APPROVED") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (u === "REJECTED") return "bg-rose-500/20 text-rose-300 border-rose-500/30";
  return "bg-amber-500/20 text-amber-200 border-amber-500/30";
}

function statusLabelAr(status: string) {
  const u = normStatus(status);
  if (u === "APPROVED") return "موافقة";
  if (u === "REJECTED") return "مرفوض";
  return "قيد الانتظار";
}

function formatRequestDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-MA-u-ca-gregory", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function proofLooksLikeImage(url: string) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|avif)$/i.test(p);
  } catch {
    return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url);
  }
}

export function RechargeRequestsManagement({
  pageTitle = "Recharge Requests",
  pageSubtitle = "مراجعة إثبات التحويل والموافقة أو الرفض.",
}: {
  pageTitle?: string;
  pageSubtitle?: string;
}) {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<RechargeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (text: string, requestId: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed === "-") return;
      try {
        await navigator.clipboard.writeText(trimmed);
        showToast({ type: "success", title: "تم نسخ اسم الحساب بنجاح" });
        setCopiedRequestId(requestId);
        window.setTimeout(() => {
          setCopiedRequestId((cur) => (cur === requestId ? null : cur));
        }, 2000);
      } catch {
        showToast({ type: "error", title: "تعذر نسخ النص" });
      }
    },
    [showToast]
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/recharge-requests", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({
        type: "error",
        title: String(data.message || "تعذر تحميل الطلبات"),
      });
      setRequests([]);
      return;
    }
    setRequests(data.requests || []);
  }, [showToast]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const runAction = async (id: string, action: "approve" | "reject") => {
    if (action === "reject") {
      const ok = window.confirm("هل أنت متأكد من رفض هذا الطلب؟");
      if (!ok) return;
    }
    setBusy({ id, action });
    try {
      const res = await fetch("/api/admin/recharge/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId: id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({
          type: "error",
          title: String(data.message || "فشلت العملية"),
        });
        return;
      }
      showToast({
        type: "success",
        title: action === "approve" ? "تمت الموافقة على الطلب" : "تم رفض الطلب",
      });
      await load();
    } catch {
      showToast({ type: "error", title: "حدث خطأ في الاتصال" });
    } finally {
      setBusy(null);
    }
  };

  const agentCell = (r: RechargeRequestRow) => {
    const name = r.agent?.username?.trim();
    const mail = r.agent?.email?.trim() || r.agentEmail?.trim();
    const line1 = name || mail || "—";
    return (
      <div className="min-w-[140px]">
        <div className="font-medium text-white">{line1}</div>
        {name && mail && mail !== name ? (
          <div className="text-xs text-white/45">{mail}</div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="جاري تحميل الطلبات..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      <GlassCard className="mt-8 overflow-hidden border border-white/10 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
                <th className="px-4 py-3">الوكيل</th>
                <th className="min-w-[120px] px-4 py-3">علامات</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="min-w-[160px] px-4 py-3 font-semibold text-cyan-200/90">
                  حساب اللاعب (GoSport365)
                </th>
                <th className="px-4 py-3">طريقة الدفع</th>
                <th className="px-4 py-3">الإثبات</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-white/40">
                    لا توجد طلبات حالياً
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const pending = normStatus(r.status) === "PENDING";
                  const isBusy = busy?.id === r.id;
                  const gosport365 = gosport365Display(r);
                  const flags = r.flags ?? [];
                  const highValue = flags.includes("HIGH_VALUE") || Number(r.amount) > 5000;
                  return (
                    <tr
                      key={r.id}
                      className={clsx(
                        "border-b border-white/5 hover:bg-white/[0.02]",
                        highValue && "bg-rose-950/15 ring-1 ring-inset ring-rose-500/20"
                      )}
                    >
                      <td className="px-4 py-3 align-top">{agentCell(r)}</td>
                      <td className="px-4 py-3 align-top">
                        <FlagBadges flags={r.flags} />
                      </td>
                      <td className="px-4 py-3 align-top text-white/90">
                        <div className="font-semibold text-emerald-300" dir="ltr">
                          {formatCurrencyDhEn(Number(r.amount))}
                        </div>
                        {r.bonus10Percent > 0 ? (
                          <div className="mt-1 text-xs text-white/50">
                            +10% بونوس:{" "}
                            <span className="text-amber-200/90" dir="ltr">
                              {formatCurrencyDhEn(Number(r.bonus10Percent))}
                            </span>
                            <span className="text-white/35"> · إجمالي تقريبي: </span>
                            <span className="text-white/60" dir="ltr">
                              {formatCurrencyDhEn(Number(r.totalWithBonusApprox))}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {gosport365 ? (
                          <div className="flex flex-wrap items-center gap-2" dir="ltr">
                            <span className="font-semibold text-cyan-200 tabular-nums tracking-tight">
                              {gosport365}
                            </span>
                            {canCopyGosport365Username(r) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(String(r.gosport365Username ?? "").trim(), r.id)
                                }
                                className="inline-flex shrink-0 rounded-md border border-white/10 bg-white/[0.06] p-1 text-white/50 transition hover:border-cyan-400/30 hover:bg-white/[0.1] hover:text-cyan-200"
                                title="نسخ"
                                aria-label="نسخ اسم GoSport365"
                              >
                                {copiedRequestId === r.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                )}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-white/80">{bankDisplayName(r)}</td>
                      <td className="px-4 py-3 align-top">
                        {r.proofUrl ? (
                          <a
                            href={r.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex max-w-[200px] flex-col gap-1"
                          >
                            {proofLooksLikeImage(r.proofUrl) ? (
                              <span className="relative block h-20 w-28 overflow-hidden rounded-lg border border-white/15 transition group-hover:border-cyan-400/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={r.proofUrl}
                                  alt="إثبات الدفع"
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <ExternalLink className="h-5 w-5 text-white" />
                                </span>
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 truncate text-xs text-cyan-300 underline-offset-2 group-hover:underline">
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              فتح الإثبات
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-rose-400">لا يوجد إثبات</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-white/65">
                        {formatRequestDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}
                        >
                          {statusLabelAr(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-end">
                        {pending ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => runAction(r.id, "approve")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/35 disabled:opacity-50"
                            >
                              {isBusy && busy?.action === "approve" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Approve (موافقة)
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => runAction(r.id, "reject")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/35 disabled:opacity-50"
                            >
                              {isBusy && busy?.action === "reject" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Reject (رفض)
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-white/35">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </SidebarShell>
  );
}
