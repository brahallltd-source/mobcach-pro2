"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, Shell, StatusBadge, TextArea, TextField } from "@/components/ui";

type Complaint = { id: string; subject: string; message: string; status: string; admin_reply?: string; created_at: string; };

export default function PlayerComplaintsPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (playerEmail: string) => {
    const res = await fetch(`/api/player/complaints?email=${encodeURIComponent(playerEmail)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.complaints || []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    setEmail(user.email);
    load(user.email).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/player/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerEmail: email, subject, message }) });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Failed to send complaint"); setSaving(false); return; }
      setSubject(""); setMessage(""); await load(email); alert(data.message || "Complaint submitted");
    } catch (error) { console.error(error); alert("Network error"); }
    setSaving(false);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Complaints & support" subtitle="Raise a complaint to admin and follow the reply inside a clean support timeline." />
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-6">
            <h2 className="text-2xl font-semibold">New complaint</h2>
            <div className="mt-5 space-y-4">
              <TextField value={email} disabled />
              <TextField placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <TextArea rows={7} placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
              <PrimaryButton onClick={submit} disabled={saving} className="w-full">{saving ? "Sending..." : "Send complaint"}</PrimaryButton>
            </div>
          </GlassCard>
          <GlassCard className="p-6">
            <h2 className="text-2xl font-semibold">My complaints</h2>
            <div className="mt-5 space-y-4">
              {loading ? <p className="text-white/55">Loading complaints...</p> : items.length === 0 ? <p className="text-white/55">No complaints yet.</p> : items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{item.subject}</h3>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-white/65">{item.message}</p>
                  {item.admin_reply ? <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/75"><span className="font-semibold text-white">Admin reply:</span> {item.admin_reply}</div> : null}
                  <p className="mt-3 text-xs text-white/35">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </Shell>
  );
}
