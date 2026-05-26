"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";
import { COUNTRY_OPTIONS, getDialCode } from "@/lib/countries";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

const initialForm = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  password: "",
  phone: "+212",
  country: "Morocco",
  city: "",
};

const MOROCCO_PREFIX = "+212";
const MOROCCO_PHONE_REGEX = /^\+212[5-7]\d{8}$/;

function sanitizePhoneInput(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return MOROCCO_PREFIX;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  // Keep normalized +212 prefix no matter what RTL/LTR visual context does.
  if (digits.startsWith("212")) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith("0")) {
    return `${MOROCCO_PREFIX}${digits.slice(1, 10)}`;
  }
  if (hasPlus) {
    return `+${digits.slice(0, 12)}`;
  }
  return `${MOROCCO_PREFIX}${digits.slice(0, 9)}`;
}

export default function AgentAddPlayerPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [phoneError, setPhoneError] = useState("");

  const updateCountry = (country: string) => {
    setForm((prev) => ({
      ...prev,
      country,
      phone: getDialCode(country) || prev.phone,
    }));
  };

  const submit = async () => {
    const user = await requireMobcashUserOnClient("agent");
    if (!user) return void redirectToLogin();

    const normalizedPhone = sanitizePhoneInput(form.phone);
    if (!MOROCCO_PHONE_REGEX.test(normalizedPhone)) {
      setPhoneError("Phone must be a valid Moroccan number (example: +212612345678).");
      return;
    }

    setPhoneError("");
    setSaving(true);

    const res = await fetch("/api/agent/add-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: normalizedPhone, agentEmail: user.email }),
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

  const resetPage = () => {
    setResult(null);
    setForm(initialForm);
  };

  const copyMessage = async () => {
    if (!result?.credentials?.messageText) return;
    await navigator.clipboard.writeText(result.credentials.messageText);
    alert("Message copied successfully");
    resetPage();
  };

  if (result) {
    return (
      <SidebarShell role="agent">
        <PageHeader
          title="Player created successfully"
          subtitle="The player account is ready and active. Copy the official message, then create another player."
        />

        <GlassCard className="p-6 md:p-8">
          <div className="space-y-3 text-sm text-white/70">
            <p>
              Username:{" "}
              <span className="font-semibold text-white">
                {result.credentials?.username}
              </span>
            </p>
            <p>
              Password:{" "}
              <span className="font-semibold text-white">
                {result.credentials?.password}
              </span>
            </p>
          </div>

          <div className="mt-5">
            <TextArea
              rows={16}
              value={result?.credentials?.messageText || ""}
              readOnly
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={copyMessage}>
              <Copy size={16} className="mr-2 inline-block" />
              Copy Message
            </PrimaryButton>

            {result?.player?.phone ? (
              <a
                href={`https://wa.me/${String(result.player.phone).replace(/\D/g, "")}?text=${encodeURIComponent(result.credentials.messageText)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <MessageCircle size={16} className="mr-2 inline-block" />
                WhatsApp
              </a>
            ) : null}

            {result?.user?.email ? (
              <a
                href={`mailto:${encodeURIComponent(result.user.email)}?subject=${encodeURIComponent("Your official login information")}&body=${encodeURIComponent(result.credentials.messageText)}`}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Mail size={16} className="mr-2 inline-block" />
                Email
              </a>
            ) : null}

            <button
              onClick={resetPage}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Create another player
            </button>
          </div>
        </GlassCard>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Add a player"
        subtitle="Create a player account directly, link it instantly to your agent profile, activate it immediately and copy the official bilingual credentials message."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              placeholder="First name"
              value={form.first_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, first_name: e.target.value }))
              }
            />
            <TextField
              placeholder="Last name"
              value={form.last_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, last_name: e.target.value }))
              }
            />
            <TextField
              placeholder="Username"
              value={form.username}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, username: e.target.value }))
              }
            />
            <TextField
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <TextField
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
            <TextField
              placeholder="Phone"
              dir="ltr"
              inputMode="numeric"
              autoComplete="tel"
              pattern="^\+212[5-7]\d{8}$"
              maxLength={13}
              value={form.phone}
              onChange={(e) => {
                const next = sanitizePhoneInput(e.target.value);
                setForm((prev) => ({ ...prev, phone: next }));
                if (phoneError) setPhoneError("");
              }}
              className="text-left tracking-[0.02em]"
            />
            <p className="md:col-span-2 -mt-1 text-xs text-white/55">
              Format: <span dir="ltr" className="font-semibold text-white">+212612345678</span>
            </p>
            {phoneError ? (
              <p className="md:col-span-2 -mt-2 text-xs font-medium text-rose-300">{phoneError}</p>
            ) : null}
            <SelectField
              value={form.country}
              onChange={(e) => updateCountry(e.target.value)}
            >
              {COUNTRY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.dialCode})
                </option>
              ))}
            </SelectField>
            <TextField
              placeholder="City"
              value={form.city}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, city: e.target.value }))
              }
              className="md:col-span-2"
            />
          </div>

          <PrimaryButton
            onClick={submit}
            disabled={saving}
            className="mt-6 w-full md:w-auto"
          >
            {saving ? "Creating..." : "Create player now"}
          </PrimaryButton>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Official credentials message</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            After direct player creation, you can copy the ready-to-send message
            or open WhatsApp / email using the created contact details.
          </p>

          <div className="mt-5 space-y-4">
            <TextArea
              rows={16}
              value=""
              onChange={() => {}}
              placeholder="The generated credentials message will appear here after player creation."
            />
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}