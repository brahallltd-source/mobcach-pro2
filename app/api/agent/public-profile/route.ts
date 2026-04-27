import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const noCacheHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
};

export async function GET(req: Request) {
  noStore();
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ message: "Agent ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const agentData = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        wallet: true,
        user: { select: { paymentMethods: true, executionTime: true } },
      },
    });

    if (!agentData) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404, headers: noCacheHeaders });
    }

    const parsedMethods = parseAgentPaymentMethodsJson(agentData.user?.paymentMethods);
    const activePaymentMethods = parsedMethods
      .filter((m) => m.isActive)
      .map((m) => toPublicPaymentMethodPayload(m as AgentPaymentMethodRow));

    const walletBal = agentData.wallet != null ? Number(agentData.wallet.balance) : null;
    const fallbackBal = Number(agentData.availableBalance) || 0;
    const availableBalance = walletBal != null && Number.isFinite(walletBal) ? walletBal : fallbackBal;

    const formattedAgent = {
      id: agentData.id,
      fullName: agentData.fullName,
      username: agentData.username,
      email: agentData.email,
      phone: agentData.phone,
      availableBalance,
      executionTimeLabel:
        (typeof agentData.user?.executionTime === "string" && agentData.user.executionTime.trim()) ||
        `${agentData.responseMinutes ?? 30} min`,
      activePaymentMethods,
    };

    return NextResponse.json({ agent: formattedAgent }, { headers: noCacheHeaders });
  } catch (error) {
    console.error("PUBLIC PROFILE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500, headers: noCacheHeaders });
  }
}
