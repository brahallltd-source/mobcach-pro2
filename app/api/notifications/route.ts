import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ notifications: [] });
    }

    const { searchParams } = new URL(req.url);
    // دعمنا targetRole و role بجوج باش مايوقعش تعارض مع الواجهة ديالك
    const targetRole = searchParams.get("targetRole") || searchParams.get("role"); 
    const targetId = searchParams.get("targetId");

    if (!targetRole || !targetId) {
      return NextResponse.json({ notifications: [] });
    }

    // جلب الإشعارات من قاعدة البيانات الحقيقية
    const notifications = await prisma.notification.findMany({
      where: {
        targetRole: targetRole,
        targetId: String(targetId),
      },
      orderBy: {
        createdAt: "desc", // من الأحدث للأقدم
      },
      take: 30, // نجيبو غير آخر 30 إشعار باش يكون السيرفر خفيف
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}

// زدنا هاد الدالة باش ملي اللاعب ولا الوكيل يقرا الإشعار، يتحيد ليه داك الرقم الأحمر (Unread badge)
export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ success: false });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false }, { status: 400 });

    await prisma.notification.update({
      where: { id: String(id) },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE NOTIFICATION ERROR:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}