
"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatusBadge, TextArea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

export default function AgentActivationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (email: string) => {
    const res = await fetch(`/api/agent/activations?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const data = await res.json();
    setRows(data.players || []);
    if (!selectedMessage && data.players?.[0]?.messageText) setSelectedMessage(data.players[0].messageText);
  };

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      load(String(u.email)).finally(() => setLoading(false));
    })();
  }, []);

  const activate = async (playerUserId: string) => {
    setBusyId(playerUserId);
    const res = await fetch("/api/agent/activations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerUserId, action: "activate" }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "Activation failed");
    const saved = localStorage.getItem("mobcash_user");
    if (saved) {
      const user = JSON.parse(saved);
      await load(user.email);
    }
    setBusyId(null);
    alert(data.message || "Activated");
  };

  const markDone = async (playerUserId: string) => {
    const res = await fetch("/api/agent/activations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerUserId, action: "done" }),
    });
    const data = await res.json();
    alert(data.message || "Updated");
  };

  const copyMessage = async (messageText: string) => {
    await navigator.clipboard.writeText(messageText);
    setSelectedMessage(messageText);
    const { showToast } = useToast();

showToast({
  type: "success",
  title: "Copied successfully",
  message: "The message is ready to paste and send.",
});
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text="Loading activations..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Player activations" subtitle="Activate assigned players, copy the official bilingual login message and send it by WhatsApp or email." />
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {rows.map((row) => {
            const status = row.status === "active" ? "approved" : "pending";
            return (
              <GlassCard key={row.user_id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{row.first_name || ""} {row.last_name || ""}</h3>
                    <p className="mt-2 text-sm text-white/55">{row.playerEmail}</p>
                    <p className="mt-2 text-sm text-white/45">Username: {row.username}</p>
                    <p className="mt-2 text-sm text-white/45">Phone: {row.phone || "—"}</p>
                    <div className="mt-3"><StatusBadge status={status} /></div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {row.status !== "active" ? (
                      <PrimaryButton onClick={() => activate(row.user_id)} disabled={busyId === row.user_id}>
                        {busyId === row.user_id ? "Activating..." : "Activate"}
                      </PrimaryButton>
                    ) : null}
                    <PrimaryButton onClick={() => copyMessage(row.messageText)}> <Copy size={16} className="mr-2 inline-block" />Copy Message</PrimaryButton>
                    <a href={`https://wa.me/${String(row.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(row.messageText)}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><MessageCircle size={16} className="mr-2 inline-block" />WhatsApp</a>
                    <a href={`mailto:${encodeURIComponent(row.playerEmail)}?subject=${encodeURIComponent("Your official login information")}&body=${encodeURIComponent(row.messageText)}`} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><Mail size={16} className="mr-2 inline-block" />Email</a>
                    <button onClick={() => markDone(row.user_id)} className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20">Done Sending</button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
          {!rows.length ? <GlassCard className="p-10 text-center text-white/65">No activation rows found.</GlassCard> : null}
        </div>
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Official message preview</h2>
          <TextArea rows={18} value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} className="mt-5" />
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
