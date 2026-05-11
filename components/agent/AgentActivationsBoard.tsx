
"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, StatusBadge, TextArea } from "@/components/ui";
import { toast } from "sonner";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { useAgentTranslation } from "@/hooks/useTranslation";

/** Player activations without `SidebarShell` (embedded in Add Requests tab). */
export function AgentActivationsBoard() {
  const { t } = useAgentTranslation();
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
    if (!res.ok) return alert(data.message || t("activations_error_activate"));
    const saved = localStorage.getItem("mobcash_user");
    if (saved) {
      const user = JSON.parse(saved);
      await load(user.email);
    }
    setBusyId(null);
    alert(data.message || t("activations_success_activated"));
  };

  const markDone = async (playerUserId: string) => {
    const res = await fetch("/api/agent/activations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerUserId, action: "done" }),
    });
    const data = await res.json();
    alert(data.message || t("activations_success_updated"));
  };

  const copyMessage = async (messageText: string) => {
    await navigator.clipboard.writeText(messageText);
    setSelectedMessage(messageText);
    toast.success(t("activations_copy_success_title"), {
      description: t("activations_copy_success_body"),
    });
  };

  if (loading) return <LoadingCard text={t("activations_loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("activations_title")} subtitle={t("activations_subtitle")} />
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {rows.map((row) => {
            const status = row.status === "active" ? "approved" : "pending";
            return (
              <GlassCard key={String(row.id ?? row.playerUserId ?? row.userId)} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{row.first_name || ""} {row.last_name || ""}</h3>
                    <p className="mt-2 text-sm text-white/55">{row.playerEmail}</p>
                    <p className="mt-2 text-sm text-white/45">{t("activations_username_label")} {row.username}</p>
                    <p className="mt-2 text-sm text-white/45">{t("activations_phone_label")} {row.phone || "—"}</p>
                    <div className="mt-3"><StatusBadge status={status} /></div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {row.status !== "active" ? (
                      <PrimaryButton onClick={() => activate(row.user_id)} disabled={busyId === row.user_id}>
                        {busyId === row.user_id ? t("activations_action_activating") : t("activations_action_activate")}
                      </PrimaryButton>
                    ) : null}
                    <PrimaryButton onClick={() => copyMessage(row.messageText)}> <Copy size={16} className="mr-2 inline-block" />{t("activations_action_copy_message")}</PrimaryButton>
                    <a href={`https://wa.me/${String(row.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(row.messageText)}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><MessageCircle size={16} className="mr-2 inline-block" />{t("activations_action_whatsapp")}</a>
                    <a href={`mailto:${encodeURIComponent(row.playerEmail)}?subject=${encodeURIComponent(t("activations_email_subject"))}&body=${encodeURIComponent(row.messageText)}`} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><Mail size={16} className="mr-2 inline-block" />{t("activations_action_email")}</a>
                    <button onClick={() => markDone(row.user_id)} className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20">{t("activations_action_done_sending")}</button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
          {!rows.length ? <GlassCard className="p-10 text-center text-white/65">{t("activations_empty")}</GlassCard> : null}
        </div>
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">{t("activations_preview_title")}</h2>
          <TextArea rows={18} value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} className="mt-5" />
        </GlassCard>
      </div>
    </div>
  );
}
