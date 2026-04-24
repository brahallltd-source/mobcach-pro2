"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { RECHARGE_PROOF_STATUS, rechargeProofStatusLabelAr } from "@/lib/recharge-proof-lifecycle";

type RechargeTxRow = {
  id: string;
  status: string;
  amount: number;
  paymentMethod: string | null;
  agentRejectReason: string | null;
  playerComment: string | null;
  playerRating: boolean | null;
  disputeMessage: string | null;
  timerStartedAt: string | null;
  isLatePenaltyApplied: boolean;
  createdAt: string;
  agentUsername: string;
  playerUsername: string;
};

type TabKey = "all" | "rejected" | "success" | "disputes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "rejected", label: "المرفوضة" },
  { key: "success", label: "الناجحة" },
  { key: "disputes", label: "الشكايات" },
];

export default function AdminOrdersHistoryPage() {
  const [rows, setRows] = useState<RechargeTxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/recharge-transactions", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "تعذّر التحميل");
      }
      setRows(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "rejected") return rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED);
    if (tab === "success") return rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED);
    return rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.DISPUTED);
  }, [rows, tab]);

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="جاري تحميل سجل الشحن…" />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="سجل شحن اللاعبين"
        subtitle="مراقبة دورة الإثبات من اللاعب إلى الوكيل: مرفوض، مؤكّد، وشكايات."
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {error ? (
          <GlassCard className="border border-rose-500/25 p-4 text-sm text-rose-200">{error}</GlassCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const on = tab === t.key;
            const count =
              t.key === "all"
                ? rows.length
                : t.key === "rejected"
                  ? rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED).length
                  : t.key === "success"
                    ? rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED).length
                    : rows.filter((r) => r.status === RECHARGE_PROOF_STATUS.DISPUTED).length;
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
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-start text-xs uppercase tracking-wide text-white/45">
                  <th className="px-3 py-3 font-medium">التاريخ</th>
                  <th className="px-3 py-3 font-medium">اللاعب</th>
                  <th className="px-3 py-3 font-medium">الوكيل</th>
                  <th className="px-3 py-3 font-medium">المبلغ</th>
                  <th className="px-3 py-3 font-medium">الوسيلة</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  {tab === "rejected" || tab === "all" ? (
                    <th className="px-3 py-3 font-medium">سبب الرفض</th>
                  ) : null}
                  {tab === "success" || tab === "all" ? (
                    <>
                      <th className="px-3 py-3 font-medium">تعليق اللاعب</th>
                      <th className="px-3 py-3 font-medium">التقييم</th>
                    </>
                  ) : null}
                  {tab === "disputes" || tab === "all" ? (
                    <th className="px-3 py-3 font-medium">الشكاية</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-white/45">
                      لا توجد بيانات.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-3 py-2.5 whitespace-nowrap text-white/55" dir="ltr">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">{r.playerUsername}</td>
                      <td className="px-3 py-2.5">{r.agentUsername}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">{Math.round(r.amount)}</td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-white/70">{r.paymentMethod || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            r.status === RECHARGE_PROOF_STATUS.DISPUTED
                              ? "border-red-500/50 bg-red-600/25 text-red-100"
                              : "border-white/15 bg-white/10 text-white/75"
                          }`}
                        >
                          {rechargeProofStatusLabelAr(r.status)}
                        </span>
                        {r.isLatePenaltyApplied ? (
                          <span className="ms-1 text-[10px] text-amber-300">تأخير</span>
                        ) : null}
                      </td>
                      {tab === "rejected" || tab === "all" ? (
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-rose-200/90">
                          {r.status === RECHARGE_PROOF_STATUS.AGENT_REJECTED ? r.agentRejectReason || "—" : "—"}
                        </td>
                      ) : null}
                      {tab === "success" || tab === "all" ? (
                        <>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-white/70">
                            {r.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED ? r.playerComment || "—" : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {r.status === RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED && r.playerRating != null ? (
                              r.playerRating ? (
                                <span className="text-emerald-300">إعجاب</span>
                              ) : (
                                <span className="text-rose-300">غير راضٍ</span>
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                        </>
                      ) : null}
                      {tab === "disputes" || tab === "all" ? (
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-red-100/90">
                          {r.status === RECHARGE_PROOF_STATUS.DISPUTED ? r.disputeMessage || "—" : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
