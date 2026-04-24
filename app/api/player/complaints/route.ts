import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب الشكايات الخاصة باللاعب (عبر الإيميل)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const prisma = getPrisma();

    if (!prisma) return NextResponse.json({ complaints: [] }, { status: 500 });

    // جلب الشكايات مع الفلترة بالإيميل إذا وجد
    const complaints = await prisma.complaint.findMany({
      where: email ? { playerEmail: email } : {},
      orderBy: { createdAt: "desc" },
    });

    // تنسيق البيانات لتتوافق مع الـ Frontend (Snake Case)
    const formatted = complaints.map((c) => ({
      ...c,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      admin_reply: c.adminReply, // توافق مع الحقل فـ JSON القديم
    }));

    return NextResponse.json({ complaints: formatted });
  } catch (error) {
    console.error("GET PLAYER COMPLAINTS ERROR:", error);
    return NextResponse.json({ complaints: [], message: "Error fetching data" }, { status: 500 });
  }
}

// 🔵 إرسال شكاية جديدة من طرف اللاعب
export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as {
      playerEmail?: string;
      subject?: string;
      message?: string;
    };
    const playerEmail = String(session.email || "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!playerEmail || !subject || !message) {
      return NextResponse.json({ message: "المرجو ملء جميع الحقول المطلوبة" }, { status: 400 });
    }

    if (body.playerEmail != null && String(body.playerEmail).trim().toLowerCase() !== playerEmail) {
      return NextResponse.json({ message: "لا يتطابق البريد مع الجلسة" }, { status: 400 });
    }

    // 1. إنشاء الشكاية فـ الداتابيز
    const complaint = await prisma.complaint.create({
      data: {
        playerEmail,
        subject,
        message,
        status: "pending", // الحالة الافتراضية
      },
    });

    // 2. إشعار الآدمين بوجود شكاية جديدة
    await createNotification({
      targetRole: "admin",
      targetId: "admin",
      title: "شكاية جديدة ⚠️",
      message: `قام اللاعب ${playerEmail} بفتح شكاية بخصوص: ${subject}.`,
    });

    return NextResponse.json({ 
      success: true,
      message: "تم إرسال شكواك بنجاح ✅", 
      complaint: {
        ...complaint,
        created_at: complaint.createdAt
      } 
    });

  } catch (error: any) {
    console.error("PLAYER COMPLAINT POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال الشكاية" }, { status: 500 });
  }
}