"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
  TextField,
} from "@/components/ui";
import { toast } from "sonner";

type FilterType = "all" | "pending" | "approved" | "rejected";

type AgentApplicationRecord = {
  id: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  country?: string;
  note?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

function buildAgentApprovalMessage(agent: AgentApplicationRecord) {
  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${agent.username || (agent.email || "").split("@")[0]}
- Password: Use the same password you registered with
- Email: ${agent.email || ""}

Please keep these credentials private.
These credentials are valid for GoSport365 MobCash.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${agent.username || (agent.email || "").split("@")[0]}
- Password: استخدم نفس كلمة المرور التي سجلت بها
- Email: ${agent.email || ""}

يرجى الحفاظ على هذه البيانات بشكل سري.
هذه البيانات صالحة للدخول إلى GoSport365 MobCash.`;
}

export default function AdminAgentsPage() {
  const [applications, setApplications] = useState<AgentApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState("");
  const [query, setQuery] = useState("");

  const loadApplications = async () => {
    const res = await fetch("/api/admin/agent-applications", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to load agent applications");
      return;
    }

    setApplications(data.data || []);
  };

  useEffect(() => {
    loadApplications().finally(() => setLoading(false));
  }, []);

  const filteredApplications = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return applications.filter((item) => {
      const statusOk = filter === "all" ? true : (item.status || "pending") === filter;
      if (!statusOk) return false;
      if (!cleanQuery) return true;
      return [item.fullName, item.username, item.email, item.phone, item.country]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(cleanQuery));
    });
  }, [applications, filter, query]);

  const copyMessage = async (messageText: string) => {
    await navigator.clipboard.writeText(messageText);
    setSelectedMessage(messageText);
    toast.success("Copied successfully", {
      description: "The message is ready to paste and send.",
    });
  };

  const handleAction = async (agentId: string, action: "approve" | "reject") => {
    try {
      setBusyId(agentId);

      const res = await fetch("/api/admin/agent-applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Action failed");
        return;
      }

      if (data.officialMessage) {
        setSelectedMessage(data.officialMessage);
      }

      await loadApplications();
      alert(data.message || "Updated successfully");
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading agent applications..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Agent applications"
        subtitle="Review pending requests, approve valid applications and keep the upgrade flow aligned with the main User table."
      />

      <GlassCard className="p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            {(["all", "pending", "approved", "rejected"] as FilterType[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${
                  filter === item
                    ? "bg-white text-slate-900"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, username, email or phone"
              className="pl-11"
            />
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {filteredApplications.map((agent) => {
            const displayName = agent.fullName || "Unnamed applicant";
            const createdValue = agent.createdAt;
            const status = agent.status || "pending";
            const officialMessage = buildAgentApprovalMessage(agent);

            return (
              <GlassCard key={agent.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{displayName}</h3>
                    <p className="mt-2 text-sm text-white/55">{agent.email}</p>
                    <p className="mt-2 text-sm text-white/45">Username: {agent.username || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Phone: {agent.phone || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Country: {agent.country || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Created: {createdValue ? new Date(createdValue).toLocaleString() : "—"}</p>
                    {agent.note ? <p className="mt-2 text-sm text-white/50">Note: {agent.note}</p> : null}
                    <div className="mt-3"><StatusBadge status={status} /></div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {status === "pending" ? (
                      <>
                        <PrimaryButton onClick={() => handleAction(agent.id, "approve")} disabled={busyId === agent.id}>
                          {busyId === agent.id ? "Processing..." : "Approve"}
                        </PrimaryButton>
                        <button
                          onClick={() => handleAction(agent.id, "reject")}
                          disabled={busyId === agent.id}
                          className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {busyId === agent.id ? "Processing..." : "Reject"}
                        </button>
                      </>
                    ) : null}

                    {status === "approved" ? (
                      <PrimaryButton onClick={() => copyMessage(officialMessage)}>
                        <Copy size={16} className="mr-2 inline-block" />
                        Copy Approval Message
                      </PrimaryButton>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {!filteredApplications.length ? (
            <GlassCard className="p-10 text-center text-white/65">
              No applications found for this filter.
            </GlassCard>
          ) : null}
        </div>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Official message preview</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Use this when admin approves a new agent account. The approved agent keeps the same password used during registration.
          </p>
          <TextArea rows={18} value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} className="mt-5" />
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
