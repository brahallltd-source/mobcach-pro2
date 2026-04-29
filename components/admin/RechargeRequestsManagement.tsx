"use client";

import { clsx } from "clsx";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlagBadges } from "@/components/FlagBadges";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { formatCurrencyDhEn } from "@/lib/format-dh";
import { localeForLang, useTranslation } from "@/lib/i18n";
import { RechargeRequestFinancialAuditCard } from "@/components/admin/RechargeRequestFinancialAuditCard";
import type { RechargeRequestRow } from "@/components/admin/recharge-request-row-types";

export type { RechargeRequestRow } from "@/components/admin/recharge-request-row-types";

/** Prefer DB column; legacy requests may store username only inside `note` as `[gosportUsername:…]`. */
function gosport365Display(r: RechargeRequestRow): string {
  const direct = String(r.gosport365Username ?? r.targetUsername ?? "").trim();
  if (direct) return direct;
  const m = String(r.note ?? "").match(/\[gosportUsername:([^\]]+)\]/);
  return String(m?.[1] ?? "").trim();
}

/** Copy only when the API field is set (not `note` fallback), per product rules. */
function canCopyGosport365Username(r: RechargeRequestRow): boolean {
  const raw = String(r.gosport365Username ?? r.targetUsername ?? "").trim();
  return raw.length > 0 && raw !== "-";
}

