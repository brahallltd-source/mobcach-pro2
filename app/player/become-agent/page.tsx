"use client";

import { useEffect, useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, Shell, StatusBadge, TextArea, TextField } from "@/components/ui";

type AppRecord = { id: string; fullName?: string; email: string; phone?: string; note?: string; status: string; createdAt?: string };

type SessionUser = { id: string; email?: string; username?: string; role?: string };

export default function PlayerBecomeAgentPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [current, setCurrent] = useState<AppRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (user: SessionUser) => {
    const params = new URLSearchParams();
    if (user.id) params.set("userId", user.id);
    if (user.email) params.set("email", user.email);
    const res = await fetch(`/api/player/become-agent?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setCurrent(data.application || null);
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    if (user.role !== "player") return void (window.location.href = "/login");
    setSessionUser(user);
    setEmail(user.email || "");
    load(user).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!sessionUser?.id) {
      alert("Missing session user");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/player/become-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: sessionUser.id,
          username: sessionUser.username,
          name,
          phone,
          email,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to submit application");
        setSaving(false);
        return;
      }
      setCurrent(data.application || null);
      alert(data.message || "Application submitted");
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setSaving(false);
  };

  if (loading) return <Shell><div className="mx-auto max-w-4xl"><GlassCard className="p-12 text-center">Loading become-agent workspace...</GlassCard></div></Shell>;

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="Become an agent" subtitle="Apply from the player side and let admin review your request without leaving the product flow." />
        {current ? (
          <GlassCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Application submitted</h2>
              <StatusBadge status={current.status} />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-white/70">
              <p><span className="text-white/45">Name:</span> {current.fullName || "—"}</p>
              <p><span className="text-white/45">Email:</span> {current.email}</p>
              <p><span className="text-white/45">Phone:</span> {current.phone || "—"}</p>
              <p><span className="text-white/45">Note:</span> {current.note || "—"}</p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField type="email" value={email} disabled className="md:col-span-2" />
            </div>
            <div className="mt-4"><TextArea rows={6} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <PrimaryButton onClick={submit} disabled={saving} className="mt-6 w-full md:w-auto">{saving ? "Submitting..." : "Submit application"}</PrimaryButton>
          </GlassCard>
        )}
      </div>
    </Shell>
  );
}
