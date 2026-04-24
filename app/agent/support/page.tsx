"use client";

import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/components/toast";

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

export default function AgentSupportPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/support", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "Failed to load tickets") });
        setTickets([]);
        return;
      }
      setTickets(Array.isArray(j.tickets) ? j.tickets : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      const res = await fetch("/api/agent/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, message }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "Failed to send") });
        return;
      }
      setSubject("");
      setMessage("");
      showToast({ type: "success", title: "Ticket submitted" });
      await load();
    } catch {
      showToast({ type: "error", title: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="Loading support…" />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Support"
        subtitle="Open a ticket for the admin team. When an administrator replies, you will get an in-app notification and can read the reply here."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GlassCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-white">New ticket</h2>
          <div>
            <label className="mb-1 block text-xs text-white/55">Subject</label>
            <TextField
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='مثال: تأخير في الشحن، استفسار عن الحساب'
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/55">Message</label>
            <TextArea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="صف المشكلة بالتفصيل…"
            />
          </div>
          <PrimaryButton
            type="button"
            disabled={saving || !subject.trim() || !message.trim()}
            onClick={() => void submit()}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </span>
            ) : (
              "Submit ticket"
            )}
          </PrimaryButton>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Your tickets</h2>
            <p className="mt-1 text-xs text-white/45">اضغط على صف لعرض الرسالة ورد الإدارة.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Admin reply</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-white/45">
                      No tickets yet.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => {
                    const expanded = expandedId === t.id;
                    const unreadReply = Boolean(t.adminReply) && !t.isReadByAgent;
                    return (
                      <Fragment key={t.id}>
                        <tr
                          className={clsx(
                            "cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]",
                            expanded && "bg-white/[0.04]"
                          )}
                          onClick={() => toggleExpand(t)}
                        >
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="line-clamp-2">{t.subject}</span>
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
                                isOpen(t)
                                  ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200"
                                  : "rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/60"
                              }
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="max-w-[200px] px-4 py-3 text-white/55">
                            {t.adminReply ? (
                              <span className="line-clamp-2">{t.adminReply}</span>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40" dir="ltr">
                            {new Date(t.createdAt).toLocaleString()}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${t.id}-detail`} className="border-b border-white/10 bg-black/25">
                            <td colSpan={4} className="px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Message</p>
                              <p className="mt-2 whitespace-pre-wrap text-white/75">{t.message}</p>
                              {t.adminReply ? (
                                <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-cyan-50">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                                    Admin reply
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{t.adminReply}</p>
                                </div>
                              ) : (
                                <p className="mt-4 text-xs text-white/40">No admin reply yet.</p>
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
    </SidebarShell>
  );
}
