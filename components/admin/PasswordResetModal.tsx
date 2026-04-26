"use client";

import { Key, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard, PrimaryButton, TextField } from "@/components/ui";

function randomPassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[arr[i]! % chars.length];
  }
  return out;
}

type PasswordResetModalProps = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userLabel: string;
  tx: (path: string, vars?: Record<string, string>) => string;
};

export function PasswordResetModal({ open, onClose, userId, userLabel, tx }: PasswordResetModalProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setBusy(false);
    }
  }, [open]);

  const onGenerate = useCallback(() => {
    setPassword(randomPassword(16));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!userId) return;
    if (password.length < 8) {
      toast.error(tx("admin.users.messages.password_min"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, newPassword: password }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok) {
        toast.error(String(data.message || tx("admin.users.messages.password_error")));
        return;
      }
      toast.success(tx("admin.users.messages.password_success"));
      onClose();
    } catch {
      toast.error(tx("admin.users.messages.password_error"));
    } finally {
      setBusy(false);
    }
  }, [userId, password, tx, onClose]);

  if (!open || !userId) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <GlassCard className="relative w-full max-w-md border border-white/[0.08] p-6 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/60 transition hover:border-white/20 hover:text-white"
          aria-label={tx("admin.users.changePasswordCloseAria")}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 pe-10">
          <Key className="h-5 w-5 text-cyan-300/90" aria-hidden />
          <h2 id="change-password-title" className="text-lg font-bold text-white">
            {tx("admin.users.actions.change_password")}
          </h2>
        </div>
        <p className="mt-1 text-xs text-white/45">{tx("admin.users.changePasswordSubtitle", { user: userLabel })}</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-white/60" htmlFor="admin-new-password">
            {tx("admin.users.newPasswordLabel")}
          </label>
          <TextField
            id="admin-new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            className="w-full"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={onGenerate}
            className="text-xs font-semibold text-cyan-300/95 underline-offset-2 hover:underline"
          >
            {tx("admin.users.generatePassword")}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {tx("admin.users.cancel")}
          </button>
          <PrimaryButton type="button" onClick={() => void onSubmit()} disabled={busy}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tx("admin.users.saving")}
              </span>
            ) : (
              tx("admin.users.submitPasswordChange")
            )}
          </PrimaryButton>
        </div>
      </GlassCard>
    </div>
  );
}
