import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { playerId } = await req.json();
    if (!playerId) return NextResponse.json({ message: "playerId مطلوب" }, { status: 400 });

    // 1. جلب بيانات اللاعب واليوزر المرتبط به
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { user: { select: USER_SELECT_SAFE_RELATION } },
    });

    if (!player) {
      return NextResponse.json({ message: "اللاعب غير موجود" }, { status: 404 });
    }

    // 2. التنفيذ فـ Transaction لضمان تنظيف كاع الجداول
    await prisma.$transaction(async (tx) => {
      // أ. مسح الطلبات (Orders) المرتبطة بهذا اللاعب
      // فـ الداتابيز، من الأحسن نمسحو الطلبات أو نفصلوها قبل مسح اللاعب
      await tx.order.deleteMany({
        where: { playerId: playerId }
      });

      // ب. مسح الشكايات (Complaints) باستعمال الإيميل (كيف كان فـ الكود القديم)
      await tx.complaint.deleteMany({
        where: { playerEmail: player.user.email }
      });

      // ج. مسح السحوبات (Withdrawals)
      await tx.withdrawal.deleteMany({
        where: { playerId: playerId }
      });

      // د. مسح اليوزر (وهو غايجر معاه الـ Player Profile بـ Cascade)
      await tx.user.delete({
        where: { id: player.userId }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم حذف اللاعب وكافة بياناته بنجاح ✅" 
    });

  } catch (error: any) {
    console.error("DELETE PLAYER ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء محاولة حذف اللاعب، المرجو المحاولة لاحقاً." 
    }, { status: 500 });
  }
}