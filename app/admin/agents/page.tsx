"use client";

import { useEffect, useState, useCallback } from "react";
import { localeForLang, useTranslation } from "@/lib/i18n";
import { SidebarShell, PageHeader, GlassCard, LoadingCard, TextField } from "@/components/ui";
import { Key, ShieldAlert, Edit2, Save, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";

type Agent = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  status: string;
  availableBalance: number;
  country: string;
};

export default function AgentListPage() {
  const { t, tx, lang } = useTranslation();
  const locale = localeForLang(lang);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  const statusLabel = useCallback(
    (status: string) => {
      const u = String(status ?? "").trim().toUpperCase();
      if (u === "ACTIVE") return tx("admin.agentsPage.statusActive");
      if (u === "SUSPENDED") return tx("admin.agentsPage.statusSuspended");
      return status;
    },
    [tx],
  );

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agents", { cache: "no-store" });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      toast.error(tx("admin.agentsPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const handleUpdateWallet = async (agentId: string) => {
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_balance", amount: newBalance }),
      });
      if (res.ok) {
        toast.success(tx("admin.agentsPage.balanceUpdated"));
        setEditingWalletId(null);
        void fetchAgents();
      } else {
        toast.error(tx("admin.agentsPage.balanceFailed"));
      }
    } catch {
      toast.error(tx("admin.agentsPage.networkError"));
    }
  };

  const handleResetPassword = async (agentId: string) => {
    const newPass = window.prompt(tx("admin.agentsPage.resetPasswordPrompt"));
    if (newPass && newPass.length >= 6) {
      try {
        const res = await fetch(`/api/admin/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_password", newPassword: newPass }),
        });
        if (res.ok) toast.success(tx("admin.agentsPage.passwordUpdated"));
        else toast.error(tx("admin.agentsPage.passwordError"));
      } catch {
        toast.error(tx("admin.agentsPage.passwordError"));
      }
    } else if (newPass) {
      toast.error(tx("admin.agentsPage.passwordTooShort"));
    }
  };

  const toggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const label = statusLabel(newStatus);
    if (window.confirm(tx("admin.agentsPage.confirmStatus", { status: label }))) {
      await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", status: newStatus }),
      });
      void fetchAgents();
    }
  };

  const handleDelete = async (agentId: string) => {
    if (window.confirm(tx("admin.agentsPage.confirmDelete"))) {
      const res = await fetch(`/api/admin/agents/${agentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(tx("admin.agentsPage.deleted"));
        void fetchAgents();
      } else {
        toast.error(tx("admin.agentsPage.deleteFailed"));
      }
    }
  };

  if (loading)
    return (
      <SidebarShell role="admin">
        <LoadingCard text={t("processing")} />
      </SidebarShell>
    );

  return (
    <SidebarShell role="admin">
      <PageHeader title={t("agents")} subtitle={tx("admin.agentsPage.subtitle")} />

      <div className="mt-6 grid gap-4">
        {agents.length === 0 ? (
          <GlassCard className="p-8 text-center text-white/50">{t("noOffers")}</GlassCard>
        ) : (
          agents.map((agent) => (
            <GlassCard
              key={agent.id}
              className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{agent.fullName || agent.username}</h3>
                  <span
                    className={clsx(
                      "rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                      agent.status === "ACTIVE"
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                        : "border-red-500/20 bg-red-500/5 text-red-400",
                    )}
                  >
                    {statusLabel(agent.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/40">
                  {agent.email} • {agent.country}
                </p>

                <div className="mt-3 flex items-center gap-3">
                  {editingWalletId === agent.id ? (
                    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-1">
                      <TextField
                        type="number"
                        className="h-8 w-24 px-2 text-xs"
                        value={newBalance}
                        onChange={(e) => setNewBalance(Number(e.target.value))}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => void handleUpdateWallet(agent.id)}
                        className="rounded-lg p-1.5 text-green-400 hover:bg-green-400/10"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingWalletId(null)}
                        className="rounded-lg p-1.5 text-white/30 hover:bg-white/10"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-2">
                      <p className="text-sm font-bold text-cyan-300">
                        {t("available")}:{" "}
                        <span className="text-lg" dir="ltr">
                          {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                            agent.availableBalance,
                          )}{" "}
                          DH
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWalletId(agent.id);
                          setNewBalance(agent.availableBalance);
                        }}
                        className="p-1.5 text-white/30 opacity-0 transition hover:text-white group-hover:opacity-100"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleResetPassword(agent.id)}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                >
                  <Key size={14} /> {tx("admin.agentsPage.password")}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleStatus(agent.id, agent.status)}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl border border-white/5 px-4 py-2 text-xs font-semibold transition",
                    agent.status === "ACTIVE"
                      ? "text-amber-400 hover:bg-amber-400/10"
                      : "text-emerald-400 hover:bg-emerald-400/10",
                  )}
                >
                  <ShieldAlert size={14} />{" "}
                  {agent.status === "ACTIVE" ? tx("admin.agentsPage.suspend") : tx("admin.agentsPage.activate")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(agent.id)}
                  className="flex items-center gap-2 rounded-xl border border-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
                >
                  <Trash2 size={14} /> {tx("admin.agentsPage.delete")}
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </SidebarShell>
  );
}
