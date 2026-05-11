"use client";

import { clsx } from "clsx";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GlassCard, PrimaryButton, TextArea, TextField } from "@/components/ui";
import { formatShortPlayerId } from "@/lib/format-player-id";
import { useAgentTranslation } from "@/hooks/useTranslation";

export type AgentPendingLinkRow = {
  id: string;
  playerId: string;
  username: string;
  phone: string;
};

type ApproveForm = {
  new_gosport_username: string;
  confirm_new_gosport_username: string;
  player_gosport_password: string;
  confirm_player_gosport_password: string;
};

const emptyForm = (): ApproveForm => ({
  new_gosport_username: "",
  confirm_new_gosport_username: "",
  player_gosport_password: "",
  confirm_player_gosport_password: "",
});

function buildSuccessMessage(template: string, playerName: string, gosportUsername: string, plainPassword: string) {
  return template
    .split("{{playerName}}").join(playerName)
    .split("{{gosportUsername}}").join(gosportUsername)
    .split("{{plainPassword}}").join(plainPassword);
}

function validateClient(
  f: ApproveForm,
  t: (key: import("@/lib/i18n/dictionaries/agent").AgentTranslationKey) => string,
): string | null {
  const u = String(f.new_gosport_username ?? "").trim();
  const uc = String(f.confirm_new_gosport_username ?? "").trim();
  const p = String(f.player_gosport_password ?? "");
  const pc = String(f.confirm_player_gosport_password ?? "").trim();

  if (!u || !uc || !p || !pc) {
    return t("link_row_error_all_fields_required");
  }
  if (u !== uc) {
    return t("link_row_error_username_mismatch");
  }
  if (p !== pc) {
    return t("link_row_error_password_mismatch");
  }
  if (p.length < 6) {
    return t("link_row_error_password_min");
  }
  return null;
}

type Props = {
  row: AgentPendingLinkRow;
  /** @deprecated */
  toggleOpenLabel?: string;
  /** @deprecated */
  toggleCloseLabel?: string;
  acceptButtonLabel?: string;
  acceptSetupButtonLabel?: string;
  onResolved?: () => void | Promise<void>;
};

