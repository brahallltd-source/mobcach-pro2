"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Copy, KeyRound, Loader2, Shield, Trash2 } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { toast } from "sonner";
import { defaultPermissionsForNewAdmin, isSuperAdminRole } from "@/lib/admin-permissions";
import { normalizeStoredPermissions, PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";

type AdminRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  permissions: unknown;
  createdAt: string;
  accountStatus: string;
  frozen: boolean;
};

type CreateAdminForm = {
  email: string;
  username: string;
  password: string;
  superAdmin: boolean;
  permissions: PermissionId[];
};

function permList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function siteBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [requester, setRequester] = useState<{ id: string; role: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateAdminForm>({
    email: "",
    username: "",
    password: "",
    superAdmin: false,
    permissions: defaultPermissionsForNewAdmin(),
  });

  const [successModal, setSuccessModal] = useState<{ username: string; password: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [pwdTarget, setPwdTarget] = useState<AdminRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [permModal, setPermModal] = useState<AdminRow | null>(null);
  const [permDraft, setPermDraft] = useState<PermissionId[]>([]);
  const [permBusy, setPermBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(data.message || "Failed to load admins"));
      setAdmins([]);
      return;
    }
    setAdmins(Array.isArray(data.admins) ? data.admins : []);
    if (data.requester && typeof data.requester === "object") {
      const rp = data.requester as { id?: unknown; role?: unknown; permissions?: unknown };
      setRequester({
        id: String(rp.id ?? ""),
        role: String(rp.role ?? ""),
        permissions: Array.isArray(rp.permissions) ? rp.permissions.map(String) : [],
      });
    } else {
      setRequester(null);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const canCreateSuper = useMemo(() => isSuperAdminRole(requester?.role), [requester]);

  const togglePermission = (key: PermissionId) => {
    setForm((prev) => {
      const next: PermissionId[] = prev.permissions.includes(key)
        ? prev.permissions.filter((item) => item !== key)
        : [...prev.permissions, key];
      return { ...prev, permissions: next };
    });
  };

  const togglePermDraft = (id: PermissionId) => {
    setPermDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePermModal = async () => {
    if (!permModal) return;
    setPermBusy(true);
    try {
      const res = await fetch("/api/admin/management/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: permModal.id, permissions: permDraft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(j.message || "Update failed"));
        return;
      }
      toast.success("Permissions saved");
      setPermModal(null);
      await load();
    } finally {
      setPermBusy(false);
    }
  };

  const permLabel = (id: string) => PERMISSIONS.find((p) => p.id === id)?.label ?? id;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password.trim() || undefined,
          role: form.superAdmin && canCreateSuper ? "SUPER_ADMIN" : "ADMIN",
          permissions: form.permissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(data.message || "Failed to create admin"));
        return;
      }
      await load();
      const temp = typeof data.temporaryPassword === "string" ? data.temporaryPassword : "";
      const un = String(data.admin?.username ?? form.username).trim();
      if (temp) {
        setSuccessModal({ username: un, password: temp });
      } else {
        toast.success("Admin created");
      }
      setForm({
        email: "",
        username: "",
        password: "",
        superAdmin: false,
        permissions: defaultPermissionsForNewAdmin(),
      });
    } finally {
      setSaving(false);
    }
  };

  const copyLoginInfo = async (username: string, password: string) => {
    const link = siteBaseUrl() || "[SiteURL]";
    const msg = `Hello, here are your admin credentials: User: ${username} | Pass: ${password} | Link: ${link}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const setSuspended = async (row: AdminRow, suspended: boolean) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/management/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: row.id, suspended }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(j.message || "Update failed"));
        return;
      }
      toast.success(suspended ? "Admin suspended" : "Admin activated");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(
        `/api/admin/management/delete?userId=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", credentials: "include" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(j.message || "Delete failed"));
        return;
      }
      toast.success("Admin removed");
      setDeleteTarget(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const saveNewPassword = async () => {
    if (!pwdTarget || newPwd.trim().length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwdBusy(true);
    try {
      const res = await fetch("/api/admin/management/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: pwdTarget.id, password: newPwd.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(String(j.message || "Failed"));
        return;
      }
      toast.success("Password updated");
      setPwdTarget(null);
      setNewPwd("");
    } finally {
      setPwdBusy(false);
    }
  };

  const isSuspended = (row: AdminRow) =>
    String(row.accountStatus).toUpperCase() === "SUSPENDED" || row.frozen;

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading admin management..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Admin management"
        subtitle="Create admins, assign permissions, suspend access, rotate passwords, or soft-remove accounts. Suspended admins cannot sign in."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">Create admin</h2>
          <p className="mt-1 text-xs text-white/45">
            Leave password empty to generate a temporary password (shown once after create).
          </p>
          <div className="mt-5 grid gap-4">
            <TextField
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
            <TextField
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            />
            <TextField
              placeholder="Password (optional)"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
            {canCreateSuper ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.superAdmin}
                  onChange={(e) => setForm((p) => ({ ...p, superAdmin: e.target.checked }))}
                  className="rounded border-white/20"
                />
                Create as SUPER_ADMIN
              </label>
            ) : null}
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white/85">Permissions</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {PERMISSIONS.map((permission) => (
                  <button
                    key={permission.id}
                    type="button"
                    onClick={() => togglePermission(permission.id)}
                    className={clsx(
                      "rounded-2xl px-4 py-3 text-sm font-medium transition",
                      form.permissions.includes(permission.id)
                        ? "bg-white text-slate-950"
                        : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                  >
                    {permission.label}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryButton onClick={() => void submit()} disabled={saving || !form.email.trim() || !form.username.trim()}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create admin"
              )}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0 md:p-0">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-2xl font-semibold text-white">Admins</h2>
            <p className="mt-1 text-xs text-white/45">Role and suspension badges; actions require MANAGE_USERS (or SUPER_ADMIN).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const suspended = isSuspended(admin);
                  const busy = busyId === admin.id;
                  const roleU = String(admin.role).toUpperCase();
                  return (
                    <tr key={admin.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{admin.username}</p>
                        <p className="text-xs text-white/45">{admin.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                            roleU === "SUPER_ADMIN"
                              ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                              : "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                          )}
                        >
                          {roleU}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                            suspended
                              ? "border-rose-500/45 bg-rose-600/20 text-rose-100"
                              : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                          )}
                        >
                          {suspended ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {permList(admin.permissions).length ? (
                            permList(admin.permissions).map((p) => (
                              <span
                                key={p}
                                className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/65"
                              >
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-white/35">All (legacy)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={
                              busy ||
                              (isSuperAdminRole(admin.role) && !isSuperAdminRole(requester?.role))
                            }
                            onClick={() => {
                              setPermModal(admin);
                              setPermDraft(normalizeStoredPermissions(admin.permissions));
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40"
                            title="Permissions"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            RBAC
                          </button>
                          <button
                            type="button"
                            disabled={busy || admin.id === requester?.id}
                            onClick={() => void setSuspended(admin, !suspended)}
                            className={clsx(
                              "rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40",
                              suspended
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            )}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : suspended ? "Activate" : "Suspend"}
                          </button>
                          <button
                            type="button"
                            disabled={busy || admin.id === requester?.id}
                            onClick={() => {
                              setPwdTarget(admin);
                              setNewPwd("");
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
                            title="Change password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Password
                          </button>
                          <button
                            type="button"
                            disabled={busy || admin.id === requester?.id}
                            onClick={() => setDeleteTarget(admin)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!admins.length ? (
              <div className="p-8 text-center text-sm text-white/50">No admins found.</div>
            ) : null}
          </div>
        </GlassCard>
      </div>

      {permModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <GlassCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Admin permissions</h3>
                <p className="mt-1 text-xs text-white/50">{permModal.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setPermModal(null)}
                className="rounded-xl border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/5"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {PERMISSIONS.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{p.label}</p>
                    <p className="mt-0.5 text-xs text-white/45">{p.description}</p>
                  </div>
                  <Switch
                    checked={permDraft.includes(p.id)}
                    onCheckedChange={() => togglePermDraft(p.id)}
                    aria-label={p.label}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton type="button" disabled={permBusy} onClick={() => void savePermModal()}>
                {permBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save permissions"}
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {successModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <GlassCard className="max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Admin created</h3>
            <p className="mt-2 text-sm text-white/65">Share these credentials securely. The password is not stored in plain text.</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/90">
              <p>
                <span className="text-white/50">User:</span> {successModal.username}
              </p>
              <p className="mt-2 font-mono text-xs" dir="ltr">
                <span className="text-white/50">Pass:</span> {successModal.password}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={() => void copyLoginInfo(successModal.username, successModal.password)}>
                <span className="inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Login Info
                </span>
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setSuccessModal(null)}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <GlassCard className="max-w-md p-6">
            <h3 className="text-lg font-semibold text-white">Remove admin?</h3>
            <p className="mt-2 text-sm text-white/65">
              This soft-deletes <strong className="text-white">{deleteTarget.username}</strong>. They will no longer be able to sign in.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Cancel
              </button>
              <PrimaryButton type="button" disabled={busyId === deleteTarget.id} onClick={() => void confirmDelete()}>
                {busyId === deleteTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm delete"}
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {pwdTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <GlassCard className="max-w-md p-6">
            <h3 className="text-lg font-semibold text-white">New password</h3>
            <p className="mt-1 text-xs text-white/50">{pwdTarget.username}</p>
            <div className="mt-4">
              <TextField
                type="password"
                placeholder="Min 8 characters"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPwdTarget(null);
                  setNewPwd("");
                }}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Cancel
              </button>
              <PrimaryButton type="button" disabled={pwdBusy} onClick={() => void saveNewPassword()}>
                {pwdBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </SidebarShell>
  );
}
