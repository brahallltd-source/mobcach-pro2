import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { normalizePhoneWithCountry } from "@/lib/countries";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email || !username || !password || !phone) {
      return NextResponse.json({ message: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    // فحص التكرار
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return NextResponse.json({ message: "البريد الإلكتروني أو اسم المستخدم موجود مسبقاً" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    let assignedAgentId: string | null = null;
    let playerStatus: string = "inactive"; 
    let nextStep = "/player/select-agent"; // المسار الافتراضي

    // 🟢 البحث عن الوكيل (تطوير البحث)
    const agentInput = String(body.agent_code || "").trim();

    if (agentInput !== "") {
      const agent = await prisma.agent.findFirst({
        where: {
          OR: [
            { username: agentInput },
            { referralCode: agentInput },
            { id: agentInput }
          ],
          // ⚠️ التعديل هنا: نقبل الوكيل حتى لو كان يلاه تكريا حسابه
          status: { in: ["ACTIVE", "active", "account_created", "pending"] } 
        },
      });

      if (agent) {
        assignedAgentId = agent.id;
        playerStatus = "inactive"; // كيبقى inactive حتى يفعلو الوكيل من Activations
        nextStep = "/player/dashboard"; // كيدوز للداشبورد مباشرة
      } else {
        // إذا دخل كود غلط، نوقفه هنا أحسن ما نخليه يكمل
        return NextResponse.json({ message: "كود الوكيل غير صحيح أو الوكيل غير موجود" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: "PLAYER",
          playerStatus: playerStatus as any,
          assignedAgentId,
        },
      });

      const player = await tx.player.create({
        data: {
          userId: user.id,
          firstName: String(body.first_name || ""),
          lastName: String(body.last_name || ""),
          username,
          phone: normalizePhoneWithCountry(phone, body.country || "Morocco"),
          status: playerStatus as any,
          assignedAgentId,
          country: String(body.country || "Morocco"),
        },
      });

      return { user, player };
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        role: "player",
        status: result.user.playerStatus,
        assigned_agent_id: result.user.assignedAgentId,
      },
      nextStep: nextStep, // 👈 هادي غيستعملها الـ Frontend للتوجيه
    });

  } catch (error: any) {
    console.error("REGISTER ERROR:", error);
    return NextResponse.json({ message: "خطأ في السيرفر" }, { status: 500 });
  }
}