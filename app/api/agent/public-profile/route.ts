import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) return NextResponse.json({ message: "Agent ID required" }, { status: 400 });

    const agentData = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        wallet: true,
        user: { select: { paymentMethods: true, executionTime: true } },
      },
    });

    if (!agentData) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    const parsedMethods = parseAgentPaymentMethodsJson(agentData.user?.paymentMethods);
    const activePaymentMethods = parsedMethods
      .filter((m) => m.isActive)
      .map((m) => toPublicPaymentMethodPayload(m as AgentPaymentMethodRow));

    const formattedAgent = {
      id: agentData.id,
      fullName: agentData.fullName,
      username: agentData.username,
      email: agentData.email,
      phone: agentData.phone,
      availableBalance: agentData.wallet?.balance || 0,
      executionTimeLabel:
        (typeof agentData.user?.executionTime === "string" && agentData.user.executionTime.trim()) ||
        `${agentData.responseMinutes ?? 30} min`,
      activePaymentMethods,
    };

    return NextResponse.json({ agent: formattedAgent });
  } catch (error) {
    console.error("PUBLIC PROFILE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}
