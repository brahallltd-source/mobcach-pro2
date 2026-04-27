import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { getAgentSpendableBalanceDh } from "@/lib/agent-spendable-balance";
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
    const rawKey = searchParams.get("agentId");

    if (!rawKey?.trim()) {
      return NextResponse.json({ message: "Agent ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const resolved = await resolveAgentWalletIds(prisma, rawKey);
    if (!resolved) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404, headers: noCacheHeaders });
    }

    const agentData = await prisma.agent.findUnique({
      where: { id: resolved.agentTableId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        responseMinutes: true,
        /** Mirrored from Wallet by manual recharge / wallet flows. */
        availableBalance: true,
        /** May be null if legacy `Wallet` row has `userId` but `agentId` not backfilled. */
        wallet: {
          select: {
            id: true,
            balance: true,
          },
        },
        user: { select: { paymentMethods: true, executionTime: true } },
      },
    });

    if (!agentData) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404, headers: noCacheHeaders });
    }

    let walletForSpend = agentData.wallet;
    if (walletForSpend == null) {
      const byUserId = await prisma.wallet.findUnique({
        where: { userId: resolved.userId },
        select: { id: true, balance: true },
      });
      walletForSpend = byUserId;
    }

    const parsedMethods = parseAgentPaymentMethodsJson(agentData.user?.paymentMethods);
    const activePaymentMethods = parsedMethods
      .filter((m) => m.isActive)
      .map((m) => toPublicPaymentMethodPayload(m as AgentPaymentMethodRow));

    const spendableDh = getAgentSpendableBalanceDh({
      availableBalance: agentData.availableBalance,
      wallet: walletForSpend,
    });

    const formattedAgent = {
      id: agentData.id,
      fullName: agentData.fullName,
      username: agentData.username,
      email: agentData.email,
      phone: agentData.phone,
      /** Single flat DH number for UI + validation: max(`Wallet.balance`, `Agent.availableBalance`). */
      availableBalance: spendableDh,
      balance: spendableDh,
      executionTimeLabel:
        (typeof agentData.user?.executionTime === "string" && agentData.user.executionTime.trim()) ||
        `${agentData.responseMinutes ?? 30} min`,
      activePaymentMethods,
    };

    console.log("Public Profile API - Returning Agent Balance (DH):", spendableDh);

    return NextResponse.json({ agent: formattedAgent }, { headers: noCacheHeaders });
  } catch (error) {
    console.error("PUBLIC PROFILE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500, headers: noCacheHeaders });
  }
}
