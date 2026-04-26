"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SelectField,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";
import { formatApiError } from "@/lib/format-api-error";
import { ADMIN_BANK_METHOD_OPTIONS, ADMIN_CASH_METHOD_OPTIONS } from "@/lib/constants/payment-methods";
import { toast } from "sonner";

type Method = {
  id: string;
  type: "bank" | "crypto" | "cash";
  method_name: string;
  currency: string;
  account_name?: string;
  rib?: string;
  wallet_address?: string;
  network?: string;
  provider?: string;
  phone?: string;
  instructions?: string;
  active?: boolean;
};

const EMPTY_FORM: Method = {
  id: "",
  type: "bank",
  method_name: "",
  currency: "MAD",
  account_name: "",
  rib: "",
  wallet_address: "",
  network: "",
  provider: "",
  phone: "",
  instructions: "",
  active: true,
};

function mergeMethodFromApi(row: Method, api: Record<string, unknown>): Method {
  const m = api as Partial<Method> & { isActive?: boolean };
  return {
    ...row,
    ...m,
    active: m.active ?? m.isActive ?? row.active,
  };
}

export default function AdminPaymentMethodsPage() {
  const [items, setItems] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Method>({ ...EMPTY_FORM });
  const [apiError, setApiError] = useState<string | null>(null);
  const [patchBusyId, setPatchBusyId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<Method | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/payment-methods", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        setApiError(msg);
        toast.error(msg, { duration: 8000 });
        setItems([]);
        return;
      }
      setApiError(null);
      setItems(data.methods || []);
    } catch {
      const msg = "Failed to load methods (network error)";
      setApiError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!form.method_name) return toast.error("Method name is required");
    setSaving(true);
    setApiError(null);
    const method = form.id ? "PUT" : "POST";
    const name = form.method_name.trim();
    const type = form.type;
    const accountName = String(form.account_name ?? "").trim();
    const accountNumber =
      form.type === "crypto"
        ? String(form.wallet_address ?? "").trim()
        : String(form.rib ?? "").trim();
    const isActive = Boolean(form.active);
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const body =
      method === "POST"
        ? JSON.stringify({ name, type, accountName, accountNumber, isActive })
        : JSON.stringify({
            id: form.id,
            name,
            type,
            accountName,
            accountNumber,
            isActive,
            currency: String(form.currency ?? "MAD").trim(),
            network: String(form.network ?? "").trim(),
            provider: String(form.provider ?? "").trim(),
            phone: String(form.phone ?? "").trim(),
            instructions: String(form.instructions ?? ""),
          });
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method,
        headers,
        credentials: "include",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        setApiError(msg);
        toast.error(msg, { duration: 8000 });
        return;
      }
      setApiError(null);
      toast.success("تم الحفظ بنجاح");
      setForm({ ...EMPTY_FORM });
      await load();
    } catch {
      const msg = "Error saving method (network error)";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteMethod = async (id: string) => {
    if (!confirm("Delete this method?")) return;
    try {
      const res = await fetch(`/api/admin/payment-methods?methodId=${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        setApiError(msg);
        toast.error(msg, { duration: 8000 });
        return;
      }
      setApiError(null);
      toast.success("تم الحذف بنجاح");
      await load();
    } catch {
      const msg = "Delete failed (network error)";
      setApiError(msg);
      toast.error(msg);
    }
  };

  const patchMethod = async (methodId: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ methodId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = formatApiError(data);
      setApiError(msg);
      toast.error(msg, { duration: 8000 });
      return false;
    }
    setApiError(null);
    if (data.data) {
      setItems((prev) =>
        prev.map((row) => (row.id === methodId ? mergeMethodFromApi(row, data.data as Record<string, unknown>) : row))
      );
    } else {
      await load();
    }
    return true;
  };

  const toggleActive = async (row: Method) => {
    const next = !row.active;
    setPatchBusyId(row.id);
    const ok = await patchMethod(row.id, { isActive: next });
    setPatchBusyId(null);
    if (ok) toast.success(next ? "تم تفعيل الظهور للوكلاء" : "تم إخفاء الطريقة عن الوكلاء");
  };

  const openEditModal = (row: Method) => {
    setEditModal({ ...row, active: row.active ?? true });
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditSaving(false);
  };

  const saveEditModal = async () => {
    if (!editModal) return;
    const m = editModal;
    const accountNumber =
      m.type === "crypto" ? String(m.wallet_address ?? "").trim() : String(m.rib ?? "").trim();
    setEditSaving(true);
    const ok = await patchMethod(m.id, {
      method_name: m.method_name.trim(),
      type: m.type,
      accountName: String(m.account_name ?? "").trim(),
      accountNumber,
      currency: String(m.currency ?? "MAD").trim(),
      network: String(m.network ?? "").trim(),
      phone: String(m.phone ?? "").trim(),
      provider: String(m.provider ?? "").trim(),
      instructions: String(m.instructions ?? "").trim(),
      isActive: !!m.active,
      fee_percent: 0,
    });
    setEditSaving(false);
    if (ok) {
      toast.success("تم تحديث طريقة الدفع بنجاح");
      closeEditModal();
    }
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Treasury Methods" subtitle="Manage methods visible to agents." />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] mt-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">{form.id ? "Edit Method" : "Create New Method"}</h2>
          {apiError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100 whitespace-pre-wrap break-words"
            >
              {apiError}
            </div>
          ) : null}
          <div className="grid gap-4">
            <SelectField
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as Method["type"];
                let method_name = form.method_name;
                if (type === "bank") {
                  const opts = ADMIN_BANK_METHOD_OPTIONS as readonly string[];
                  method_name =
                    method_name && opts.includes(method_name)
                      ? method_name
                      : (ADMIN_BANK_METHOD_OPTIONS[0] ?? "");
                } else if (type === "cash") {
                  const opts = ADMIN_CASH_METHOD_OPTIONS as readonly string[];
                  method_name =
                    method_name && opts.includes(method_name)
                      ? method_name
                      : (ADMIN_CASH_METHOD_OPTIONS[0] ?? "");
                }
                setForm({ ...form, type, method_name });
              }}
            >
              <option value="bank">Bank</option>
              <option value="crypto">Crypto</option>
              <option value="cash">Cash</option>
            </SelectField>
            {form.type === "bank" ? (
              <SelectField
                value={form.method_name}
                onChange={(e) => setForm({ ...form, method_name: e.target.value })}
              >
                {ADMIN_BANK_METHOD_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </SelectField>
            ) : form.type === "cash" ? (
              <SelectField
                value={form.method_name}
                onChange={(e) => setForm({ ...form, method_name: e.target.value })}
              >
                {ADMIN_CASH_METHOD_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <TextField
                placeholder="Method name (e.g. USDT)"
                value={form.method_name}
                onChange={(e) => setForm({ ...form, method_name: e.target.value })}
              />
            )}
            <TextField placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            {form.type === "bank" && (
              <>
                <TextField placeholder="Account Name" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                <TextField placeholder="RIB" value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} />
              </>
            )}
            {form.type === "crypto" && (
              <>
                <TextField placeholder="Wallet Address" value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} />
                <TextField placeholder="Network" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
              </>
            )}
            {form.type === "cash" && (
              <>
                <TextField placeholder="Account name / label" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                <TextField placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </>
            )}
            <TextArea placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            <PrimaryButton onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Method"}</PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-white/60">
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold">Visible</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const busy = patchBusyId === item.id;
                const active = !!item.active;
                return (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white">{item.method_name}</td>
                    <td className="px-4 py-3 text-white/70">{item.type}</td>
                    <td className="px-4 py-3 text-white/70">{item.currency}</td>
                    <td className="px-4 py-3 text-white/70">{active ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleActive(item)}
                          className={
                            active
                              ? "inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
                              : "inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                          }
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {active ? "تعطيل" : "تفعيل"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMethod(item.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length ? <p className="p-8 text-center text-sm text-white/50">No methods yet.</p> : null}
        </GlassCard>
      </div>

      {editModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pm-title"
        >
          <GlassCard className="w-full max-w-lg p-6">
            <h2 id="edit-pm-title" className="text-lg font-bold text-cyan-300">
              تعديل طريقة الدفع
            </h2>
            <p className="mt-1 text-xs text-white/45">تحديث التفاصيل والظهور للوكلاء.</p>
            <div className="mt-5 grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
              <SelectField
                value={editModal.type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const type = e.target.value as Method["type"];
                  let method_name = editModal.method_name;
                  if (type === "bank") {
                    const opts = ADMIN_BANK_METHOD_OPTIONS as readonly string[];
                    method_name =
                      method_name && opts.includes(method_name)
                        ? method_name
                        : (ADMIN_BANK_METHOD_OPTIONS[0] ?? "");
                  } else if (type === "cash") {
                    const opts = ADMIN_CASH_METHOD_OPTIONS as readonly string[];
                    method_name =
                      method_name && opts.includes(method_name)
                        ? method_name
                        : (ADMIN_CASH_METHOD_OPTIONS[0] ?? "");
                  }
                  setEditModal({ ...editModal, type, method_name });
                }}
              >
                <option value="bank">Bank</option>
                <option value="crypto">Crypto</option>
                <option value="cash">Cash</option>
              </SelectField>
              {editModal.type === "bank" ? (
                <SelectField
                  value={editModal.method_name}
                  onChange={(e) => setEditModal({ ...editModal, method_name: e.target.value })}
                >
                  {ADMIN_BANK_METHOD_OPTIONS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              ) : editModal.type === "cash" ? (
                <SelectField
                  value={editModal.method_name}
                  onChange={(e) => setEditModal({ ...editModal, method_name: e.target.value })}
                >
                  {ADMIN_CASH_METHOD_OPTIONS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <TextField
                  placeholder="Method name"
                  value={editModal.method_name}
                  onChange={(e) => setEditModal({ ...editModal, method_name: e.target.value })}
                />
              )}
              <TextField
                placeholder="Currency"
                value={editModal.currency}
                onChange={(e) => setEditModal({ ...editModal, currency: e.target.value })}
              />
              {editModal.type === "bank" && (
                <>
                  <TextField
                    placeholder="Account name"
                    value={editModal.account_name ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, account_name: e.target.value })}
                  />
                  <TextField
                    placeholder="RIB"
                    value={editModal.rib ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, rib: e.target.value })}
                  />
                </>
              )}
              {editModal.type === "crypto" && (
                <>
                  <TextField
                    placeholder="Wallet address"
                    value={editModal.wallet_address ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, wallet_address: e.target.value })}
                  />
                  <TextField
                    placeholder="Network"
                    value={editModal.network ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, network: e.target.value })}
                  />
                </>
              )}
              {editModal.type === "cash" && (
                <>
                  <TextField
                    placeholder="Account name / label"
                    value={editModal.account_name ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, account_name: e.target.value })}
                  />
                  <TextField
                    placeholder="Phone"
                    value={editModal.phone ?? ""}
                    onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                  />
                </>
              )}
              <TextArea
                placeholder="Instructions"
                value={editModal.instructions ?? ""}
                onChange={(e) => setEditModal({ ...editModal, instructions: e.target.value })}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={!!editModal.active}
                  onChange={(e) => setEditModal({ ...editModal, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-black/30"
                />
                نشط (يظهر للوكلاء)
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                إلغاء
              </button>
              <PrimaryButton type="button" onClick={() => void saveEditModal()} disabled={editSaving}>
                {editSaving ? (
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
