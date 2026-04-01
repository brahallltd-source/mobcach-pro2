
"use client";

import { useState } from "react";
import { GlassCard, PageHeader, PrimaryButton, SelectField, Shell, TextArea, TextField } from "@/components/ui";
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";

export default function ApplyAgentPage() {
  const [form, setForm] = useState({ full_name: "", username: "", email: "", password: "123456", phone: "+212", country: "Morocco", note: "" });
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateCountry = (country: string) => setForm((prev) => ({ ...prev, country, phone: getDialCode(country) || prev.phone }));

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apply-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Application failed"); setLoading(false); return; }
      alert(data.message || "Application submitted");
      window.location.href = "/login";
    } catch (error) { console.error(error); alert("Network error"); }
    setLoading(false);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader title="Become an agent" subtitle="Submit a cleaner application for admin review with username-based access and easier phone/country entry." />
        <GlassCard className="p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField placeholder="Full name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
            <TextField placeholder="Username" value={form.username} onChange={(e) => update("username", e.target.value)} />
            <TextField type="email" placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <TextField type="password" placeholder="Temporary password" value={form.password} onChange={(e) => update("password", e.target.value)} />
            <TextField placeholder="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            <SelectField value={form.country} onChange={(e) => updateCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.dialCode})</option>)}
            </SelectField>
          </div>
          <div className="mt-4"><TextArea rows={5} placeholder="Why do you want to become an agent?" value={form.note} onChange={(e) => update("note", e.target.value)} /></div>
          <PrimaryButton onClick={submit} disabled={loading} className="mt-6 w-full md:w-auto">{loading ? "Submitting..." : "Submit application"}</PrimaryButton>
        </GlassCard>
      </div>
    </Shell>
  );
}
