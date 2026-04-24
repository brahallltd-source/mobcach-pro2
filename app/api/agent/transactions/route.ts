import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";
import {
  executionMinutesFromAgentSettings,
  normalizeRechargeProofStatus,
} from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { session, userId: session.id };
}

/** List player payment proofs for the signed-in agent (`PaymentProofTransaction`). */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    const ctx = requireAgent(session);
    if (!ctx) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const maintenance = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenance) return maintenance;

    const suspended = await rejectAgentIfSuspended(prisma, ctx.userId);
    if (suspended) return suspended;

    const [userRow, rows, agentProfile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { paymentMethods: true },
      }),
      prisma.paymentProofTransaction.findMany({
        where: { agentUserId: ctx.userId },
        orderBy: { createdAt: "desc" },
        include: {
          playerUser: { select: { id: true, username: true, email: true } },
        },
      }),
      prisma.agent.findUnique({
        where: { userId: ctx.userId },
        select: { defaultExecutionTimeMinutes: true, user: { select: { executionTime: true } } },
      }),
    ]);

    const executionWindowMinutes = executionMinutesFromAgentSettings(
      agentProfile?.user?.executionTime,
      agentProfile?.defaultExecutionTimeMinutes ?? 30
    );

    const methods = parseAgentPaymentMethodsJson(userRow?.paymentMethods);

    const transactions = rows.map((r) => {
      const methodId = r.paymentMethodId ?? "";
      const methodRow = methods.find((m) => m.id === methodId) as AgentPaymentMethodRow | undefined;
      const methodPayload = methodRow ? toPublicPaymentMethodPayload(methodRow) : null;

      return {
        id: r.id,
        amount: r.amount,
        senderName: r.senderName,
        senderPhone: r.senderPhone,
        status: normalizeRechargeProofStatus(r.status),
        receiptUrl: r.receiptUrl,
        agentRejectReason: r.agentRejectReason,
        paymentMethod: r.paymentMethod ?? r.paymentMethodTitle,
        paymentMethodId: r.paymentMethodId,
        paymentMethodTitle: r.paymentMethodTitle,
        timerStartedAt: r.timerStartedAt?.toISOString() ?? null,
        isLatePenaltyApplied: r.isLatePenaltyApplied,
        executionWindowMinutes,
        createdAt: r.createdAt.toISOString(),
        playerUserId: r.playerUserId,
        playerUsername: r.playerUser.username,
        playerEmail: r.playerUser.email,
        methodInstructions: methodPayload
          ? {
              methodTitle: methodPayload.methodTitle,
              copyable: methodPayload.copyable,
            }
          : r.paymentMethodTitle
            ? { methodTitle: r.paymentMethodTitle, copyable: [] as { key: string; label: string; value: string }[] }
            : null,
      };
    });

    return NextResponse.json({ transactions });
  } catch (e) {
    console.error("GET /api/agent/transactions", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
