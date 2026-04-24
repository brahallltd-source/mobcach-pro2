"use client";

import { Loader2 } from "lucide-react";
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
import { useToast } from "@/components/toast";

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

function formatDh(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 2 }).format(n)} DH`;
}

/** Numeric display for the live formula (no currency suffix). */
function formatNum(value: number): string {
  return new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );
}

export default function AdminUsersManagementPage() {
  const { showToast } = useToast();
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
  /** Manual-adjust bonus % (platform default from System settings). */
  const [systemBonusPct, setSystemBonusPct] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users/list", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      showToast({ type: "error", title: data.message || "تعذر تحميل المستخدمين" });
      setUsers([]);
      return;
    }
    setUsers(data.users || []);
  }, [showToast]);

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
      showToast({
        type: "error",
        title: String(data.message || "فشل التحديث"),
      });
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
        showToast({ type: "error", title: String(data.message || "تعذّر تغيير التجميد") });
        return;
      }
      if (data.user) {
        setUsers((prev) => prev.map((row) => (row.id === data.user.id ? { ...row, ...data.user } : row)));
      } else {
        await load();
      }
      showToast({
        type: "success",
        title: String(data.message || (data.frozen ? "تم التجميد" : "تم إلغاء التجميد")),
      });
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
      showToast({
        type: "success",
        title: "تم تحديث حالة الحساب بنجاح",
      });
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
      showToast({
        type: "error",
        title: "مبلغ الخصم أكبر من الرصيد المتاح",
        message: "فعّل «السماح برصيد سالب» إن كانت السياسة تسمح بذلك، أو قلّل المبلغ.",
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
        showToast({
          type: "success",
          title: "تم تحديث بيانات المستخدم بنجاح",
          message: `الرصيد الجديد: ${formatDh(Number(data.newTotal))}`,
        });
      } else {
        showToast({ type: "success", title: "تم تحديث بيانات المستخدم بنجاح" });
      }
      closeEdit();
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="جاري تحميل المستخدمين..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="إدارة المستخدمين"
        subtitle="عرض جميع الحسابات، تفعيل أو تعطيل الحسابات، وتعديل البريد واسم المستخدم والدور."
      />

      <GlassCard className="mt-6 p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/55">بحث (بريد أو اسم مستخدم)</label>
            <TextField
              placeholder="ابحث…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/55">الدور</label>
            <SelectField value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
              <option value="all">الكل</option>
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
          المعروض:{" "}
          <span className="font-semibold text-white/60 tabular-nums">{filteredUsers.length}</span> من{" "}
          <span className="tabular-nums">{users.length}</span>
        </p>
      </GlassCard>

      <GlassCard className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-white/60">
              <th className="px-4 py-3 font-semibold">البريد</th>
              <th className="px-4 py-3 font-semibold">اسم المستخدم</th>
              <th className="px-4 py-3 font-semibold">الدور</th>
              <th className="min-w-[120px] px-4 py-3 font-semibold">علامات</th>
              <th className="px-4 py-3 font-semibold" dir="ltr">
                Wallet
              </th>
              <th className="px-4 py-3 font-semibold">الحالة</th>
              <th className="px-4 py-3 font-semibold">مجمّد</th>
              <th className="px-4 py-3 font-semibold">تاريخ الإنشاء</th>
              <th className="px-4 py-3 font-semibold">إجراءات</th>
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
                    {u.wallet != null ? `${Number(u.wallet.balance).toLocaleString()} DH` : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.status}</td>
                  <td className="px-4 py-3 text-white/70">
                    {u.frozen || String(u.accountStatus ?? "").toUpperCase() === "SUSPENDED" ? "نعم" : "لا"}
                  </td>
                  <td className="px-4 py-3 text-white/50" dir="ltr">
                    {new Date(u.createdAt).toLocaleString()}
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
                          ? "إلغاء التجميد"
                          : "تجميد"}
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
                        {active ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        تعديل
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users.length ? (
          <p className="p-8 text-center text-sm text-white/50">لا يوجد مستخدمون.</p>
        ) : !filteredUsers.length ? (
          <p className="p-8 text-center text-sm text-white/50">لا توجد نتائج تطابق التصفية.</p>
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
              تعديل المستخدم
            </h2>
            <p className="mt-1 text-xs text-white/45">
              تحديث البريد واسم المستخدم والدور، وتعديل رصيد المحفظة عبر الإضافة أو الخصم.
            </p>
            <div className="mt-4 flex gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setModalTab("edit")}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition",
                  modalTab === "edit" ? "bg-white text-slate-950" : "text-white/60 hover:bg-white/5"
                )}
              >
                التعديل
              </button>
              <button
                type="button"
                onClick={() => setModalTab("history")}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition",
                  modalTab === "history" ? "bg-white text-slate-950" : "text-white/60 hover:bg-white/5"
                )}
              >
                السجل (5 الأخيرة)
              </button>
            </div>

            {modalTab === "history" ? (
              <div className="mt-5">
                {historyLoading ? (
                  <p className="py-8 text-center text-sm text-white/50">جاري التحميل…</p>
                ) : balanceHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/50">لا يوجد تعديلات يدوية مسجّلة.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04] text-white/50">
                          <th className="px-3 py-2 font-semibold">التاريخ</th>
                          <th className="px-3 py-2 font-semibold">الإداري</th>
                          <th className="px-3 py-2 font-semibold">العملية</th>
                          <th className="px-3 py-2 font-semibold">المبلغ</th>
                          <th className="px-3 py-2 font-semibold">بونص</th>
                          <th className="px-3 py-2 font-semibold">قبل → بعد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceHistory.map((row) => (
                          <tr key={row.id} className="border-b border-white/5 text-white/80">
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {new Date(row.createdAt).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{row.adminUsername || row.adminEmail}</td>
                            <td className="px-3 py-2 font-semibold">{row.operation}</td>
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {formatNum(row.amount)}
                            </td>
                            <td className="px-3 py-2">{row.bonusApplied ? "نعم" : "—"}</td>
                            <td className="px-3 py-2 tabular-nums text-white/70" dir="ltr">
                              {formatNum(row.previousBalance)} → {formatNum(row.newBalance)}
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
                <label className="mb-1 block text-xs font-medium text-white/60">البريد</label>
                <TextField value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/60">اسم المستخدم</label>
                <TextField value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/60">الدور</label>
                <SelectField value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="AGENT">AGENT</option>
                  <option value="PLAYER">PLAYER</option>
                </SelectField>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                  Adjustment Tool
                </p>
                <p className="mt-2 text-xs font-medium text-white/50">Current balance (read-only)</p>
                <p className="text-2xl font-bold tabular-nums text-white" dir="ltr">
                  {formatDh(editWalletBaseline)}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/55" dir="ltr">
                      adjustmentAmount (DH)
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
                    <label className="mb-1 block text-xs font-medium text-white/55">Operation</label>
                    <div className="flex rounded-2xl border border-white/10 p-1" role="group" aria-label="Balance operation">
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
                        Add
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
                        Subtract
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
                  <span>
                    إضافة بونص {systemBonusPct}% تلقائياً (عند الإضافة فقط — من إعدادات المنصّة)
                  </span>
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
                    <span>{formatNum(editWalletBaseline)}</span>{" "}
                    <span className="text-white">{balanceOperation === "add" ? "+" : "−"}</span>{" "}
                    <span>
                      {adjustmentParsed.valid && adjustmentParsed.value > 0
                        ? formatNum(adjustmentParsed.value)
                        : formatNum(0)}
                    </span>
                    {bonusPortion > 0 ? (
                      <>
                        {" "}
                        <span className="text-white">+</span>{" "}
                        <span className="text-violet-300">{formatNum(bonusPortion)}</span>
                        <span className="text-xs font-semibold text-violet-200/80"> ({systemBonusPct}%)</span>
                      </>
                    ) : null}{" "}
                    <span className="text-white">=</span>{" "}
                    <span className="text-emerald-200">{formatNum(computedNewBalance)}</span>
                    <span className="ms-1 text-sm font-bold text-white/60">DH</span>
                  </p>
                  {adjustmentParsed.valid && adjustmentParsed.value > 0 ? (
                    <p className="mt-2 text-lg font-bold tabular-nums">
                      {(() => {
                        const dTotal = computedNewBalance - editWalletBaseline;
                        return (
                          <span className={dTotal >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {dTotal > 0 ? "+" : dTotal < 0 ? "−" : ""}
                            {formatNum(Math.abs(dTotal))} DH
                          </span>
                        );
                      })()}
                      <span className="ms-2 text-xs font-normal text-white/45">Δ delta</span>
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
                    <span>السماح برصيد سالب (سياسة العمل — مطلوب عند تجاوز الخصم للرصيد المتاح)</span>
                  </label>
                ) : null}

                {balanceAdjustmentBlocked ? (
                  <p className="mt-2 text-xs text-rose-300" role="alert">
                    لا يمكن خصم أكبر من الرصيد المتاح ما لم يُسمح بالرصيد السالب.
                  </p>
                ) : null}
                {!adjustmentParsed.valid && balanceAdjustment.trim() !== "" ? (
                  <p className="mt-2 text-xs text-rose-300" role="alert">
                    أدخل رقماً موجباً صالحاً للتعديل.
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
                إلغاء
              </button>
              <PrimaryButton
                type="button"
                onClick={() => void submitEdit()}
                disabled={saveBusy || balanceAdjustmentBlocked || modalTab !== "edit"}
              >
                {saveBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  "حفظ"
                )}
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </SidebarShell>
  );
}
