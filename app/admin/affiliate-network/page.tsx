"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Users } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  SidebarShell,
} from "@/components/ui";
import { formatCurrencyDhEn } from "@/lib/format-dh";
import type {
  AffiliateNetworkAgentNode,
  AffiliateNetworkPlayerNode,
} from "@/lib/admin-affiliate-network-types";

function fmtDh(n: number) {
  return formatCurrencyDhEn(Number.isFinite(n) ? n : 0);
}

function TreeNode({
  node,
  depth,
  defaultOpen,
}: {
  node: AffiliateNetworkAgentNode | AffiliateNetworkPlayerNode;
  depth: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (node.kind === "player") {
    return (
      <div
        className="border-s border-white/10 ps-4"
        style={{ marginInlineStart: depth * 18 }}
      >
        <div
          className={`my-1.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 sm:px-4 ${
            node.loopSuspicion
              ? "border-amber-500/45 bg-amber-500/10 ring-1 ring-amber-400/25"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/90">Player</span>
              {node.loopSuspicion ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                  Recharge-only loop
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate font-semibold text-white">{node.username}</p>
            <p className="truncate text-xs text-white/45">{node.email}</p>
          </div>
          <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-end text-xs text-white/55">
            <div>
              <dt className="text-white/35">Sales (completed orders)</dt>
              <dd className="font-mono text-sm text-white/90" dir="ltr">
                {fmtDh(node.totalSales)}
              </dd>
            </div>
            <div>
              <dt className="text-white/35">Recharged (link)</dt>
              <dd className="font-mono text-sm text-emerald-200/90" dir="ltr">
                {fmtDh(node.totalRechargedDh)}
              </dd>
            </div>
            <div>
              <dt className="text-white/35">Completed #</dt>
              <dd className="font-mono text-sm text-white/90">{node.completedOrders}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  const isMaster = node.kind === "master_agent";
  const hasKids = node.children.length > 0;

  return (
    <div className="border-s border-white/10 ps-1" style={{ marginInlineStart: depth * 18 }}>
      <div
        className={`my-1.5 rounded-xl border px-3 py-2.5 sm:px-4 ${
          isMaster
            ? "border-cyan-500/30 bg-cyan-500/[0.07]"
            : "border-amber-400/25 bg-amber-500/[0.06]"
        } ${node.hasLoopRisk ? "ring-1 ring-amber-400/30" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            disabled={!hasKids}
            onClick={() => hasKids && setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-start gap-2 text-start disabled:cursor-default"
          >
            {hasKids ? (
              <span className="mt-0.5 shrink-0 text-white/50">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            ) : (
              <span className="mt-0.5 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isMaster ? "text-cyan-200/90" : "text-amber-200/90"
                }`}
              >
                {isMaster ? "Master agent" : "Sub-agent"}
              </span>
              <p className="truncate font-semibold text-white">{node.displayName}</p>
              <p className="truncate text-xs text-white/45">
                @{node.username} · {node.email}
              </p>
            </span>
          </button>
          {node.hasLoopRisk ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {node.downstreamLoopingPlayers} looping
            </span>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-white/40">Total sales (DH)</dt>
            <dd className="font-mono text-sm font-semibold text-white" dir="ltr">
              {fmtDh(node.totalSales)}
            </dd>
          </div>
          <div>
            <dt className="text-white/40">Active players (direct)</dt>
            <dd className="font-mono text-sm font-semibold text-white">{node.activePlayers}</dd>
          </div>
          <div>
            <dt className="text-white/40">Bonuses claimed (blocks)</dt>
            <dd className="font-mono text-sm font-semibold text-emerald-200/90">{node.bonusesClaimed}</dd>
          </div>
          <div>
            <dt className="text-white/40">Subtree loop players</dt>
            <dd className="font-mono text-sm font-semibold text-amber-200/90">{node.downstreamLoopingPlayers}</dd>
          </div>
        </dl>
      </div>
      {open && hasKids ? (
        <div className="pb-1 pt-0.5">
          {node.children.map((ch) => (
            <TreeNode key={ch.kind === "player" ? `p-${ch.id}` : `a-${ch.userId}`} node={ch} depth={depth + 1} defaultOpen={depth < 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAffiliateNetworkPage() {
  const [trees, setTrees] = useState<AffiliateNetworkAgentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliate-network", {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        trees?: AffiliateNetworkAgentNode[];
        message?: string;
      };
      if (!res.ok) {
        setTrees([]);
        setError(String(data.message || "Failed to load affiliate network"));
        return;
      }
      setTrees(Array.isArray(data.trees) ? data.trees : []);
    } catch {
      setTrees([]);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading affiliate network…" />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Affiliate network"
        subtitle="Master agents → sub-agents (referredBy) → players (assignedAgentId). Highlights players with high linked recharge volume and zero completed orders (recharge-only loop)."
        action={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-cyan-400/35 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {error ? (
        <GlassCard className="mt-6 border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">{error}</GlassCard>
      ) : null}

      <GlassCard className="mt-6 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/55">
          <Users className="h-4 w-4 shrink-0 text-cyan-300/80" aria-hidden />
          <span>
            {trees.length} master root{trees.length === 1 ? "" : "s"} · Sub-agents nest under their referrer. Players
            list under the agent they are assigned to.
          </span>
        </div>

        {trees.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">No master agents found (or empty tree).</p>
        ) : (
          <div className="space-y-4">
            {trees.map((t) => (
              <TreeNode key={t.userId} node={t} depth={0} defaultOpen />
            ))}
          </div>
        )}

        <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/40">
          <strong className="text-white/55">Loop heuristic:</strong> player flagged when AgentCustomer total
          recharged ≥ {500} DH and completed order count is 0. Tune threshold in API if needed.
        </p>
      </GlassCard>
    </SidebarShell>
  );
}
