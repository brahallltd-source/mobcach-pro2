import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GlassCard, PageHeader, SidebarShell } from "@/components/ui";

type PageProps = {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function PlayerPaymentProofSuccessPage({ params, searchParams }: PageProps) {
  const { agentId } = await params;
  const sp = await searchParams;
  const refId = typeof sp.id === "string" ? sp.id : "";

  return (
    <SidebarShell role="player">
      <PageHeader
        title="تم استلام طلبك"
        subtitle="سيقوم الوكيل بمراجعة إثبات الدفع. ستصلك إشعار عند الموافقة أو الرفض."
      />
      <div className="mx-auto max-w-xl">
        <GlassCard className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-sm text-white/60">
            حالة الطلب: <span className="font-semibold text-amber-200">قيد المراجعة</span>
          </p>
          {refId ? (
            <p className="mt-2 break-all font-mono text-xs text-white/35" dir="ltr">
              مرجع: {refId}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/player/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
            >
              العودة للوحة اللاعب
            </Link>
            {refId ? (
              <Link
                href={`/player/transactions/${encodeURIComponent(refId)}`}
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                متابعة الطلب والمحادثة
              </Link>
            ) : null}
            <Link
              href={`/player/recharge/${encodeURIComponent(agentId)}`}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              صفحة الشحن
            </Link>
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
