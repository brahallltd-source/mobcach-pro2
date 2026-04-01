
"use client";

import { useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, SelectField, Shell, TextField } from "@/components/ui";
import { useLanguage } from "@/components/language";
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";

export default function RegisterPlayerPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", email: "", password: "", phone: "+212", city: "", country: "Morocco", date_of_birth: "", agent_code: "" });
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateCountry = (country: string) => {
    setForm((prev) => ({ ...prev, country, phone: getDialCode(country) || prev.phone }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/register-player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Registration failed"); setLoading(false); return; }
      localStorage.setItem("mobcash_user", JSON.stringify(data.user));
      alert(data.message || "Player created successfully");
      window.location.href = data.nextStep === "select-agent" ? "/player/select-agent" : "/player/dashboard";
    } catch (error) { console.error(error); alert("Network error"); }
    setLoading(false);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader title={t("playerRegistration")} subtitle="Create a simpler player account, optionally use an agent code, otherwise continue directly to Select Agent." />
        <GlassCard className="p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField placeholder="First name" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            <TextField placeholder="Last name" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            <TextField required placeholder="Username" value={form.username} onChange={(e) => update("username", e.target.value)} />
            <TextField required type="email" placeholder="Email *" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <TextField required type="password" placeholder="Password *" value={form.password} onChange={(e) => update("password", e.target.value)} />
            <TextField required placeholder="Phone *" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            <TextField placeholder="City" value={form.city} onChange={(e) => update("city", e.target.value)} />
            <SelectField value={form.country} onChange={(e) => updateCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.dialCode})</option>)}
            </SelectField>
            <TextField type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
            <TextField placeholder={t("optionalAgentCode")} value={form.agent_code} onChange={(e) => update("agent_code", e.target.value)} className="md:col-span-2" />
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">Country selection now pre-fills the international dialing code. If you already have an agent code, your account will be linked automatically.</div>
          <PrimaryButton onClick={handleSubmit} disabled={loading} className="mt-6 w-full md:w-auto">{loading ? t("processing") : t("continueNext")}</PrimaryButton>
        </GlassCard>
      </div>
    </Shell>
  );
}