function bankDisplayName(r: RechargeRequestRow, dash: string): string {
  return (
    r.paymentMethod?.methodName?.trim() ||
    r.paymentMethod?.accountName?.trim() ||
    r.methodDisplayName ||
    dash
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

function formatRequestDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
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

export function RechargeRequestsManagement() {
  const { tx, dir, lang } = useTranslation();
  const locale = useMemo(() => localeForLang(lang), [lang]);
  const dash = tx("admin.common.dash");

  const statusLabel = useCallback(
    (status: string) => {
      const u = normStatus(status);
      if (u === "APPROVED") return tx("admin.table.status.approved");
      if (u === "REJECTED") return tx("admin.table.status.rejected");
      return tx("admin.table.status.pending");
    },
    [tx],
  );

  const agentWalletDisplayName = useCallback(
    (r: RechargeRequestRow): string => {
      const name = r.agent?.username?.trim();
      const mail = r.agent?.email?.trim() || r.agentEmail?.trim();
      return name || mail || tx("admin.recharge.agentFallback");
    },
    [tx],
  );

  const [requests, setRequests] = useState<RechargeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<RechargeRequestRow | null>(null);

  const handleCopy = useCallback(
    async (text: string, requestId: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed === "-") return;
      try {
        await navigator.clipboard.writeText(trimmed);
        toast.success(tx("admin.recharge.copySuccess"));
        setCopiedRequestId(requestId);
        window.setTimeout(() => {
          setCopiedRequestId((cur) => (cur === requestId ? null : cur));
        }, 2000);
      } catch {
        toast.error(tx("admin.recharge.copyFail"));
      }
    },
    [tx],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/recharge-requests", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(data.message || tx("admin.recharge.loadError")));
      setRequests([]);
      return;
    }
    setRequests(data.requests || []);
  }, [tx]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!detailRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRow]);

  const runAction = useCallback(
    async (id: string, action: "approve" | "reject") => {
      const row = requests.find((x) => x.id === id);
      if (action === "approve") {
        if (!row) return;
        const agentName = agentWalletDisplayName(row);
        const totalNum = Number(row.totalWithBonusApprox) || 0;
        const totalStr = new Intl.NumberFormat(locale, {
          maximumFractionDigits: 2,
        }).format(totalNum);
        const ok = window.confirm(
          tx("admin.recharge.confirmApprove", { total: totalStr, agent: agentName }),
        );
        if (!ok) return;
      }
      if (action === "reject") {
        const ok = window.confirm(tx("admin.recharge.confirmReject"));
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
          toast.error(String(data.message || tx("admin.recharge.operationFailed")));
          return;
        }
        toast.success(action === "approve" ? tx("admin.recharge.toastApproved") : tx("admin.recharge.toastRejected"));
        await load();
      } catch {
        toast.error(tx("admin.recharge.networkError"));
      } finally {
        setBusy(null);
      }
    },
    [requests, agentWalletDisplayName, locale, tx, load],
  );

  const agentCell = (r: RechargeRequestRow) => {
    const name = r.agent?.username?.trim();
    const mail = r.agent?.email?.trim() || r.agentEmail?.trim();
    const line1 = name || mail || dash;
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
        <LoadingCard text={tx("admin.recharge.loading")} />
      </SidebarShell>
    );
  }

  return (
    <>
      <SidebarShell role="admin">
        <PageHeader title={tx("admin.recharge.pageTitle")} subtitle={tx("admin.recharge.pageSubtitle")} />

        <GlassCard className="mt-8 overflow-hidden border border-white/10 p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-start text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
                  <th className="px-4 py-3">{tx("admin.recharge.colAgent")}</th>
                  <th className="min-w-[120px] px-4 py-3">{tx("admin.recharge.colFlags")}</th>
                  <th className="px-4 py-3">{tx("admin.recharge.colAmount")}</th>
                  <th className="min-w-[160px] px-4 py-3 font-semibold text-cyan-200/90">
                    {tx("admin.recharge.colGosport")}
                  </th>
                  <th className="px-4 py-3">{tx("admin.recharge.colPayment")}</th>
                  <th className="px-4 py-3">{tx("admin.recharge.colProof")}</th>
                  <th className="px-4 py-3">{tx("admin.recharge.colDate")}</th>
                  <th className="px-4 py-3">{tx("admin.recharge.colStatus")}</th>
                  <th className="px-4 py-3 text-end">{tx("admin.recharge.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-white/40">
                      {tx("admin.recharge.empty")}
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
                          highValue && "bg-rose-950/15 ring-1 ring-inset ring-rose-500/20",
                        )}
                      >
                        <td className="px-4 py-3 align-top">{agentCell(r)}</td>
                        <td className="px-4 py-3 align-top">
                          <FlagBadges flags={r.flags} />
                        </td>
                        <td className="px-4 py-3 align-top text-white/90">
                          {pending ? (
                            <div className="space-y-2">
                              <div>
                                <div className="text-[11px] text-white/40">{tx("admin.recharge.totalCreditPending")}</div>
                                <div className="font-semibold text-emerald-300" dir="ltr">
                                  {formatCurrencyDhEn(Number(r.totalWithBonusApprox))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDetailRow(r)}
                                className="text-xs font-semibold text-cyan-300/95 underline-offset-2 hover:underline"
                              >
                                {tx("admin.recharge.viewFinancialCard")}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-emerald-300" dir="ltr">
                                {formatCurrencyDhEn(Number(r.amount))}
                              </div>
                              {r.bonus10Percent > 0 ? (
                                <div className="mt-1 space-y-0.5 text-xs text-white/50">
                                  <div>
                                    {tx("admin.recharge.bonus10")}{" "}
                                    <span className="text-amber-200/90" dir="ltr">
                                      {formatCurrencyDhEn(Number(r.bonus10Percent))}
                                    </span>
                                  </div>
                                  {Number(r.invitationAffiliateDh) > 0 ? (
                                    <div>
                                      {tx("admin.recharge.bonusAffiliate")}{" "}
                                      <span className="text-violet-200/90" dir="ltr">
                                        {formatCurrencyDhEn(Number(r.invitationAffiliateDh))}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div>
                                    <span className="text-white/35">{tx("admin.recharge.totalCreditLabel")} </span>
                                    <span className="text-white/60" dir="ltr">
                                      {formatCurrencyDhEn(Number(r.totalWithBonusApprox))}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
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
                                    handleCopy(
                                      String(r.gosport365Username ?? r.targetUsername ?? "").trim(),
                                      r.id
                                    )
                                  }
                                  className="inline-flex shrink-0 rounded-md border border-white/10 bg-white/[0.06] p-1 text-white/50 transition hover:border-cyan-400/30 hover:bg-white/[0.1] hover:text-cyan-200"
                                  title={tx("admin.actions.copy")}
                                  aria-label={tx("admin.recharge.copyGosportAria")}
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
                            <span className="text-white/35">{dash}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-white/80">{bankDisplayName(r, dash)}</td>
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
                                    alt={tx("admin.recharge.proofAlt")}
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                    <ExternalLink className="h-5 w-5 text-white" />
                                  </span>
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1 truncate text-xs text-cyan-300 underline-offset-2 group-hover:underline">
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                {tx("admin.recharge.openProof")}
                              </span>
                            </a>
                          ) : (
                            <span className="text-xs text-rose-400">{tx("admin.recharge.noProof")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap text-white/65">
                          {formatRequestDate(r.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-end">
                          {pending ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setDetailRow(null);
                                  void runAction(r.id, "approve");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/35 disabled:opacity-50"
                              >
                                {isBusy && busy?.action === "approve" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {tx("admin.actions.approve")}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void runAction(r.id, "reject")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/35 disabled:opacity-50"
                              >
                                {isBusy && busy?.action === "reject" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {tx("admin.actions.reject")}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/35">{dash}</span>
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

      {detailRow ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setDetailRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recharge-detail-title"
            dir={dir}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailRow(null)}
              className="absolute end-3 top-3 rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/60 transition hover:border-white/20 hover:text-white"
              aria-label={tx("admin.actions.close")}
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="recharge-detail-title" className="pe-10 text-lg font-bold text-white">
              {tx("admin.recharge.detailTitle")}
            </h2>
            <p className="mt-1 text-sm text-white/50">{agentWalletDisplayName(detailRow)}</p>

            <div className="mt-5 space-y-4">
              <RechargeRequestFinancialAuditCard row={detailRow} />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
                <div className="flex justify-between gap-2 py-1">
                  <span className="text-white/45">{tx("admin.recharge.detailPayment")}</span>
                  <span className="text-start font-medium text-white/85">
                    {bankDisplayName(detailRow, dash)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 py-1">
                  <span className="text-white/45">GoSport365</span>
                  <span className="text-start font-medium tabular-nums text-cyan-200/90" dir="ltr">
                    {gosport365Display(detailRow) || dash}
                  </span>
                </div>
                <div className="flex justify-between gap-2 py-1">
                  <span className="text-white/45">{tx("admin.recharge.detailDate")}</span>
                  <span>{formatRequestDate(detailRow.createdAt, locale)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <FlagBadges flags={detailRow.flags} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
