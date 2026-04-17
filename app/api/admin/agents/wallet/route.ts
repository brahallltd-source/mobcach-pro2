import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, balance } = await req.json();

    // 🟢 كنستعملو userId حيت هو اللي مضمون كاين عند الوكلاء القدام
    const updated = await prisma?.wallet.upsert({
      where: { userId: String(agentId) },
      update: { balance: Number(balance), updatedAt: new Date() },
      create: { 
        userId: String(agentId), 
        balance: Number(balance)
      } as any,
    });

    return NextResponse.json({ success: true, balance: updated?.balance });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}