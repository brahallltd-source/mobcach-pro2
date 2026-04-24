"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import {
  AgentLinkRequestApprovalRow,
  type AgentPendingLinkRow,
} from "@/components/agent/AgentLinkRequestApprovalRow";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

export default function AgentPlayerRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgentPendingLinkRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/agent-customers", {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();
    const list = (data.customers || []) as (AgentPendingLinkRow & { status?: string })[];
    setRows(
      list
        .filter((c) => {
          const s = String(c.status ?? "").toUpperCase();
          return s === "REQUESTED" || s === "PENDING";
        })
        .map((c) => ({
          id: c.id,
          playerId: c.playerId,
          username: c.username,
          phone: c.phone ?? "",
        }))
    );
  }, []);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="طلبات اللاعبين"
        subtitle="اللاعبون الذين اختاروك أو أُضيفوا لقائمتك بانتظار موافقتك. بعد الموافقة وحفظ بيانات GS365 يمكن استخدام الشحن السريع."
      />

      <div className="space-y-4">
        {rows.length === 0 ? (
          <GlassCard className="p-10 text-center text-white/60">
            لا توجد طلبات معلّقة حالياً.
          </GlassCard>
        ) : null}

        {rows.map((r) => (
          <AgentLinkRequestApprovalRow key={r.id} row={r} onResolved={load} />
        ))}
      </div>
    </SidebarShell>
  );
}
