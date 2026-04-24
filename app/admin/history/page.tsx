"use client";

import { clsx } from "clsx";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlagBadges } from "@/components/FlagBadges";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell } from "@/components/ui";
import type { RechargeRequestRow } from "@/components/admin/RechargeRequestsManagement";
import { formatCurrencyDhEn } from "@/lib/format-dh";

type StatusFilter = "all" | "approved" | "rejected";

function gosport365Display(r: RechargeRequestRow): string {
  const direct = String(r.gosport365Username ?? "").trim();
  if (direct) return direct;
  const m = String(r.note ?? "").match(/\[gosportUsername:([^\]]+)\]/);
  return String(m?.[1] ?? "").trim() || "—";
}

function paymentMethodLabel(r: RechargeRequestRow): string {
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

function csvEscape(value: string): string {
  const s = String(value).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

function downloadRowsAsCsv(rows: RechargeRequestRow[], filterKey: StatusFilter) {
  const header = ["Agent name", "Flags", "Amount (DH)", "GoSport365", "Payment method", "Date", "Status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const flagStr = Array.isArray(r.flags) ? r.flags.join(";") : "";
    lines.push(
      [
        csvEscape(agentDisplayName(r)),
        csvEscape(flagStr),
        csvEscape(String(r.amount)),
        csvEscape(gosport365Display(r)),
        csvEscape(paymentMethodLabel(r)),
        csvEscape(formatDate(r.createdAt)),
        csvEscape(normStatus(r.status)),
      ].join(",")
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recharge-transactions-${filterKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-MA-u-ca-gregory", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function agentDisplayName(r: RechargeRequestRow): string {
  const u = r.agent?.username?.trim();
  if (u) return u;
  const e = r.agent?.email?.trim();
  if (e) return e;
  return r.agentEmail?.trim() || "—";
}

export default function AdminRechargeHistoryPage() {
  const [rows, setRows] = useState<RechargeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recharge-requests/history", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      setRows(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "approved") {
      return rows.filter((r) => normStatus(r.status) === "APPROVED");
    }
    return rows.filter((r) => normStatus(r.status) === "REJECTED");
  }, [rows, filter]);

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <SidebarShell role="admin">
      {loading ? (
        <LoadingCard text="Loading recharge history..." />
      ) : (
        <>
          <PageHeader
            title="Recharge history / الأرشيف"
            subtitle="Processed recharge requests (approved or rejected). Pending items stay on Recharge Requests."
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={
                    filter === tab.key
                      ? "rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow"
                      : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <PrimaryButton
              type="button"
              disabled={filtered.length === 0}
              onClick={() => downloadRowsAsCsv(filtered, filter)}
              className="inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV (Excel)
            </PrimaryButton>
          </div>

          <GlassCard className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3 font-semibold">Agent name</th>
                  <th className="px-4 py-3 font-semibold">Flags</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">GoSport365</th>
                  <th className="px-4 py-3 font-semibold">Payment method</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                      No rows for this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const approved = normStatus(r.status) === "APPROVED";
                    const rejected = normStatus(r.status) === "REJECTED";
                    const flags = r.flags ?? [];
                    const highValue = flags.includes("HIGH_VALUE") || Number(r.amount) > 5000;
                    return (
                      <tr
                        key={r.id}
                        className={clsx(
                          "border-b border-white/5 last:border-0 hover:bg-white/[0.03]",
                          highValue && "bg-rose-950/15 ring-1 ring-inset ring-rose-500/20"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-white">{agentDisplayName(r)}</td>
                        <td className="px-4 py-3 align-top">
                          <FlagBadges flags={r.flags} />
                        </td>
                        <td className="px-4 py-3 text-white/85" dir="ltr">
                          {formatCurrencyDhEn(Number(r.amount))}
                        </td>
                        <td className="px-4 py-3 text-white/75">{gosport365Display(r)}</td>
                        <td className="px-4 py-3 text-white/75">{paymentMethodLabel(r)}</td>
                        <td className="px-4 py-3 text-white/60">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          {approved && (
                            <span className="inline-flex rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                              Approved
                            </span>
                          )}
                          {rejected && (
                            <span className="inline-flex rounded-full border border-rose-500/35 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300">
                              Rejected
                            </span>
                          )}
                          {!approved && !rejected && (
                            <span className="text-xs text-white/50">{r.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </GlassCard>
        </>
      )}
    </SidebarShell>
  );
}
