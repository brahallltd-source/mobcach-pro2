
"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { GlassCard, PageHeader, PrimaryButton, SelectField, SidebarShell, TextArea, TextField } from "@/components/ui";
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";

export default function AgentAddPlayerPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "123456",
    phone: "+212",
    country: "Morocco",
    city: "",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updateCountry = (country: string) => {
    setForm((prev) => ({ ...prev, country, phone: getDialCode(country) || prev.phone }));
  };

  const submit = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const user = JSON.parse(saved);
    setSaving(true);
    const res = await fetch("/api/agent/add-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, agentEmail: user.email }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to create player");
      setSaving(false);
      return;
    }
    setResult(data);
    setSaving(false);
  };

  const copyMessage = async () => {
    if (!result?.credentials?.messageText) return;
    await navigator.clipboard.writeText(result.credentials.messageText);
    alert("Message copied successfully");
  };

  return (
    <SidebarShell role="agent">
      <PageHeader title="Add a player" subtitle="Create a player account directly, link it instantly to your agent profile, activate it immediately and copy the official bilingual credentials message." />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField placeholder="First name" value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} />
            <TextField placeholder="Last name" value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} />
            <TextField placeholder="Username" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
            <TextField placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            <TextField placeholder="Password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            <TextField placeholder="Phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <SelectField value={form.country} onChange={(e) => updateCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.dialCode})</option>)}
            </SelectField>
            <TextField placeholder="City" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} className="md:col-span-2" />
          </div>
          <PrimaryButton onClick={submit} disabled={saving} className="mt-6 w-full md:w-auto">
            {saving ? "Creating..." : "Create player now"}
          </PrimaryButton>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Official credentials message</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">After direct player creation, you can copy the ready-to-send message or open WhatsApp / email using the created contact details.</p>
          <div className="mt-5 space-y-4">
            <TextArea rows={16} value={result?.credentials?.messageText || ""} onChange={() => {}} placeholder="The generated credentials message will appear here after player creation." />
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryButton onClick={copyMessage} disabled={!result?.credentials?.messageText}><Copy size={16} className="mr-2 inline-block" />Copy Message</PrimaryButton>
              {result?.player?.phone ? (
                <a href={`https://wa.me/${String(result.player.phone).replace(/\D/g, "")}?text=${encodeURIComponent(result.credentials.messageText)}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <MessageCircle size={16} className="mr-2 inline-block" />WhatsApp
                </a>
              ) : null}
              {result?.user?.email ? (
                <a href={`mailto:${encodeURIComponent(result.user.email)}?subject=${encodeURIComponent("Your official login information")}&body=${encodeURIComponent(result.credentials.messageText)}`} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <Mail size={16} className="mr-2 inline-block" />Email
                </a>
              ) : null}
            </div>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