export function AgentLinkRequestApprovalRow({
  row,
  onResolved,
  acceptSetupButtonLabel,
}: Props) {
  const { t } = useAgentTranslation();
  const approveLabel = acceptSetupButtonLabel ?? t("link_row_approve_setup");
  const [slideOpen, setSlideOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState<ApproveForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successPendingRefreshRef = useRef(false);

  const displayId = useMemo(() => formatShortPlayerId(row.playerId), [row.playerId]);

  const patchForm = useCallback((patch: Partial<ApproveForm>) => {
    setFormError(null);
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const openSlide = () => {
    setForm(emptyForm());
    setFormError(null);
    setSuccessMessage(null);
    setSlideOpen(true);
  };

  const closeSlide = () => {
    if (successMessage) {
      void onResolved?.();
    }
    setSlideOpen(false);
    setFormError(null);
    setSuccessMessage(null);
  };

  const shareUrl = useMemo(() => {
    if (!successMessage) return "";
    return `https://wa.me/?text=${encodeURIComponent(successMessage)}`;
  }, [successMessage]);
  const credentialsPreview = useMemo(() => {
    const username = form.new_gosport_username.trim();
    const password = form.player_gosport_password;
    if (!username || !password) return "";
    return `GoSport365 Credentials\nUsername: ${username}\nPassword: ${password}`;
  }, [form.new_gosport_username, form.player_gosport_password]);

  const copyMessage = async () => {
    if (!successMessage) return;
    try {
      await navigator.clipboard.writeText(successMessage);
      toast.success(t("link_row_toast_message_copied"));
    } catch {
      toast.error(t("link_row_toast_copy_failed_manual"));
    }
  };

  const submit = async () => {
    const err = validateClient(form, t);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      const u = form.new_gosport_username.trim();
      const p = form.player_gosport_password;
      const res = await fetch(`/api/agent/agent-customers/${encodeURIComponent(row.id)}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_gosport_username: u,
          confirm_new_gosport_username: form.confirm_new_gosport_username.trim(),
          player_gosport_password: p,
          confirm_player_gosport_password: form.confirm_player_gosport_password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || t("link_row_toast_approve_failed"));
        return;
      }
      const msg = buildSuccessMessage(
        t("link_row_success_message_template"),
        row.username,
        u,
        p,
      );
      successPendingRefreshRef.current = true;
      setSuccessMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    const r = rejectReason.trim();
    if (r.length < 3) {
      setRejectError(t("link_row_reject_reason_min"));
      return;
    }
    setRejectError(null);
    setRejectBusy(true);
    try {
      const res = await fetch(`/api/agent/agent-customers/${encodeURIComponent(row.id)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || t("link_row_toast_reject_failed"));
        return;
      }
      toast.success(data.message || t("link_row_toast_reject_success"));
      setRejectOpen(false);
      setRejectReason("");
      await onResolved?.();
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <>
      {rejectOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label={t("link_row_close")}
            onClick={() => !rejectBusy && setRejectOpen(false)}
          />
          <div className="relative z-[101] w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{t("link_row_reject_title")}</h3>
            <p className="mt-2 text-sm text-white/55">
              {t("link_row_player_label")} <span className="font-semibold text-cyan-200">{row.username}</span> ({displayId})
            </p>
            <label className="mt-4 block text-sm font-medium text-white/80">{t("link_row_reject_reason_label")}</label>
            <TextArea
              className="mt-2 min-h-[120px]"
              placeholder={t("link_row_reject_reason_placeholder")}
              value={rejectReason}
              onChange={(e) => {
                setRejectError(null);
                setRejectReason(e.target.value);
              }}
            />
            {rejectError ? (
              <p role="alert" className="mt-2 text-sm text-rose-300">
                {rejectError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                disabled={rejectBusy}
                onClick={() => setRejectOpen(false)}
              >
                {t("link_row_cancel")}
              </button>
              <button
                type="button"
                disabled={rejectBusy}
                className="rounded-2xl border border-red-500/50 bg-red-500/20 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/40 disabled:opacity-50"
                onClick={() => void submitReject()}
              >
                {rejectBusy ? t("link_row_sending") : t("link_row_confirm_reject")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{t("table_player_id")}</p>
            <p className="font-mono text-base text-cyan-200 md:text-lg" dir="ltr">
              {displayId}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {t("link_row_username_label")} <span className="font-semibold text-white">{row.username}</span>
            </p>
            {row.phone ? (
              <p className="mt-0.5 text-sm text-white/45" dir="ltr">
                {row.phone}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/20 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/40 disabled:opacity-50"
              disabled={busy || rejectBusy}
              onClick={() => {
                setRejectReason("");
                setRejectError(null);
                setRejectOpen(true);
              }}
            >
              {t("table_reject")}
            </button>
            <PrimaryButton type="button" disabled={busy || rejectBusy} onClick={openSlide}>
              {approveLabel}
            </PrimaryButton>
          </div>
        </div>
      </GlassCard>
      {slideOpen ? (
        <GlassCard className="mt-3 space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{successMessage ? t("link_row_success_title") : t("link_row_setup_title")}</h3>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => !busy && closeSlide()}
            >
              {t("link_row_close")}
            </button>
          </div>
          {successMessage ? (
            <>
              <pre className="whitespace-pre-wrap rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 font-sans text-sm leading-relaxed text-white/90">
                {successMessage}
              </pre>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <PrimaryButton type="button" className="w-full sm:flex-1" onClick={() => void copyMessage()}>
                  {t("link_row_copy_message")}
                </PrimaryButton>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    "inline-flex w-full flex-1 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:brightness-110 sm:w-auto",
                  )}
                >
                  {t("link_row_share_whatsapp")}
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white/55">
                {t("link_row_player_label")} <span className="font-semibold text-cyan-200">{row.username}</span> — {t("table_player_id")}:{" "}
                <span className="font-mono text-cyan-100" dir="ltr">
                  {displayId}
                </span>
              </p>
              {formError ? (
                <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                  {formError}
                </p>
              ) : null}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t("link_row_new_gosport_username")}</label>
                  <TextField
                    autoComplete="off"
                    value={form.new_gosport_username}
                    onChange={(e) => patchForm({ new_gosport_username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t("link_row_confirm_new_gosport_username")}</label>
                  <TextField
                    autoComplete="off"
                    value={form.confirm_new_gosport_username}
                    onChange={(e) => patchForm({ confirm_new_gosport_username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t("link_row_player_gosport_password")}</label>
                  <TextField
                    type="password"
                    autoComplete="new-password"
                    value={form.player_gosport_password}
                    onChange={(e) => patchForm({ player_gosport_password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t("link_row_confirm_player_gosport_password")}</label>
                  <TextField
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm_player_gosport_password}
                    onChange={(e) => patchForm({ confirm_player_gosport_password: e.target.value })}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/90">{t("link_row_preview_title")}</p>
                {credentialsPreview ? (
                  <>
                    <pre className="whitespace-pre-wrap font-mono text-xs text-cyan-50">{credentialsPreview}</pre>
                    <button
                      type="button"
                      className="mt-3 rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(credentialsPreview);
                          toast.success(t("link_row_toast_credentials_copied"));
                        } catch {
                          toast.error(t("link_row_toast_copy_failed"));
                        }
                      }}
                    >
                      {t("link_row_copy_to_clipboard")}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-white/60">{t("link_row_preview_empty")}</p>
                )}
              </div>
              <PrimaryButton type="button" disabled={busy} className="w-full" onClick={() => void submit()}>
                {busy ? t("link_row_saving") : approveLabel}
              </PrimaryButton>
            </>
          )}
        </GlassCard>
      ) : null}
    </>
  );
}
