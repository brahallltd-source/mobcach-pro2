import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { agentId } = await req.json();
    if (!agentId) {
      return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });
    }

    // 1. جلب الوكيل مع معلومات اليوزر المرتبط به
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: { select: USER_SELECT_SAFE_RELATION } },
    });

    if (!agent || !agent.user) {
      return NextResponse.json({ message: "الوكيل أو حساب المستخدم غير موجود" }, { status: 404 });
    }

    // 2. تحديد الحالة الجديدة (عكس الحالة الحالية)
    const nextFrozenStatus = !agent.user.frozen;

    // 3. تحديث الداتابيز فـ Transaction واحدة
    const updatedAgent = await prisma.$transaction(async (tx) => {
      // أ. تحديث حالة التجميد فـ جدول اليوزر (المسؤول عن تسجيل الدخول)
      await tx.user.update({
        where: { id: agent.userId },
        data: {
          frozen: nextFrozenStatus,
          accountStatus: nextFrozenStatus ? UserAccountStatus.SUSPENDED : UserAccountStatus.ACTIVE,
        },
      });

      // ب. تحديث حالة الوكيل فـ جدول الـ Agent
      // إذا جمدناه، الحالة كتولي "FROZEN". وإذا طلقناه، كيرجع "ACTIVE"
      const updated = await tx.agent.update({
        where: { id: agentId },
        data: {
          status: nextFrozenStatus ? "FROZEN" : "ACTIVE",
          updatedAt: new Date()
        }
      });

      return updated;
    });

    return NextResponse.json({ 
      success: true,
      message: nextFrozenStatus ? "تم تجميد حساب الوكيل ❄️" : "تم إلغاء تجميد الحساب ✅", 
      agent: updatedAgent 
    });

  } catch (error: any) {
    console.error("TOGGLE AGENT FREEZE ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة تغيير حالة الحساب." 
    }, { status: 500 });
  }
}