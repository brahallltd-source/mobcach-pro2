import { NextResponse } from "next/server";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { getPrisma } from "@/lib/db";
import { notifyAllAdminsNewAgentApplication } from "@/lib/in-app-notifications";
import { assertAdultDateString, becomeAgentApplicationSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";
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

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = becomeAgentApplicationSchema.safeParse(raw);

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const first =
        (Object.values(flat).find((a) => a?.length)?.[0] as string | undefined) ??
        parsed.error.errors[0]?.message ??
        "بيانات غير صالحة";
      return NextResponse.json({ message: first }, { status: 400 });
    }

    const { userId, name, phone, email, note, username, country, city, dateOfBirth } = parsed.data;

    if (!assertAdultDateString(dateOfBirth, 18)) {
      return NextResponse.json(
        { message: "عذراً، يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل" },
        { status: 400 }
      );
    }

    const cleanUserId = String(userId || "").trim();
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanUsername = String(username || "").trim();
    const cleanPhone = normalizePhoneWithCountry(String(phone || "").trim(), String(country || "Morocco"));
    const cleanCountry = String(country || "Morocco").trim();
    const cleanCity = String(city || "").trim();
    const cleanNote = String(note || "").trim();
    const dob = new Date(dateOfBirth);

    if (!cleanUserId || !cleanName || !cleanPhone || !cleanEmail) {
      return NextResponse.json({ message: "المرجو ملء جميع الحقول الإجبارية" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: cleanUserId } });
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.role === "AGENT") {
      return NextResponse.json({ message: "هذا الحساب هو وكيل بالفعل" }, { status: 400 });
    }

    const existing = await prisma.agentApplication.findFirst({
      where: {
        userId: cleanUserId,
        status: "pending",
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          message: "لديك طلب قيد المراجعة بالفعل، يرجى الانتظار.",
          application: existing,
        },
        { status: 400 }
      );
    }

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.agentApplication.create({
        data: {
          userId: cleanUserId,
          fullName: cleanName,
          username: cleanUsername || user.username,
          email: cleanEmail || user.email,
          phone: cleanPhone,
          country: cleanCountry,
          city: cleanCity,
          birthDate: dob,
          note: cleanNote || null,
          status: "pending",
        },
      });

      await tx.user.update({
        where: { id: cleanUserId },
        data: {
          country: cleanCountry,
          city: cleanCity,
          dateOfBirth: dob,
        },
      });

      return app;
    });

    try {
      await notifyAllAdminsNewAgentApplication({
        applicantUsername: cleanUsername || user.username,
      });
    } catch (e) {
      console.error("New agent application admin notification:", e);
    }

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
