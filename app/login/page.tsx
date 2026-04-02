"use client";

import Link from "next/link";
import { useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, Shell, TextField } from "@/components/ui";
import { useLanguage } from "@/components/language";

export default function LoginPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) return alert("Username/email and password are required");
    setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Login failed"); setLoading(false); return; }
      localStorage.setItem("mobcash_user", JSON.stringify(data.user));
      if (data.user.role === "admin") window.location.href = "/admin/dashboard";
      if (data.user.role === "agent") window.location.href = "/agent/dashboard";
      if (data.user.role === "player") window.location.href = data.user.assigned_agent_id ? "/player/dashboard" : "/player/select-agent";
    } catch (error) { console.error(error); alert("Network error"); }
    setLoading(false);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title={t("login")} subtitle={t("heroBody")} />
        <div className="grid gap-6">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-2xl font-semibold">{t("login")}</h2>
            <div className="mt-6 space-y-4">
              <TextField placeholder="Username or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              <TextField type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <PrimaryButton onClick={handleLogin} disabled={loading} className="w-full">{loading ? t("processing") : t("login")}</PrimaryButton>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/60">
              <Link href="/register/player" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10">{t("createPlayer")}</Link>
              <Link href="/apply/agent" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10">{t("becomeAgent")}</Link>
            </div>
          </GlassCard>
         
        </div>
      </div>
    </Shell>
  );
}
