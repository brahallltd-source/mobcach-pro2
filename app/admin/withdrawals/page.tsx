"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DangerButton,
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextArea,
} from "@/components/ui";

type Withdrawal = {
  id: string;
  playerEmail: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  adminNote?: string | null;
  cashProvider?: string | null;
  rib?: string | null;
  swift?: string | null;
  fullName?: string | null;
  city?: string | null;
  gosportUsername?: string | null;
  kind?: string | null;
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch("/api/admin/withdrawals?kind=winning", {
      cache: "no-store",
    });
    const data = await res.json();
    setItems(data.withdrawals || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const act = async (withdrawalId: string, action: "mark_sent" | "reject") => {
    setBusyId(withdrawalId);

    const res = await fetch("/api/admin/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        withdrawalId,
        action,
        note: notes[withdrawalId] || "",
      }),
    });

    const data = await res.json();
    if (!res.ok) alert(data.message || "Action failed");

    await load();
    setBusyId(null);
  };

  const ready = useMemo(
    () => items.filter((item) => item.status === "pending").length,
    [items]
  );
  const sent = useMemo(
    () => items.filter((item) => item.status === "sent").length,
    [items]
  );
  const rejected = useMemo(
    () => items.filter((item) => item.status === "rejected").length,
    [items]
  );

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading winner payouts..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Winner payout control"
        subtitle="Winning payout requests now go directly from player to admin without agent review."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending review" value={String(ready)} hint="Waiting for admin" />
        <StatCard label="Funds sent" value={String(sent)} hint="Transfer marked as sent" />
        <StatCard label="Rejected" value={String(rejected)} hint="Rejected by admin" />
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">{item.playerEmail}</h3>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/55">
                  {item.amount} DH • {item.method === "bank" ? "Bank transfer" : item.cashProvider || "Cash transfer"} • {new Date(item.createdAt).toLocaleString()}
                </p>

                <div className="mt-3 text-sm text-white/60">
                  <p>Type: {item.kind || "standard"}</p>
                  <p>Gosport username: {item.gosportUsername || "—"}</p>
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  {item.method === "bank" ? (
                    <div className="grid gap-2">
                      <p>RIB: {item.rib || "—"}</p>
                      <p>SWIFT: {item.swift || "—"}</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <p>Provider: {item.cashProvider || "Cash"}</p>
                      <p>Receiver: {item.fullName || "—"}</p>
                      <p>City: {item.city || "—"}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white/85">Admin note</p>
                <TextArea
                  rows={5}
                  value={notes[item.id] || item.adminNote || ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Optional transfer note or rejection reason"
                  className="mt-3"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton
                    onClick={() => act(item.id, "mark_sent")}
                    disabled={busyId === item.id || item.status !== "pending"}
                  >
                    {busyId === item.id ? "Processing..." : "Mark as sent"}
                  </PrimaryButton>

                  <DangerButton
                    onClick={() => act(item.id, "reject")}
                    disabled={busyId === item.id || ["sent", "rejected"].includes(item.status)}
                  >
                    {busyId === item.id ? "Processing..." : "Reject"}
                  </DangerButton>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}

        {!items.length ? (
          <GlassCard className="p-10 text-center">No winning payout requests available.</GlassCard>
        ) : null}
      </div>
    </SidebarShell>
  );
}
