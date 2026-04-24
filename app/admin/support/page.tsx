"use client";

import { clsx } from "clsx";
import { Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
} from "@/components/ui";
import { useToast } from "@/components/toast";

type Ticket = {
  id: string;
  agentId: string;
  agentEmail: string;
  agentUsername: string;
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

export default function AdminSupportPage() {
  return (
    <Suspense
      fallback={
        <SidebarShell role="admin">
          <LoadingCard text="Loading inbox…" />
        </SidebarShell>
      }
    >
      <AdminSupportInboxBody />
    </Suspense>
  );
}

function AdminSupportInboxBody() {
  const searchParams = useSearchParams();
  const urlTicket = searchParams.get("ticket");
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "Failed to load") });
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

  const openTickets = useMemo(() => tickets.filter(isOpen), [tickets]);
  const closedTickets = useMemo(() => tickets.filter((t) => !isOpen(t)), [tickets]);

  const selected = useMemo(
    () => (selectedId ? tickets.find((t) => t.id === selectedId) ?? null : null),
    [tickets, selectedId]
  );

  useEffect(() => {
    if (tickets.length === 0) return;
    setSelectedId((prev) => {
      if (urlTicket && tickets.some((t) => t.id === urlTicket)) return urlTicket;
      if (prev && tickets.some((t) => t.id === prev)) return prev;
      return tickets.find(isOpen)?.id ?? null;
    });
  }, [tickets, urlTicket]);

  const markAdminRead = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/admin/support/tickets/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isReadByAdmin: true }),
        });
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isReadByAdmin: true } : t))
        );
      } catch {
        /* non-blocking */
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId) return;
    const t = tickets.find((x) => x.id === selectedId);
    if (t && !t.isReadByAdmin) {
      void markAdminRead(selectedId);
    }
  }, [selectedId, tickets, markAdminRead]);

  useEffect(() => {
    setReplyDraft("");
  }, [selectedId]);

  const sendReplyAndClose = async () => {
    if (!selected || !replyDraft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/support/reply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketId: selected.id, adminReply: replyDraft.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "Failed to send") });
        return;
      }
      showToast({ type: "success", title: "Reply sent and ticket closed" });
      setReplyDraft("");
      await load();
      setSelectedId(null);
    } catch {
      showToast({ type: "error", title: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const reopenTicket = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "OPEN" }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "Failed") });
        return;
      }
      showToast({ type: "success", title: "Ticket re-opened" });
      await load();
      setSelectedId(id);
    } catch {
      showToast({ type: "error", title: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading inbox…" />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Support inbox"
        subtitle="Open tickets on the left; select one to read the message, reply, and close. Closed tickets stay searchable below."
      />

      <div className="mt-6 flex min-h-[560px] flex-col gap-4 lg:flex-row lg:gap-0 lg:rounded-3xl lg:border lg:border-white/10 lg:overflow-hidden lg:bg-black/20">
        <aside className="flex w-full shrink-0 flex-col border-white/10 lg:w-[320px] lg:border-e lg:bg-black/30">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-200/90">مفتوحة</h2>
            <p className="text-[11px] text-white/40">{openTickets.length} ticket(s)</p>
          </div>
          <ul className="max-h-[280px] overflow-y-auto lg:max-h-none lg:flex-1">
            {openTickets.length === 0 ? (
              <li className="px-4 py-6 text-sm text-white/45">No open tickets.</li>
            ) : (
              openTickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={clsx(
                      "flex w-full flex-col gap-1 border-b border-white/5 px-4 py-3 text-start transition hover:bg-white/[0.04]",
                      selectedId === t.id && "bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/25"
                    )}
                  >
                    <span className="text-xs font-semibold text-white/90 line-clamp-2">{t.subject}</span>
                    <span className="text-[11px] text-white/45">
                      {t.agentUsername || t.agentEmail}
                    </span>
                    {!t.isReadByAdmin ? (
                      <span className="w-fit rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                        جديد
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-white/10 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">مغلقة (حديثاً)</h2>
          </div>
          <ul className="max-h-[200px] overflow-y-auto border-t border-white/5">
            {closedTickets.slice(0, 40).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={clsx(
                    "flex w-full flex-col gap-0.5 border-b border-white/5 px-4 py-2.5 text-start text-sm transition hover:bg-white/[0.03]",
                    selectedId === t.id && "bg-white/[0.06]"
                  )}
                >
                  <span className="line-clamp-1 text-white/70">{t.subject}</span>
                  <span className="text-[10px] text-white/35" dir="ltr">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
            {closedTickets.length === 0 ? (
              <li className="px-4 py-4 text-xs text-white/35">—</li>
            ) : null}
          </ul>
        </aside>

        <section className="min-w-0 flex-1 p-4 md:p-6">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/45">
              <MessageSquare className="h-10 w-10 opacity-40" aria-hidden />
              <p>Select a ticket from the list.</p>
            </div>
          ) : (
            <GlassCard className="space-y-5 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    {selected.agentUsername || selected.agentEmail}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">{selected.subject}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                    {selected.message}
                  </p>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    isOpen(selected)
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/10 text-white/55"
                  )}
                >
                  {selected.status}
                </span>
              </div>

              {selected.adminReply ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Previous admin reply</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{selected.adminReply}</p>
                </div>
              ) : null}

              {isOpen(selected) ? (
                <div className="space-y-3 border-t border-white/10 pt-5">
                  <label className="block text-sm font-medium text-white/80">Admin reply</label>
                  <TextArea
                    rows={6}
                    placeholder="Type your reply to the agent…"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                  />
                  <PrimaryButton
                    type="button"
                    disabled={busy || !replyDraft.trim()}
                    onClick={() => void sendReplyAndClose()}
                    className="inline-flex items-center gap-2"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Send Reply &amp; Close Ticket
                  </PrimaryButton>
                </div>
              ) : (
                <div className="border-t border-white/10 pt-5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reopenTicket(selected.id)}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Re-open ticket
                  </button>
                </div>
              )}

              <p className="text-xs text-white/35" dir="ltr">
                Created: {new Date(selected.createdAt).toLocaleString()} · Updated:{" "}
                {new Date(selected.updatedAt).toLocaleString()}
              </p>

              <p className="text-xs text-white/30">
                <Link href="/admin/notifications" className="text-cyan-300/90 underline-offset-2 hover:underline">
                  Notifications
                </Link>{" "}
                — agents receive an in-app alert when you close with a reply.
              </p>
            </GlassCard>
          )}
        </section>
      </div>
    </SidebarShell>
  );
}
