export const dynamic = "force-dynamic"; 
export const revalidate = 0;           

import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { createWalletIfMissing } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required", wallet: null }, { status: 400 });

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        let wallet = await prisma.wallet.findUnique({ where: { agentId: String(agentId) } });
        if (!wallet) {
          wallet = await prisma.wallet.create({ data: { agentId: String(agentId), balance: 0 } });
        }
        return NextResponse.json({
          wallet: {
            agentId: wallet.agentId,
            balance: wallet.balance,
            updated_at: wallet.updatedAt,
          }
        });
      }
    }

    return NextResponse.json({ wallet: createWalletIfMissing(agentId) });
  } catch (error) {
    console.error("GET AGENT WALLET ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, wallet: null }, { status: 500 });
  }
}
