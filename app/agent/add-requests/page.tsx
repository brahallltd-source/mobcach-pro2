"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, SidebarShell } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentLinkRequestApprovalRow,
  type AgentPendingLinkRow,
} from "@/components/agent/AgentLinkRequestApprovalRow";
import { AgentOrdersBoard } from "@/components/agent/AgentOrdersBoard";
import { AgentActivationsBoard } from "@/components/agent/AgentActivationsBoard";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { useAgentTranslation } from "@/hooks/useTranslation";
import type { AgentRequestHistoryRow } from "@/lib/agent-requests-history-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDecidedAt(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function RequestsHistoryBody({ locale }: { locale: string }) {
  const { t } = useAgentTranslation();
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
        const res = await fetch("/api/agent/requests-history", { credentials: "include", cache: "no-store" });
        const data = (await res.json()) as { success?: boolean; items?: AgentRequestHistoryRow[]; message?: string };
        if (!res.ok) {
          setError(data.message || "Error");
          setItems([]);
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setError("Network error");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading) return <LoadingCard text={t("requests_loading")} />;

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.02]">
      <CardHeader>
        <CardTitle className="text-white">{t("add_requests_tab_history")}</CardTitle>
        <CardDescription className="text-white/50">{t("requests_page_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 md:p-0">
        {error ? (
          <p className="p-4 text-center text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        <table className="w-full min-w-[640px] border-collapse text-start text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/50">
              <th className="px-4 py-3 font-semibold">{t("table_player_name")}</th>
              <th className="px-4 py-3 font-semibold">{t("table_date")}</th>
              <th className="px-4 py-3 font-semibold">{t("table_status")}</th>
              <th className="px-4 py-3 font-semibold">{t("table_action")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-white/45">
                  {t("requests_empty")}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="max-w-[280px] px-4 py-3 font-medium text-white/90">
                    <span className="block truncate" title={row.playerLabel}>
                      {row.playerLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/70" dir="ltr">
                    {formatDecidedAt(row.decidedAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "approved" ? (
                      <Badge className="border-emerald-400/40 bg-emerald-500/15 text-emerald-100">Approved</Badge>
                    ) : (
                      <Badge variant="destructive">Rejected</Badge>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-white/50">
                    {row.status === "rejected" && row.rejectionReason ? row.rejectionReason : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function AgentAddRequestsPage() {
  const { t, lang } = useAgentTranslation();
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgentPendingLinkRow[]>([]);

  const locale = useMemo(() => (lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US"), [lang]);

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/agent-customers", { credentials: "include", cache: "no-store" });
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
        <LoadingCard text={t("requests_loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader title={t("sidebar_add_requests")} subtitle={t("requests_page_subtitle")} />

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="w-full justify-start md:w-auto">
          <TabsTrigger value="pending">{t("add_requests_tab_pending")}</TabsTrigger>
          <TabsTrigger value="history">{t("add_requests_tab_history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-200/90">
              {t("requests_page_title")}
            </h2>
            {rows.length === 0 ? (
              <GlassCard className="p-8 text-center text-white/55">{t("requests_empty")}</GlassCard>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <AgentLinkRequestApprovalRow key={r.id} row={r} onResolved={load} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-200/90">
              {t("sidebar_orders")}
            </h2>
            <AgentOrdersBoard />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-200/90">
              {t("sidebar_activations")}
            </h2>
            <AgentActivationsBoard />
          </section>
        </TabsContent>

        <TabsContent value="history">
          <RequestsHistoryBody locale={locale} />
        </TabsContent>
      </Tabs>
    </SidebarShell>
  );
}
