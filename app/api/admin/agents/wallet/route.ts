import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, balance } = await req.json();

    const updated = await prisma.wallet.upsert({
      where: { agentId: String(agentId) },
      update: { balance: Number(balance) },
      create: { agentId: String(agentId), balance: Number(balance) } as any,
    });

    return NextResponse.json({ success: true, balance: updated.balance });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}