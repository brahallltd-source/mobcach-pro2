
"use client";

import { useEffect, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, TextField } from "@/components/ui";

const ALL_PERMISSIONS = [
  { key: "overview", label: "Overview" },
  { key: "agents", label: "Agents" },
  { key: "players", label: "Players" },
  { key: "orders", label: "Orders" },
  { key: "fraud", label: "Fraud" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "wallets", label: "Wallets & Recharge Requests" },
  { key: "branding", label: "Branding" },
  { key: "notifications", label: "Notifications" },
  { key: "bonus_claims", label: "Bonus Claims" },
];

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "123456",
    permissions: ["overview", "orders", "notifications"] as string[],
  });

  const load = async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    setAdmins(data.admins || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((item) => item !== key)
        : [...prev.permissions, key],
    }));
  };

  const submit = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to create admin");
      setSaving(false);
      return;
    }
    await load();
    alert(data.message || "Admin created");
    setForm({ email: "", username: "", password: "123456", permissions: ["overview", "orders", "notifications"] });
    setSaving(false);
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading admin management..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Admin management"
        subtitle="Create new admins, assign clear permissions and keep the role system expandable instead of mixing every responsibility into one account."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Create admin</h2>
          <div className="mt-5 grid gap-4">
            <TextField placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            <TextField placeholder="Username" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
            <TextField placeholder="Password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white/85">Role permissions</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {ALL_PERMISSIONS.map((permission) => (
                  <button
                    key={permission.key}
                    type="button"
                    onClick={() => togglePermission(permission.key)}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      form.permissions.includes(permission.key)
                        ? "bg-white text-slate-950"
                        : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {permission.label}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryButton onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create admin"}</PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Existing admins</h2>
          <div className="mt-5 space-y-3">
            {admins.map((admin) => (
              <div key={admin.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-lg font-semibold">{admin.username || admin.email}</p>
                <p className="mt-1 text-sm text-white/55">{admin.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(admin.permissions || ["full_access"]).map((permission: string) => (
                    <span key={permission} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{permission}</span>
                  ))}
                </div>
              </div>
            ))}
            {!admins.length ? <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">No additional admins yet.</div> : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
