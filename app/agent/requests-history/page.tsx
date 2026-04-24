"use client";

import { useEffect, useState } from "react";
import { LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import type { AgentRequestHistoryRow } from "@/lib/agent-requests-history-types";

function formatDecidedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-MA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AgentRequestsHistoryPage() {
  const [items, setItems] = useState<AgentRequestHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const u = await requireMobcashUserOnClient("agent");
        if (!u) {
          redirectToLogin();
          return;
        }
        const res = await fetch("/api/agent/requests-history", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as { success?: boolean; items?: AgentRequestHistoryRow[]; message?: string };
        if (!res.ok) {
          setError(data.message || "تعذّر تحميل السجل");
          setItems([]);
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setError("خطأ في الشبكة");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري تحميل سجل الطلبات..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="سجل الطلبات"
        subtitle="قرارات الموافقة والرفض على طلبات الارتباط باللاعبين."
      />

      {error ? (
        <p className="mt-4 text-center text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>السجل</CardTitle>
          <CardDescription>
            الموافقات تُستخرج من الارتباطات النشطة. الرفض يظهر للطلبات المرفوضة بعد تفعيل التسجيل في السيرفر (سجل
            تدقيق).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 md:p-0">
          <table className="w-full min-w-[640px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/50">
                <th className="px-4 py-3 font-semibold">اسم اللاعب / البريد</th>
                <th className="px-4 py-3 font-semibold">التاريخ</th>
                <th className="px-4 py-3 font-semibold">الحالة</th>
                <th className="px-4 py-3 font-semibold">سبب الرفض</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-white/45">
                    لا توجد قرارات مسجّلة بعد.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]">
                    <td className="max-w-[280px] px-4 py-3 font-medium text-white/90">
                      <span className="block truncate" title={row.playerLabel}>
                        {row.playerLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/70" dir="ltr">
                      {formatDecidedAt(row.decidedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "approved" ? (
                        <Badge className="border-emerald-400/40 bg-emerald-500/15 text-emerald-100">موافق عليه</Badge>
                      ) : (
                        <Badge variant="destructive">مرفوض</Badge>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-white/50">
                      {row.status === "rejected" && row.rejectionReason ? (
                        <span className="text-sm text-white/50">{row.rejectionReason}</span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </SidebarShell>
  );
}
