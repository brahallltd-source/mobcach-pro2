"use client";

import { Key, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { FlagBadges } from "@/components/FlagBadges";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { toast } from "sonner";
import { PasswordResetModal } from "@/components/admin/PasswordResetModal";
import { localeForLang, useTranslation } from "@/lib/i18n";

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  frozen: boolean;
  accountStatus?: string;
  displayFlags?: string[];
  createdAt: string;
  updatedAt: string;
  wallet?: { balance: number } | null;
};

type RoleFilter = "all" | "ADMIN" | "AGENT" | "PLAYER";
type StatusFilter = "all" | "ACTIVE" | "INACTIVE";
type BalanceOp = "add" | "subtract";
type ModalTab = "edit" | "history";

type BalanceHistoryRow = {
  id: string;
  adminEmail: string;
  adminUsername: string;
  amount: number;
  operation: string;
  bonusApplied: boolean;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
};

function normStatus(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

function normRole(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

function formatDh(value: number, locale: string): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)} DH`;
}

/** Numeric display for the live formula (no currency suffix). */
function formatNum(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export default function AdminUsersManagementPage() {
  const { tx, lang } = useTranslation();
  const locale = useMemo(() => localeForLang(lang), [lang]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("PLAYER");
  const [editWalletBaseline, setEditWalletBaseline] = useState(0);
  const [balanceAdjustment, setBalanceAdjustment] = useState("");
  const [balanceOperation, setBalanceOperation] = useState<BalanceOp>("add");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [applyBonus10, setApplyBonus10] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("edit");
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [freezeBusyId, setFreezeBusyId] = useState<string | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserRow | null>(null);
  /** Manual-adjust bonus % (platform default from System settings). */
  const [systemBonusPct, setSystemBonusPct] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users/list", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(String(data.message || tx("admin.users.loadError")));
      setUsers([]);
      return;
    }
    setUsers(data.users || []);
  }, [tx]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/system-settings", { credentials: "include", cache: "no-store" });
        const j = await r.json();
        if (cancelled || !r.ok) return;
        const p = Number(j.bonusPercentage);
        if (Number.isFinite(p) && p >= 0) setSystemBonusPct(p);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editOpen || !editUserId) return;
    let cancelled = false;
    setHistoryLoading(true);
    void (async () => {
      try {
        const r = await fetch(
          `/api/admin/users/balance-log?agentId=${encodeURIComponent(editUserId)}`,
          { credentials: "include", cache: "no-store" }
        );
        const j = await r.json();
        if (!cancelled) setBalanceHistory(Array.isArray(j.logs) ? j.logs : []);
      } catch {
        if (!cancelled) setBalanceHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, editUserId]);

  useEffect(() => {
    if (balanceOperation === "subtract") setApplyBonus10(false);
  }, [balanceOperation]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const email = String(u.email || "").toLowerCase();
        const username = String(u.username || "").toLowerCase();
        if (!email.includes(q) && !username.includes(q)) return false;
      }
      if (roleFilter !== "all" && normRole(u.role) !== roleFilter) return false;
      if (statusFilter !== "all" && normStatus(u.status) !== statusFilter) return false;
      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const patchUser = async (payload: {
    userId: string;
    status?: string;
    data?: {
      email?: string;
      username?: string;
      role?: string;
      balance?: string;
      newBalance?: string | number;
      newTotal?: string | number;
      allowNegativeBalance?: boolean;
      manualAdjust?: { baseAmount: number; operation: "ADD" | "SUB"; bonusApplied: boolean };
    };
    balance?: string | number;
    newBalance?: string | number;
    newTotal?: string | number;
    allowNegativeBalance?: boolean;
  }) => {
    const res = await fetch("/api/admin/users/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(data.message || tx("admin.users.updateFailed")));
      return false;
    }
    if (data.user) {
      setUsers((prev) => prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)));
    } else {
      await load();
    }
    return true;
  };

  const onToggleFreeze = async (u: UserRow) => {
    setFreezeBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/toggle-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: u.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(data.message || tx("admin.users.freezeError")));
        return;
      }
      if (data.user) {
        setUsers((prev) => prev.map((row) => (row.id === data.user.id ? { ...row, ...data.user } : row)));
      } else {
        await load();
      }
      toast.success(
        String(data.message || (data.frozen ? tx("admin.users.frozenSuccess") : tx("admin.users.unfrozenSuccess"))),
      );
    } finally {
      setFreezeBusyId(null);
    }
  };

  const onToggleStatus = async (u: UserRow) => {
    const st = normStatus(u.status);
    const next = st === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusBusyId(u.id);
    const ok = await patchUser({ userId: u.id, status: next });
    setStatusBusyId(null);
    if (ok) {
      toast.success(tx("admin.users.statusUpdated"));
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUserId(u.id);
    setEditEmail(u.email);
    setEditUsername(u.username);
    setEditRole(String(u.role || "PLAYER").trim().toUpperCase());
    setEditWalletBaseline(
      u.wallet != null && Number.isFinite(Number(u.wallet.balance)) ? Number(u.wallet.balance) : 0
    );
    setBalanceAdjustment("");
    setBalanceOperation("add");
    setAllowNegativeBalance(false);
    setApplyBonus10(false);
    setModalTab("edit");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditUserId(null);
    setSaveBusy(false);
    setModalTab("edit");
    setBalanceHistory([]);
  };

  const adjustmentParsed = useMemo(() => {
    const raw = balanceAdjustment.trim();
    if (raw === "") return { valid: false as const, value: 0 };
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return { valid: false as const, value: 0 };
    return { valid: true as const, value: n };
  }, [balanceAdjustment]);

  const bonusFraction = Number.isFinite(systemBonusPct) && systemBonusPct >= 0 ? systemBonusPct / 100 : 0.1;
  const bonusPortion =
    adjustmentParsed.valid &&
    adjustmentParsed.value > 0 &&
    balanceOperation === "add" &&
    applyBonus10
      ? adjustmentParsed.value * bonusFraction
      : 0;

  const computedNewBalance =
    !adjustmentParsed.valid || adjustmentParsed.value === 0
      ? editWalletBaseline
      : balanceOperation === "add"
        ? editWalletBaseline + adjustmentParsed.value + bonusPortion
        : editWalletBaseline - adjustmentParsed.value;

  /** Subtracting more than available balance ⇒ negative total, unless business flag allows it. */
  const balanceAdjustmentBlocked =
    adjustmentParsed.valid &&
    adjustmentParsed.value > 0 &&
    balanceOperation === "subtract" &&
    adjustmentParsed.value > editWalletBaseline &&
    !allowNegativeBalance;

  const submitEdit = async () => {
    if (!editUserId) return;
    if (balanceAdjustmentBlocked) {
      toast.error(tx("admin.users.subtractExceedsTitle"), {
        description: tx("admin.users.subtractExceedsMessage"),
      });
      return;
    }

    setSaveBusy(true);
    const data: {
      email: string;
      username: string;
      role: string;
      newTotal?: string;
      allowNegativeBalance?: boolean;
      manualAdjust?: { baseAmount: number; operation: "ADD" | "SUB"; bonusApplied: boolean };
    } = {
      email: editEmail,
      username: editUsername,
      role: editRole,
    };

    const shouldSendBalance = adjustmentParsed.valid && adjustmentParsed.value > 0;
    if (shouldSendBalance) {
      data.newTotal = String(computedNewBalance);
      data.manualAdjust = {
        baseAmount: adjustmentParsed.value,
        operation: balanceOperation === "add" ? "ADD" : "SUB",
        bonusApplied: balanceOperation === "add" && applyBonus10,
      };
      if (computedNewBalance < 0) {
        data.allowNegativeBalance = true;
      }
    }

    const ok = await patchUser({
      userId: editUserId,
      data,
    });
    setSaveBusy(false);
    if (ok) {
      if (data.newTotal !== undefined) {
        toast.success(tx("admin.users.userUpdated"), {
          description: tx("admin.users.userUpdatedWithBalance", {
            balance: formatDh(Number(data.newTotal), locale),
          }),
        });
      } else {
        toast.success(tx("admin.users.userUpdated"));
      }
      closeEdit();
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text={tx("admin.users.loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader title={tx("admin.users.pageTitle")} subtitle={tx("admin.users.pageSubtitle")} />

      <GlassCard className="mt-6 p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/55">{tx("admin.users.searchLabel")}</label>
            <TextField
              placeholder={tx("admin.users.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/55">{tx("admin.users.filterRole")}</label>
            <SelectField value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
              <option value="all">{tx("admin.common.all")}</option>
              <option value="ADMIN">ADMIN</option>
              <option value="AGENT">AGENT</option>
              <option value="PLAYER">PLAYER</option>
            </SelectField>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/55">الحالة</label>
            <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">الكل</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </SelectField>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/40" aria-live="polite" aria-atomic="true">
          {tx("admin.users.displayed", {
            filtered: String(filteredUsers.length),
            total: String(users.length),
          })}
        </p>
      </GlassCard>

      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-white/60">
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colEmail")}</th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colUsername")}</th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colRole")}</th>
              <th className="min-w-[120px] px-4 py-3 font-semibold">{tx("admin.users.colFlags")}</th>
              <th className="px-4 py-3 font-semibold" dir="ltr">
                {tx("admin.users.colWallet")}
              </th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colStatus")}</th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colFrozen")}</th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colCreated")}</th>
              <th className="px-4 py-3 font-semibold">{tx("admin.users.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const active = normStatus(u.status) === "ACTIVE";
              const busy = statusBusyId === u.id;
              const freezeBusy = freezeBusyId === u.id;
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white/90">{u.email}</td>
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3 text-white/70">{u.role}</td>
                  <td className="px-4 py-3 align-top">
                    <FlagBadges flags={u.displayFlags} />
                  </td>
                  <td className="px-4 py-3 text-white/70 tabular-nums" dir="ltr">
                    {u.wallet != null
                      ? `${Number(u.wallet.balance).toLocaleString(locale)} DH`
                      : tx("admin.common.dash")}
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.status}</td>
                  <td className="px-4 py-3 text-white/70">
                    {u.frozen || String(u.accountStatus ?? "").toUpperCase() === "SUSPENDED"
                      ? tx("admin.common.yes")
                      : tx("admin.common.no")}
                  </td>
                  <td className="px-4 py-3 text-white/50" dir="ltr">
                    {new Date(u.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={freezeBusy}
                        onClick={() => void onToggleFreeze(u)}
                        className={
                          u.frozen || String(u.accountStatus ?? "").toUpperCase() === "SUSPENDED"
                            ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            : "inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
                        }
                      >
                        {freezeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {u.frozen || String(u.accountStatus ?? "").toUpperCase() === "SUSPENDED"
                          ? tx("admin.users.unfreeze")
                          : tx("admin.users.freeze")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onToggleStatus(u)}
                        className={
                          active
                            ? "inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
                            : "inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                        }
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {active ? tx("admin.users.deactivate") : tx("admin.users.activate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordModalUser(u)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                        title={tx("admin.users.actions.change_password")}
                      >
                        <Key className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {tx("admin.users.actions.change_password")}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        {tx("admin.users.edit")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users.length ? (
          <p className="p-8 text-center text-sm text-white/50">{tx("admin.users.emptyUsers")}</p>
        ) : !filteredUsers.length ? (
          <p className="p-8 text-center text-sm text-white/50">{tx("admin.users.emptyFiltered")}</p>
        ) : null}
      </GlassCard>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <GlassCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 id="edit-user-title" className="text-lg font-bold text-white">
              {tx("admin.users.editTitle")}
            </h2>
            <p className="mt-1 text-xs text-white/45">{tx("admin.users.editSubtitle")}</p>
            <div className="mt-4 flex gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setModalTab("edit")}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition",
                  modalTab === "edit" ? "bg-white text-slate-950" : "text-white/60 hover:bg-white/5"
                )}
              >
                {tx("admin.users.tabEdit")}
              </button>
              <button
                type="button"
                onClick={() => setModalTab("history")}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition",
                  modalTab === "history" ? "bg-white text-slate-950" : "text-white/60 hover:bg-white/5"
                )}
              >
                {tx("admin.users.tabHistory")}
              </button>
            </div>

            {modalTab === "history" ? (
              <div className="mt-5">
                {historyLoading ? (
                  <p className="py-8 text-center text-sm text-white/50">{tx("admin.users.historyLoading")}</p>
                ) : balanceHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/50">{tx("admin.users.historyEmpty")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[520px] text-start text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04] text-white/50">
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColDate")}</th>
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColAdmin")}</th>
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColOp")}</th>
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColAmount")}</th>
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColBonus")}</th>
                          <th className="px-3 py-2 font-semibold">{tx("admin.users.historyColBeforeAfter")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceHistory.map((row) => (
                          <tr key={row.id} className="border-b border-white/5 text-white/80">
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {new Date(row.createdAt).toLocaleString(locale)}
                            </td>
                            <td className="px-3 py-2">{row.adminUsername || row.adminEmail}</td>
                            <td className="px-3 py-2 font-semibold">{row.operation}</td>
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {formatNum(row.amount, locale)}
                            </td>
                            <td className="px-3 py-2">
                              {row.bonusApplied ? tx("admin.common.yes") : tx("admin.common.dash")}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-white/70" dir="ltr">
                              {formatNum(row.previousBalance, locale)} → {formatNum(row.newBalance, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {modalTab === "edit" ? (
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.users.colEmail")}</label>
                <TextField value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.users.colUsername")}</label>
                <TextField value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.users.colRole")}</label>
                <SelectField value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="AGENT">AGENT</option>
                  <option value="PLAYER">PLAYER</option>
                </SelectField>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                  {tx("admin.users.adjustmentTool")}
                </p>
                <p className="mt-2 text-xs font-medium text-white/50">{tx("admin.users.currentBalance")}</p>
                <p className="text-2xl font-bold tabular-nums text-white" dir="ltr">
                  {formatDh(editWalletBaseline, locale)}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/55" dir="ltr">
                      {tx("admin.users.adjustmentAmountLabel")}
                    </label>
                    <TextField
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={balanceAdjustment}
                      onChange={(e) => setBalanceAdjustment(e.target.value)}
                      dir="ltr"
                      className={clsx(
                        balanceAdjustmentBlocked || (!adjustmentParsed.valid && balanceAdjustment.trim() !== "")
                          ? "ring-1 ring-rose-500/50"
                          : undefined
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/55">{tx("admin.users.operationLabel")}</label>
                    <div className="flex rounded-2xl border border-white/10 p-1" role="group" aria-label={tx("admin.users.ariaBalanceOp")}>
                      <button
                        type="button"
                        onClick={() => setBalanceOperation("add")}
                        className={clsx(
                          "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition",
                          balanceOperation === "add"
                            ? "bg-white text-slate-950 shadow"
                            : "text-white/65 hover:bg-white/5"
                        )}
                      >
                        {tx("admin.users.add")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceOperation("subtract")}
                        className={clsx(
                          "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition",
                          balanceOperation === "subtract"
                            ? "bg-white text-slate-950 shadow"
                            : "text-white/65 hover:bg-white/5"
                        )}
                      >
                        {tx("admin.users.subtract")}
                      </button>
                    </div>
                  </div>
                </div>

                <label
                  className={clsx(
                    "mt-3 flex cursor-pointer items-start gap-2 text-xs",
                    balanceOperation === "subtract" ? "cursor-not-allowed text-white/35" : "text-white/75"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={applyBonus10}
                    disabled={balanceOperation === "subtract"}
                    onChange={(e) => setApplyBonus10(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{tx("admin.users.bonusAuto", { pct: String(systemBonusPct) })}</span>
                </label>

                <div
                  className={clsx(
                    "mt-4 rounded-xl border px-3 py-3 tabular-nums",
                    balanceAdjustmentBlocked
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                      : "border-white/10 bg-black/25 text-white"
                  )}
                  dir="ltr"
                >
                  <p className="text-base font-bold leading-relaxed text-white">
                    <span>{formatNum(editWalletBaseline, locale)}</span>{" "}
                    <span className="text-white">{balanceOperation === "add" ? "+" : "−"}</span>{" "}
                    <span>
                      {adjustmentParsed.valid && adjustmentParsed.value > 0
                        ? formatNum(adjustmentParsed.value, locale)
                        : formatNum(0, locale)}
                    </span>
                    {bonusPortion > 0 ? (
                      <>
                        {" "}
                        <span className="text-white">+</span>{" "}
                        <span className="text-violet-300">{formatNum(bonusPortion, locale)}</span>
                        <span className="text-xs font-semibold text-violet-200/80"> ({systemBonusPct}%)</span>
                      </>
                    ) : null}{" "}
                    <span className="text-white">=</span>{" "}
                    <span className="text-emerald-200">{formatNum(computedNewBalance, locale)}</span>
                    <span className="ms-1 text-sm font-bold text-white/60">DH</span>
                  </p>
                  {adjustmentParsed.valid && adjustmentParsed.value > 0 ? (
                    <p className="mt-2 text-lg font-bold tabular-nums">
                      {(() => {
                        const dTotal = computedNewBalance - editWalletBaseline;
                        return (
                          <span className={dTotal >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {dTotal > 0 ? "+" : dTotal < 0 ? "−" : ""}
                            {formatNum(Math.abs(dTotal), locale)} DH
                          </span>
                        );
                      })()}
                      <span className="ms-2 text-xs font-normal text-white/45">{tx("admin.users.deltaLabel")}</span>
                    </p>
                  ) : null}
                </div>

                {balanceOperation === "subtract" &&
                adjustmentParsed.valid &&
                adjustmentParsed.value > editWalletBaseline ? (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-amber-200/90">
                    <input
                      type="checkbox"
                      checked={allowNegativeBalance}
                      onChange={(e) => setAllowNegativeBalance(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{tx("admin.users.allowNegative")}</span>
                  </label>
                ) : null}

                {balanceAdjustmentBlocked ? (
                  <p className="mt-2 text-xs text-rose-300" role="alert">
                    {tx("admin.users.blockedSubtractHint")}
                  </p>
                ) : null}
                {!adjustmentParsed.valid && balanceAdjustment.trim() !== "" ? (
                  <p className="mt-2 text-xs text-rose-300" role="alert">
                    {tx("admin.users.invalidAmountHint")}
                  </p>
                ) : null}
              </div>
            </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                {tx("admin.users.cancel")}
              </button>
              <PrimaryButton
                type="button"
                onClick={() => void submitEdit()}
                disabled={saveBusy || balanceAdjustmentBlocked || modalTab !== "edit"}
              >
                {saveBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tx("admin.users.saving")}
                  </span>
                ) : (
                  tx("admin.users.save")
                )}
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      ) : null}

      <PasswordResetModal
        open={passwordModalUser != null}
        onClose={() => setPasswordModalUser(null)}
        userId={passwordModalUser?.id ?? null}
        userLabel={
          passwordModalUser
            ? String(passwordModalUser.username || passwordModalUser.email || "").trim() ||
              passwordModalUser.id
            : ""
        }
        tx={tx}
      />
    </SidebarShell>
  );
}
