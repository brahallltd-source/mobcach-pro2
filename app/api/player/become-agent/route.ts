import { NextResponse } from "next/server";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
// 🟢 ضرورية باش ديما يجيب حالة الطلب "لايف"
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available", application: null }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get("userId") || "").trim();
    const email = String(searchParams.get("email") || "").trim().toLowerCase();

    if (!userId && !email) {
      return NextResponse.json({ message: "userId أو email مطلوب", application: null }, { status: 400 });
    }

    // البحث عن آخر طلب تصيفط
    const application = await prisma.agentApplication.findFirst({
      where: userId ? { userId } : { email },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ application: application || null });
  } catch (error) {
    console.error("GET BECOME AGENT ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء جلب بيانات الطلب", application: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { userId, name, phone, email, note, username, country } = await req.json();
    
    const cleanUserId = String(userId || "").trim();
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanUsername = String(username || "").trim();
    const cleanPhone = normalizePhoneWithCountry(String(phone || "").trim(), String(country || "Morocco"));
    const cleanCountry = String(country || "Morocco").trim();
    const cleanNote = String(note || "").trim();

    if (!cleanUserId || !cleanName || !cleanPhone || !cleanEmail) {
      return NextResponse.json({ message: "المرجو ملء جميع الحقول الإجبارية" }, { status: 400 });
    }

    // 1. التأكد من وجود المستخدم وحالته
    const user = await prisma.user.findUnique({ where: { id: cleanUserId } });
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.role === "AGENT") {
      return NextResponse.json({ message: "هذا الحساب هو وكيل بالفعل" }, { status: 400 });
    }

    // 2. فحص واش كاين شي طلب ديجا "Pending"
    const existing = await prisma.agentApplication.findFirst({
      where: {
        userId: cleanUserId,
        status: "pending",
      },
    });

    if (existing) {
      return NextResponse.json({ 
        message: "لديك طلب قيد المراجعة بالفعل، يرجى الانتظار.", 
        application: existing 
      }, { status: 400 });
    }

    // 3. إنشاء طلب الوكيل الجديد
    const application = await prisma.agentApplication.create({
      data: {
        userId: cleanUserId,
        fullName: cleanName,
        username: cleanUsername || user.username,
        email: cleanEmail || user.email,
        phone: cleanPhone,
        country: cleanCountry,
        note: cleanNote || null,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال طلب الانضمام لفريق الوكلاء بنجاح ✅ سيتصل بك الإدارة قريباً.",
      application,
    });
  } catch (error) {
    console.error("CREATE AGENT APPLICATION ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ فني أثناء إرسال طلبك" }, { status: 500 });
  }
}