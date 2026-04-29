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
  RECHARGE_PROOF_STATUS,
} from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAgent(session: Awaited<ReturnType<typeof getSessionUserFromCookies>>) {
  if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") return null;
  if (!session.agentProfile?.id) return null;
  return { session, userId: session.id, agentProfileId: session.agentProfile.id };
}

/** List player proof-uploaded orders for the signed-in agent (`Order`). */
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
      prisma.order.findMany({
        where: {
          agentId: ctx.agentProfileId,
          status: { in: ["proof_uploaded", "flagged_for_review"] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          player: {
            select: {
              id: true,
              userId: true,
              username: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
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
      const paymentMethodName = String(r.paymentMethodName ?? "").trim();
      const methodRow = methods.find((m) => {
        const pub = toPublicPaymentMethodPayload(m as AgentPaymentMethodRow);
        return (
          String(pub.methodTitle ?? "").trim().toLowerCase() ===
          paymentMethodName.toLowerCase()
        );
      }) as AgentPaymentMethodRow | undefined;
      const methodPayload = methodRow ? toPublicPaymentMethodPayload(methodRow) : null;
      const playerName = String(r.player?.username ?? "").trim();
      const playerEmail = String(r.player?.user?.email ?? r.playerEmail ?? "").trim();

      return {
        id: r.id,
        amount: r.amount,
        gosportUsername: String(r.gosportUsername ?? "").trim(),
        senderName: playerName || playerEmail || "—",
        senderPhone: r.player?.phone ?? null,
        // UI expects this lifecycle key for the "pending review" bucket.
        status: RECHARGE_PROOF_STATUS.PROCESSING,
        receiptUrl: r.proofUrl ?? "",
        agentRejectReason: r.reviewReason ?? null,
        paymentMethod: paymentMethodName || null,
        paymentMethodId: null,
        paymentMethodTitle: paymentMethodName || null,
        timerStartedAt: r.updatedAt?.toISOString() ?? r.createdAt.toISOString(),
        isLatePenaltyApplied: false,
        executionWindowMinutes,
        createdAt: r.createdAt.toISOString(),
        playerUserId: r.player?.userId ?? "",
        playerUsername: playerName || "—",
        playerEmail,
        methodInstructions: methodPayload
          ? {
              methodTitle: methodPayload.methodTitle,
              copyable: methodPayload.copyable,
            }
          : paymentMethodName
            ? {
                methodTitle: paymentMethodName,
                copyable: [] as { key: string; label: string; value: string }[],
              }
            : null,
      };
    });

    return NextResponse.json({ transactions });
  } catch (e) {
    console.error("GET /api/agent/transactions", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
