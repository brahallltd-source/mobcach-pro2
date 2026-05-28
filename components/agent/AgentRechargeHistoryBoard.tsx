"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard, LoadingCard, PageHeader } from "@/components/ui";
import { toast } from "sonner";
import { useAgentTranslation } from "@/hooks/useTranslation";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

type Row = {
  id: string;
  playerId: string;
  amount: number;
  status: string;
  proofUrl: string | null;
  decisionAt: string;
  createdAt: string;
};

function normStatus(s: string) {
  return String(s ?? "").trim().toUpperCase();
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function statusBadge(status: string, am: (path: string) => string) {
  const u = normStatus(status);
  if (u === "AUTO_APPROVED") {
    return {
      className: "bg-cyan-500/20 text-cyan-200 border-cyan-500/35",
      label: "Auto approved",
    };
  }
  if (u === "APPROVED") {
    return {
      className: "bg-emerald-500/20 text-emerald-200 border-emerald-500/35",
      label: am("wallet.statusApproved"),
    };
  }
  if (u === "REJECTED") {
    return {
      className: "bg-rose-500/20 text-rose-200 border-rose-500/35",
      label: am("wallet.statusRejected"),
    };
  }
  return {
    className: "bg-amber-500/20 text-amber-100 border-amber-500/35",
    label: am("wallet.statusPending"),
  };
}

export function AgentRechargeHistoryBoard() {
  const { am, lang, dir } = useAgentTranslation();
  const amRef = useRef(am);
  amRef.current = am;
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const numLocale = useMemo(
    () => (lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );

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
      toast.error(String(data.message || amRef.current("wallet.historyLoadError")));
      setItems([]);
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return <LoadingCard text={am("wallet.loading")} />;
  }

  return (
    <div className="space-y-4" dir={dir}>
      <PageHeader title={am("wallet.historyTitle")} subtitle={am("wallet.historySubtitle")} />

      <GlassCard className="mt-8 overflow-hidden border border-white/10 p-0">
        {items.length === 0 ? (
          <p className="px-6 py-16 text-center text-base text-white/50">{am("wallet.historyEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-start text-xs uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3">Player ID</th>
                  <th className="px-4 py-3">{am("wallet.colAmount")}</th>
                  <th className="px-4 py-3">Decision date/time</th>
                  <th className="px-4 py-3">{am("wallet.colStatus")}</th>
                  <th className="px-4 py-3">{am("wallet.colProof")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const badge = statusBadge(row.status, am);
                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-white/80" dir="ltr">
                        {row.playerId || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/85" dir="ltr">
                        <span className="font-semibold text-emerald-300/95 tabular-nums">
                          {Number(row.amount).toLocaleString(numLocale)} DH
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/85" dir="ltr">
                        {formatDateTime(row.decisionAt)}
                      </td>
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
                            className="inline-flex items-center gap-2 text-cyan-300 hover:underline"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.proofUrl}
                              alt="Proof"
                              className="h-9 w-9 rounded-md border border-white/15 object-cover"
                              loading="lazy"
                            />
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            {am("wallet.viewProof")}
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
    </div>
  );
}
