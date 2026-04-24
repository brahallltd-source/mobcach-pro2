import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { playerId } = await req.json();
    if (!playerId) {
      return NextResponse.json({ message: "playerId مطلوب" }, { status: 400 });
    }

    // 1. جلب اللاعب مع معلومات اليوزر المرتبط به
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { user: { select: USER_SELECT_SAFE_RELATION } },
    });

    if (!player || !player.user) {
      return NextResponse.json({ message: "اللاعب أو حساب المستخدم غير موجود" }, { status: 404 });
    }

    // 2. تحديد حالة التجميد القادمة (عكس الحالية)
    const nextFrozenStatus = !player.user.frozen;

    // 3. تحديث الداتابيز فـ Transaction واحدة
    const updatedUser = await prisma.$transaction(async (tx) => {
      // تحديث حالة التجميد فـ جدول اليوزر (المسؤول عن Login)
      const user = await tx.user.update({
        where: { id: player.userId },
        data: {
          frozen: nextFrozenStatus,
          accountStatus: nextFrozenStatus ? UserAccountStatus.SUSPENDED : UserAccountStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });

      // ملاحظة: إذا كان عندك حقل status فـ Player بغيتي تبدلو مع التجميد، زيدو هنا
      // مثلاً: await tx.player.update({ where: { id: playerId }, data: { status: nextFrozenStatus ? "FROZEN" : "ACTIVE" } });

      return user;
    });

    return NextResponse.json({ 
      success: true,
      message: nextFrozenStatus ? "تم تجميد حساب اللاعب ❄️" : "تم إلغاء تجميد حساب اللاعب ✅", 
      player: {
        ...player,
        frozen: updatedUser.frozen
      }
    });

  } catch (error: any) {
    console.error("TOGGLE PLAYER FREEZE ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة تغيير حالة حساب اللاعب." 
    }, { status: 500 });
  }
}