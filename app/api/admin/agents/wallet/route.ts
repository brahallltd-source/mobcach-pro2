export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { agentId, balance } = await req.json();

    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    // 🟢 المسمار: تعديل الصولد باستعمال upsert (تحديث أو إنشاء)
    const updatedWallet = await prisma.wallet.upsert({
      where: { agentId: String(agentId) },
      update: { balance: Number(balance), updatedAt: new Date() },
      create: { agentId: String(agentId), balance: Number(balance) },
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم تحديث الرصيد بنجاح ✅", 
      balance: updatedWallet.balance 
    });
  } catch (error) {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}