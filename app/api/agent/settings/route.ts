import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { EXECUTION_TIME_OPTIONS } from "@/lib/payment-options"; // 🟢 رجعنا الاستيراد

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const { agentId, email, phone, responseMinutes, password, bankMethods } = body;

    if (!agentId) return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });

    // 🟢 التأكد من أن وقت الاستجابة مسموح به
    const minutes = Number(responseMinutes);
    if (!EXECUTION_TIME_OPTIONS.includes(minutes)) {
      return NextResponse.json({ message: "وقت الاستجابة غير صالحة" }, { status: 400 });
    }

    // 1. فحص تكرار الإيميل (عند يوزر آخر)
    const existingUser = await prisma.user.findFirst({
      where: { 
        email: email.trim().toLowerCase(), 
        NOT: { agentProfile: { id: agentId } } 
      }
    });

    if (existingUser) {
      return NextResponse.json({ message: "هذا البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    // 2. تحديث البيانات
    const result = await prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({ where: { id: agentId } });
      if (!agent) throw new Error("Agent not found");

      // تحديث اليوزر (Email + Password)
      const userUpdate: any = { email: email.trim().toLowerCase() };
      if (password && password.length >= 6) {
        userUpdate.passwordHash = await hashPassword(password);
      }

      await tx.user.update({
        where: { id: agent.userId },
        data: userUpdate,
      });

      // تحديث بروفايل الوكيل والبنوك
      return await tx.agent.update({
        where: { id: agentId },
        data: {
          phone: phone.trim(),
          responseMinutes: minutes,
          paymentMethods: {
            deleteMany: {}, // كنمسحو القدام
            create: bankMethods?.map((name: string) => ({ methodName: name })) || []
          }
        },
        include: { paymentMethods: true, user: true }
      });
    });

    return NextResponse.json({ message: "تم تحديث إعدادات الوكيل ✅", agent: result });

  } catch (error: any) {
    console.error("AGENT SETTINGS ERROR:", error);
    return NextResponse.json({ message: "فشل تحديث الإعدادات" }, { status: 500 });
  }
}