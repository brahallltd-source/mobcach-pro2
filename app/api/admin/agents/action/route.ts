import { getPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
    const { agentId, userId, action, value } = await req.json();
    const prisma = getPrisma();
  
    try {
      if (action === "CHANGE_STATUS") {
        // تعطيل أو تفعيل الحساب
        await prisma.user.update({
          where: { id: userId },
          data: { status: value } // ACTIVE أو SUSPENDED
        });
      }
  
      if (action === "ADJUST_BALANCE") {
        // تعديل الرصيد يدوياً (سحب أو زيادة)
        await prisma.agent.update({
          where: { id: agentId },
          data: { availableBalance: value }
        });
      }
  
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: "فشل في تنفيذ العملية" }, { status: 500 });
    }
  }