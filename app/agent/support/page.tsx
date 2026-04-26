"use client";

import { clsx } from "clsx";
import { Facebook, Globe, Instagram, Loader2, Send } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";
import { toast } from "sonner";
import { ImageUploader } from "@/components/ImageUploader";
import { useAgentTranslation } from "@/hooks/useTranslation";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  isReadByAdmin: boolean;
  isReadByAgent: boolean;
  createdAt: string;
  updatedAt: string;
};

function isOpen(t: Ticket) {
  return String(t.status).toUpperCase() === "OPEN";
}

const GOSPORT = "https://www.gosport365.com";

export default function AgentSupportPage() {
  const { t } = useAgentTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/support", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || "Failed to load tickets"));
        setTickets([]);
        return;
      }
      setTickets(Array.isArray(j.tickets) ? j.tickets : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAgentRead = useCallback(async (ticketId: string) => {
    try {
      const res = await fetch("/api/agent/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketId }),
      });
      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, isReadByAgent: true } : t))
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleExpand = (t: Ticket) => {
    const next = expandedId === t.id ? null : t.id;
    setExpandedId(next);
    if (next === t.id && t.adminReply && !t.isReadByAgent) {
      void markAgentRead(t.id);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const bodyMessage =
        screenshotUrl.trim() !== ""
          ? `${message.trim()}\n\n[Screenshot](${screenshotUrl.trim()})`
          : message.trim();
      const res = await fetch("/api/agent/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, message: bodyMessage }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || "Failed to send"));
        return;
      }
      setSubject("");
      setMessage("");
      setScreenshotUrl("");
      toast.success("Ticket submitted");
      await load();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text={t("requests_loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader title={t("support_page_title")} subtitle={t("support_page_subtitle")} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GlassCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-white">{t("support_new_ticket")}</h2>
          <div>
            <label className="mb-1 block text-xs text-white/55">{t("support_subject")}</label>
            <TextField
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='مثال: تأخير في الشحن، استفسار عن الحساب'
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/55">{t("support_message")}</label>
            <TextArea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="صف المشكلة بالتفصيل…"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs text-white/55">{t("support_attach_screenshot")}</label>
            <ImageUploader value={screenshotUrl} onChange={setScreenshotUrl} selectButtonLabel={t("form_upload_proof")} />
          </div>
          <PrimaryButton
            type="button"
            disabled={saving || !subject.trim() || !message.trim()}
            onClick={() => void submit()}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("support_submitting")}
              </span>
            ) : (
              t("support_submit")
            )}
          </PrimaryButton>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">{t("support_tickets_title")}</h2>
            <p className="mt-1 text-xs text-white/45">{t("support_tickets_hint")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
                  <th className="px-4 py-3">{t("support_subject")}</th>
                  <th className="px-4 py-3">{t("table_status")}</th>
                  <th className="px-4 py-3">{t("support_admin_reply")}</th>
                  <th className="px-4 py-3">{t("table_date")}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-white/45">
                      {t("support_no_tickets")}
                    </td>
                  </tr>
                ) : (
                  tickets.map((row) => {
                    const expanded = expandedId === row.id;
                    const unreadReply = Boolean(row.adminReply) && !row.isReadByAgent;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={clsx(
                            "cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]",
                            expanded && "bg-white/[0.04]"
                          )}
                          onClick={() => toggleExpand(row)}
                        >
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="line-clamp-2">{row.subject}</span>
                              {unreadReply ? (
                                <span className="shrink-0 rounded-md bg-sky-500/25 px-1.5 py-0.5 text-[10px] font-bold text-sky-100">
                                  رد جديد
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                isOpen(row)
                                  ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200"
                                  : "rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/60"
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="max-w-[200px] px-4 py-3 text-white/55">
                            {row.adminReply ? (
                              <span className="line-clamp-2">{row.adminReply}</span>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40" dir="ltr">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${row.id}-detail`} className="border-b border-white/10 bg-black/25">
                            <td colSpan={4} className="px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                                {t("support_message_label")}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-white/75">{row.message}</p>
                              {row.adminReply ? (
                                <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-cyan-50">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                                    {t("support_admin_reply")}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{row.adminReply}</p>
                                </div>
                              ) : (
                                <p className="mt-4 text-xs text-white/40">{t("support_no_reply")}</p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <footer className="mt-10 border-t border-white/10 pt-8">
        <p className="mb-4 text-center text-sm font-medium text-white/55">{t("support_follow_us")}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={GOSPORT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100"
            aria-label="Facebook"
          >
            <Facebook className="h-5 w-5" />
          </a>
          <a
            href={GOSPORT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100"
            aria-label="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href={GOSPORT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100"
            aria-label="Telegram"
          >
            <Send className="h-5 w-5" />
          </a>
          <a
            href={GOSPORT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100"
            aria-label="Website"
          >
            <Globe className="h-5 w-5" />
          </a>
        </div>
      </footer>
    </SidebarShell>
  );
}
