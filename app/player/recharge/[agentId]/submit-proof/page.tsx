"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";

type ActivePaymentMethod = {
  id: string;
  methodTitle: string;
  category: string | null;
  minAmount: number;
  maxAmount: number;
};

type PublicAgent = {
  id: string;
  fullName: string;
  username: string;
  activePaymentMethods: ActivePaymentMethod[];
};

function needsSenderPhone(category: string | null | undefined) {
  return category === "telecom" || category === "cash";
}

function SubmitProofForm() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = String(params?.agentId || "").trim();
  const methodId = String(searchParams.get("methodId") || "").trim();
  const amountParam = String(searchParams.get("amount") || "").replace(",", ".").trim();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const amountNum = useMemo(() => {
    const n = parseFloat(amountParam);
    return Number.isFinite(n) ? n : NaN;
  }, [amountParam]);

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) {
      window.location.href = "/login";
      return;
    }
    const u = JSON.parse(saved) as { email?: string; role?: string };
    if (u.role !== "player") {
      window.location.href = "/login";
      return;
    }
    setUserEmail(String(u.email || ""));
  }, []);

  const loadAgent = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      setError("معرّف الوكيل غير صالح");
      return;
    }
    try {
      const res = await fetch(
        `/api/agent/public-profile?agentId=${encodeURIComponent(agentId)}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data.agent) {
        throw new Error(data.message || "الوكيل غير موجود");
      }
      const a = data.agent as PublicAgent;
      setAgent({
        ...a,
        activePaymentMethods: Array.isArray(a.activePaymentMethods) ? a.activePaymentMethods : [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل بيانات الوكيل");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  const selected = agent?.activePaymentMethods?.find((m) => m.id === methodId) ?? null;
  const phoneField = needsSenderPhone(selected?.category ?? null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const amountOk = useMemo(() => {
    if (!selected) return false;
    if (!Number.isFinite(amountNum) || amountNum <= 0) return false;
    return amountNum >= selected.minAmount && amountNum <= selected.maxAmount;
  }, [selected, amountNum]);

  const canSubmit =
    Boolean(userEmail) &&
    Boolean(selected) &&
    amountOk &&
    senderName.trim().length >= 2 &&
    (!phoneField || senderPhone.trim().length >= 6) &&
    Boolean(file) &&
    !submitting;

  const onPickFiles = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("يُسمح بملفات الصور فقط");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("حجم الصورة كبير جداً (الحد 8 ميغابايت)");
      return;
    }
    setError(null);
    setFile(f);
  }

  const onSubmit = async () => {
    if (!userEmail || !selected || !file || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("playerEmail", userEmail);
      fd.set("agentId", agentId);
      fd.set("paymentMethodId", selected.id);
      fd.set("amount", String(amountNum));
      fd.set("senderName", senderName.trim());
      if (phoneField) fd.set("senderPhone", senderPhone.trim());

      const res = await fetch("/api/player/payment-proof", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "فشل الإرسال");
      }
      router.replace(
        `/player/recharge/${encodeURIComponent(agentId)}/submit-proof/success?id=${encodeURIComponent(String(data.id || ""))}`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  if (!userEmail && !loading) {
    return null;
  }

  if (loading) {
    return (
      <SidebarShell role="player">
        <LoadingCard text="جاري التحميل..." />
      </SidebarShell>
    );
  }

  if (error && !agent) {
    return (
      <SidebarShell role="player">
        <PageHeader title="خطأ" subtitle={error} />
        <GlassCard className="p-8 text-center">
          <Link
            href={`/player/recharge/${encodeURIComponent(agentId)}`}
            className="text-cyan-300 underline-offset-2 hover:underline"
          >
            العودة لصفحة الشحن
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (!methodId || !Number.isFinite(amountNum)) {
    return (
      <SidebarShell role="player">
        <PageHeader title="بيانات ناقصة" subtitle="يرجى اختيار وسيلة الدفع والمبلغ من صفحة الشحن أولاً." />
        <GlassCard className="p-8 text-center">
          <Link
            href={`/player/recharge/${encodeURIComponent(agentId)}`}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            العودة لصفحة الشحن
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (agent && !selected) {
    return (
      <SidebarShell role="player">
        <PageHeader title="وسيلة غير صالحة" subtitle="وسيلة الدفع غير متاحة أو غير مفعّلة." />
        <GlassCard className="p-8 text-center">
          <Link
            href={`/player/recharge/${encodeURIComponent(agentId)}`}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            العودة لصفحة الشحن
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  if (agent && selected && !amountOk) {
    return (
      <SidebarShell role="player">
        <PageHeader title="مبلغ غير صالح" subtitle="المبلغ خارج الحدود المسموحة لهذه الوسيلة." />
        <GlassCard className="p-8 text-center">
          <Link
            href={`/player/recharge/${encodeURIComponent(agentId)}`}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
          >
            تصحيح المبلغ
          </Link>
        </GlassCard>
      </SidebarShell>
    );
  }

  const agentLabel = agent
    ? String(agent.fullName || agent.username || "الوكيل")
    : "";

  return (
    <SidebarShell role="player">
      <PageHeader
        title="تأكيد إرسال الدفع"
        subtitle={`إثبات التحويل إلى ${agentLabel} — ${selected?.methodTitle ?? ""} — ${Number.isFinite(amountNum) ? `${Math.round(amountNum)} MAD` : ""}`}
      />

      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <GlassCard className="border border-amber-400/30 bg-amber-500/[0.08] p-4 text-sm leading-relaxed text-amber-50/95">
          يرجى رفع صورة التحويل الناجح فقط. الصور غير الواضحة أو غير الصحيحة قد تؤدي لرفض العملية.
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">
                الاسم الكامل الذي قمت بالتحويل به
              </label>
              <TextField
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                autoComplete="name"
                placeholder="كما يظهر في الوصل"
              />
            </div>

            {phoneField ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-white/55">
                  رقم الهاتف الذي قمت بالتحويل منه
                </label>
                <TextField
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="06xxxxxxxx"
                />
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-white/55">صورة وصل التحويل</p>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 transition ${
                  dragOver
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/15 bg-black/20 hover:border-white/25"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onPickFiles(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="معاينة الوصل"
                    className="max-h-48 max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <ImagePlus className="h-10 w-10 text-white/35" aria-hidden />
                    <span className="text-center text-sm text-white/60">
                      اسحب الصورة هنا أو انقر للاختيار
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50">
                      <Upload className="h-3.5 w-3.5" />
                      صور فقط — حتى 8 ميغابايت
                    </span>
                  </>
                )}
              </label>
            </div>

            {error ? (
              <p className="text-sm text-rose-300" role="alert">
                {error}
              </p>
            ) : null}

            <PrimaryButton
              type="button"
              className="flex w-full items-center justify-center gap-2 py-3.5"
              disabled={!canSubmit}
              onClick={() => void onSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                "إرسال الإثبات"
              )}
            </PrimaryButton>

            <Link
              href={`/player/recharge/${encodeURIComponent(agentId)}`}
              className="block text-center text-sm text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            >
              العودة لصفحة الشحن
            </Link>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}

export default function PlayerSubmitPaymentProofPage() {
  return (
    <Suspense
      fallback={
        <SidebarShell role="player">
          <LoadingCard text="جاري التحميل..." />
        </SidebarShell>
      }
    >
      <SubmitProofForm />
    </Suspense>
  );
}
