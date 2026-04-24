"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  SidebarShell,
} from "@/components/ui";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

type Row = {
  id: string;
  amount: number;
  bonus10: number;
  totalApprox: number;
  methodLabel: string;
  adminMethodName: string;
  status: string;
  proofUrl: string | null;
  createdAt: string;
};

function normStatus(s: string) {
  return String(s ?? "").trim().toUpperCase();
}

function formatDateDdMmYyyy(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  const u = normStatus(status);
  if (u === "APPROVED") {
    return {
      className: "bg-emerald-500/20 text-emerald-200 border-emerald-500/35",
      label: "تم الشحن",
    };
  }
  if (u === "REJECTED") {
    return {
      className: "bg-rose-500/20 text-rose-200 border-rose-500/35",
      label: "مرفوض",
    };
  }
  return {
    className: "bg-amber-500/20 text-amber-100 border-amber-500/35",
    label: "قيد المراجعة",
  };
}

export default function AgentRechargeHistoryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await requireMobcashUserOnClient("agent");
    if (!u) {
      setLoading(false);
      return void redirectToLogin();
    }
    const res = await fetch("/api/agent/recharge/history", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(data.message || "تعذر تحميل السجل"));
      setItems([]);
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text={t("loading") || "Loading..."} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={t("recharge_history_title") || "Recharge history"}
        subtitle={
          t("recharge_history_subtitle") ||
          "سجل طلبات شحن المحفظة وحالاتها."
        }
      />

      <GlassCard className="mt-8 overflow-hidden border border-white/10 p-0">
        {items.length === 0 ? (
          <p className="px-6 py-16 text-center text-base text-white/50">
            لا توجد عمليات شحن سابقة
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">الطريقة</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإثبات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const badge = statusBadge(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-white/85" dir="ltr">
                        {formatDateDdMmYyyy(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-emerald-300/95 tabular-nums" dir="ltr">
                          {Number(row.amount).toLocaleString("ar-MA")} DH
                        </div>
                        <div className="mt-0.5 text-xs text-white/45">
                          +10%:{" "}
                          <span className="text-amber-200/90 tabular-nums" dir="ltr">
                            {Number(row.bonus10).toLocaleString("ar-MA")} DH
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/80">{row.methodLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.proofUrl ? (
                          <a
                            href={row.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            عرض الوصل
                          </a>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </SidebarShell>
  );
}
