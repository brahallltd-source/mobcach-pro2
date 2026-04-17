import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, balance } = await req.json();

    if (!agentId) return NextResponse.json({ success: false }, { status: 400 });

    const updated = await prisma?.wallet.upsert({
      where: { agentId: String(agentId) },
      update: { balance: Number(balance), updatedAt: new Date() },
      create: { 
        agentId: String(agentId), 
        userId: String(agentId), // نستخدم agentId كقيمة للـ userId أيضاً للتبسيط
        balance: Number(balance)
      } as any,
    });

    return NextResponse.json({ success: true, balance: updated?.balance });
  } catch (error) {
    console.error("WALLET PATCH ERROR:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}