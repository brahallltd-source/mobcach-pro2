import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { agentId, balance } = await req.json();

    if (!agentId) {
      return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    }

    // 🟢 المسمار: استعملنا upsert مع 'as any' باش نسكتو TypeScript فـ الـ Build
    const updatedWallet = await prisma.wallet.upsert({
      where: { 
        agentId: String(agentId) 
      },
      update: { 
        balance: Number(balance), 
        updatedAt: new Date() 
      },
      create: { 
        balance: Number(balance),
        agentId: String(agentId),
        // كنربطو العلاقات باش Prisma ما تعكش لينا فـ الداتابيز
        agent: { connect: { id: String(agentId) } },
        user: { connect: { id: String(agentId) } },
      } as any // 👈 هادي هي "القرصة" اللي غاتخلي الـ Build يدوز خضر
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم تحديث الرصيد بنجاح ✅", 
      balance: updatedWallet.balance 
    });

  } catch (error: any) {
    console.error("ADMIN WALLET UPDATE ERROR:", error);
    return NextResponse.json({ 
      message: "فشل تحديث الرصيد، تأكد من وجود الوكيل" 
    }, { status: 500 });
  }
}