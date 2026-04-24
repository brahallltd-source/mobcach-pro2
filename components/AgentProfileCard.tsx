"use client";

import { useRouter } from "next/navigation";
import { UserPlus, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AgentProfilePaymentMethod = {
  id: string;
  methodName?: string | null;
  methodTitle?: string | null;
  name?: string | null;
  bankName?: string | null;
  minAmount?: number;
  maxAmount?: number;
};

export type AgentProfileCardAgent = {
  id?: string;
  name?: string | null;
  username?: string | null;
  isOnline?: boolean;
  rating?: number;
  paymentMethods?: AgentProfilePaymentMethod[] | null;
  chatHref?: string | null;
  /** Nested shape when the payload wraps an `agent` relation. */
  agent?: { paymentMethods?: AgentProfilePaymentMethod[] | null } | null;
};

export type AgentProfileCardActionType = "deposit" | "join";

export type AgentProfileCardProps = {
  agent: AgentProfileCardAgent | null;
  actionType?: AgentProfileCardActionType;
  onAction?: () => void;
  /** Overrides the small label above the name (default: وكيلك المعتمد). */
  headerLabel?: string;
  /** When set, replaces the default join/deposit button label (e.g. registration agent picker). */
  actionButtonLabel?: string;
};

function resolvePaymentMethods(agent: AgentProfileCardAgent | null): AgentProfilePaymentMethod[] {
  if (!agent) return [];
  const direct = Array.isArray(agent.paymentMethods) ? agent.paymentMethods : [];
  if (direct.length) return direct;
  const nested = agent.agent?.paymentMethods;
  return Array.isArray(nested) ? nested : [];
}

export function AgentProfileCard({
  agent,
  actionType = "deposit",
  onAction,
  headerLabel = "وكيلك المعتمد",
  actionButtonLabel,
}: AgentProfileCardProps) {
  const router = useRouter();
  const methods = resolvePaymentMethods(agent);
  const displayName = agent?.name?.trim() || "وكيل";
  const online = Boolean(agent?.isOnline);

  const handleClick = () => {
    if (onAction) {
      onAction();
      return;
    }
    if (actionType === "deposit") {
      router.push("/player/achat");
    }
  };

  return (
    <Card className="overflow-hidden border border-cyan-400/25 bg-[#060b14]/70 shadow-xl shadow-black/40 backdrop-blur-md">
      <CardHeader className="border-b border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-600/10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white/55">{headerLabel}</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">{displayName}</h3>
            {agent?.username ? (
              <p className="mt-1 text-sm text-white/45">@{agent.username}</p>
            ) : null}
            {typeof agent?.rating === "number" && Number.isFinite(agent.rating) ? (
              <p className="mt-2 text-xs text-white/40">{agent.rating}% تقييم إيجابي</p>
            ) : null}
          </div>
          <Badge variant={online ? "default" : "secondary"} className="flex items-center gap-2 px-3 py-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${online ? "animate-pulse bg-emerald-400" : "bg-white/40"}`}
              aria-hidden
            />
            {online ? "متصل الآن" : "غير متصل"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 bg-transparent pt-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-white/90">وسائل الدفع المتاحة:</p>
          <div className="flex flex-wrap gap-2">
            {methods.length > 0 ? (
              methods.map((method) => (
                <Badge key={method.id} variant="outline" className="max-w-full whitespace-normal py-1.5 text-left">
                  <span className="block font-semibold">
                    {method.bankName ?? method.methodName ?? method.methodTitle ?? method.name ?? "وسيلة"}
                  </span>
                  {typeof method.minAmount === "number" && typeof method.maxAmount === "number" ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-white/50">
                      من {method.minAmount} إلى {method.maxAmount} DH
                    </span>
                  ) : null}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-white/45">لا توجد وسائل دفع مضافة</span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          size="lg"
          className="w-full gap-2 text-base font-bold tracking-wide"
          onClick={handleClick}
        >
          {actionButtonLabel ? (
            <>
              <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
              {actionButtonLabel}
            </>
          ) : actionType === "join" ? (
            <>
              <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
              انضم الآن
            </>
          ) : (
            <>
              <Wallet className="h-5 w-5 shrink-0" aria-hidden />
              اشحن رصيدك الآن
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
