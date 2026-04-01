"use client";

import { useEffect, useState } from "react";
import { EXECUTION_TIME_OPTIONS } from "@/lib/payment-options";
import {
  DangerButton,
  GlassCard,
  LoadingCard,
  NavPill,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";

type User = { id: string; email: string; role: string; agentId?: string };
type Agent = { fullName?: string; email: string; phone?: string };
type Profile = { agentId: string; responseMinutes: number; rating?: number; tradesCount?: number };

export default function AgentSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", phone: "", responseMinutes: 15 });

  const load = async (agentId: string) => {
    const res = await fetch(`/api/agent/settings?agentId=${encodeURIComponent(agentId)}`, {
      cache: "no-store",
    });
    const data = await res.json();

    setAgent(data.agent || null);
    setProfile(data.profile || null);
    setForm({
      email: data.agent?.email || "",
      phone: data.agent?.phone || "",
      responseMinutes: Number(data.profile?.responseMinutes || 15),
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);
    if (current.agentId) load(current.agentId).finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  const save = async () => {
    if (!user?.agentId) return;
    setSaving(true);

    const res = await fetch("/api/agent/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: user.agentId, ...form }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to update settings");
      setSaving(false);
      return;
    }

    const updatedUser = { ...user, email: form.email };
    localStorage.setItem("mobcash_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    await load(user.agentId);
    alert(data.message || "Settings updated");
    setSaving(false);
  };

  const logout = () => {
    localStorage.removeItem("mobcash_user");
    window.location.href = "/login";
  };

  if (loading || !user) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="Loading settings..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Settings"
        subtitle="Keep your profile data clean here. Your profile, payment methods, bonus system and recharge balance are separated clearly for easier daily work."
        action={
          <div className="flex flex-wrap gap-3">
            <NavPill href="/agent/payment-methods" label="Payment methods" />
            <NavPill href="/agent/bonus" label="Bonus" />
            <NavPill href="/agent/recharge" label="Top up balance" />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Execution time"
          value={`${form.responseMinutes} min`}
          hint="Shown to players before they order"
        />
        <StatCard
          label="Rating"
          value={`${profile?.rating || 0}%`}
          hint="Visible in Select Agent and Achat"
        />
        <StatCard
          label="Trades"
          value={String(profile?.tradesCount || 0)}
          hint="Public volume used for trust"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Personal information</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Update your email, phone and task execution promise. These values are reflected
            throughout the player-facing purchase flow.
          </p>

          <div className="mt-6 space-y-4">
            <TextField value={agent?.fullName || ""} disabled placeholder="Full name" />
            <TextField
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
            />
            <TextField
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone number"
            />
            <SelectField
              value={String(form.responseMinutes)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, responseMinutes: Number(e.target.value) }))
              }
            >
              {EXECUTION_TIME_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </SelectField>
            <PrimaryButton onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save settings"}
            </PrimaryButton>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Workspace shortcuts</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-lg font-semibold">Payment methods</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Add Moroccan bank methods with required RIB, add cash channels like Cash
                  Plus and Wafacash, or configure crypto wallets.
                </p>
                <div className="mt-4">
                  <NavPill href="/agent/payment-methods" label="Open payment methods" />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-lg font-semibold">Bonus tasks</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Track invite progress with circular completion bars, claim rewards and
                  unlock higher levels.
                </p>
                <div className="mt-4">
                  <NavPill href="/agent/bonus" label="Open bonus" />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 md:col-span-2">
                <p className="text-lg font-semibold">Top up balance</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Use admin treasury methods to request wallet recharge starting from 1000
                  DH and monitor approval history.
                </p>
                <div className="mt-4">
                  <NavPill href="/agent/recharge" label="Open top up balance" />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Session</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Sign out from the agent workspace when you finish your review and payout
              operations.
            </p>
            <div className="mt-5">
              <DangerButton onClick={logout}>Logout</DangerButton>
            </div>
          </GlassCard>
        </div>
      </div>
    </SidebarShell>
  );
}