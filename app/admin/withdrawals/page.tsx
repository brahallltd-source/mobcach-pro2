"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextField,
} from "@/components/ui";

type Withdrawal = {
  id: string;
  playerEmail: string;
  amount: number;
  method: string;
  status: string;
  rib?: string | null;
  swift?: string | null;
  cashProvider?: string | null;
  fullName?: string | null;
  phone?: string | null;
  city?: string | null;
  created_at?: string;
  kind?: string | null;
  gosportUsername?: string | null;
  winnerOrderId?: string | null;
  adminNote?: string | null;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "winner" | "standard">("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/withdrawals", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json();
    setWithdrawals(data.withdrawals || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return withdrawals.filter((item) => {
      const kindOk =
        filter === "all"
          ? true
          : filter === "winner"
          ? item.kind === "winner"
          : (item.kind || "standard") !== "winner";

      if (!kindOk) return false;
      if (!q) return true;

      return [
        item.playerEmail,
        item.method,
        item.status,
        item.gosportUsername,
        item.winnerOrderId,
      ]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [withdrawals, filter, query]);

  const act = async (
    withdrawalId: string,
    action: "mark_sent" | "reject" | "complete"
  ) => {
    try {
      setBusyId(withdrawalId);

      const note =
        action === "reject"
          ? window.prompt("Reject note") || ""
          : window.prompt("Admin note (optional)") || "";

      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId, action, note }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Action failed");
        return;
      }

      await load();
      alert(data.message || "Updated successfully");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading withdrawals..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Payouts"
        subtitle="Review standard withdrawals and winner payout requests sent directly by players."
      />

      <GlassCard className="p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {(["all", "winner", "standard"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${
                  filter === item
                    ? "bg-white text-slate-900"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="w-full max-w-sm">
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player, status, username or order id"
            />
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {filtered.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-2 text-sm text-white/70">
                <p>
                  Player:{" "}
                  <span className="font-semibold text-white">
                    {item.playerEmail}
                  </span>
                </p>
                <p>
                  Amount:{" "}
                  <span className="font-semibold text-white">
                    {item.amount} DH
                  </span>
                </p>
                <p>
                  Type:{" "}
                  <span className="font-semibold text-white">
                    {item.kind || "standard"}
                  </span>
                </p>
                <p>
                  Method:{" "}
                  <span className="font-semibold text-white">
                    {item.method === "bank"
                      ? "Bank transfer"
                      : item.cashProvider || "Cash withdrawal"}
                  </span>
                </p>
                {item.gosportUsername ? (
                  <p>
                    GoSport365 Username:{" "}
                    <span className="font-semibold text-white">
                      {item.gosportUsername}
                    </span>
                  </p>
                ) : null}
                {item.adminNote ? (
                  <p>
                    Admin note:{" "}
                    <span className="font-semibold text-white">
                      {item.adminNote}
                    </span>
                  </p>
                ) : null}
                {item.winnerOrderId ? (
                  <p>
                    Winner order:{" "}
                    <span className="font-semibold text-white">
                      {item.winnerOrderId}
                    </span>
                  </p>
                ) : null}
                {item.rib ? (
                  <p>
                    RIB: <span className="font-semibold text-white">{item.rib}</span>
                  </p>
                ) : null}
                {item.swift ? (
                  <p>
                    SWIFT:{" "}
                    <span className="font-semibold text-white">{item.swift}</span>
                  </p>
                ) : null}
                {item.fullName ? (
                  <p>
                    Full name:{" "}
                    <span className="font-semibold text-white">
                      {item.fullName}
                    </span>
                  </p>
                ) : null}
                {item.phone ? (
                  <p>
                    Phone:{" "}
                    <span className="font-semibold text-white">{item.phone}</span>
                  </p>
                ) : null}
                {item.city ? (
                  <p>
                    City:{" "}
                    <span className="font-semibold text-white">{item.city}</span>
                  </p>
                ) : null}
                <p>
                  Created:{" "}
                  <span className="font-semibold text-white">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "—"}
                  </span>
                </p>
              </div>

              <div className="flex min-w-[240px] flex-col gap-3">
                <StatusBadge status={item.status} />

                {item.status === "pending" ? (
                  <>
                    <PrimaryButton
                      onClick={() => act(item.id, "mark_sent")}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? "Processing..." : "Mark sent"}
                    </PrimaryButton>

                    <button
                      onClick={() => act(item.id, "complete")}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Processing..." : "Complete"}
                    </button>

                    <button
                      onClick={() => act(item.id, "reject")}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Processing..." : "Reject"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </GlassCard>
        ))}

        {!filtered.length ? (
          <GlassCard className="p-10 text-center text-white/65">
            No payouts found for this filter.
          </GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}