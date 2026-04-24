"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

type RechargeRow = {
  id: string;
  date: string;
  amount: number;
  status: string;
  statusLabel: string;
};

type ApiPlayer = {
  id: string;
  displayName: string;
  username: string;
  phone?: string;
};

export default function PlayerOrdersPage() {
  const params = useParams();
  const playerId = String(params?.playerId ?? "");

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [totalRecharged, setTotalRecharged] = useState(0);
  const [rows, setRows] = useState<RechargeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) {
        redirectToLogin();
        return;
      }
      if (!playerId) {
        setError("معرّف اللاعب غير صالح");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/agent/my-players/${encodeURIComponent(playerId)}/orders`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "تعذّر التحميل");
          return;
        }
        setPlayer(data.player ?? null);
        setTotalRecharged(Number(data.totalRecharged) || 0);
        setRows(Array.isArray(data.recharges) ? data.recharges : []);
      } catch {
        setError("خطأ في الشبكة");
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  if (error || !player) {
    return (
      <SidebarShell role="agent">
        <PageHeader title="خطأ" subtitle={error || "غير موجود"} />
        <Link href="/agent/my-players" className="mt-4 inline-flex text-cyan-300 hover:underline">
          ← العودة إلى قائمة اللاعبين
        </Link>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <div className="mb-4">
        <Link
          href="/agent/my-players"
          className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-cyan-200"
        >
          <ArrowLeft className="size-4" />
          قائمة لاعبيّ
        </Link>
      </div>

      <PageHeader
        title={player.displayName}
        subtitle={`إجمالي الشحن: ${totalRecharged.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`}
      />

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-right text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-white/55">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">المبلغ (DH)</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-white/45">
                    لا يوجد سجل شحن لهذا اللاعب بعد.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/80" dir="ltr">
                      {new Date(r.date).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-100">{r.amount}</td>
                    <td className="px-4 py-3 text-white/70">{r.statusLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </SidebarShell>
  );
}
