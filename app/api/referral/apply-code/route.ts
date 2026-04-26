import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { createReferral } from "@/lib/bonus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { email, agentCode } = await req.json();

    if (!email || !agentCode) {
      return NextResponse.json({ message: "email and agentCode are required" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanAgentCode = String(agentCode).trim();

    // 1. البحث عن اللاعب في قاعدة البيانات
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail, role: "PLAYER" }
    });

    if (!user) {
      return NextResponse.json({ message: "Player not found" }, { status: 404 });
    }

    const player = await prisma.player.findFirst({
      where: { userId: user.id }
    });

    if (!player) {
      return NextResponse.json({ message: "Player profile not found" }, { status: 404 });
    }

    // 2. البحث عن الوكيل بالكود أو اسم المستخدم
    const agent = await prisma.agent.findFirst({
      where: {
        OR: [
          { referralCode: cleanAgentCode },
          { username: cleanAgentCode },
          { id: cleanAgentCode }
        ],
        status: { in: ["ACTIVE", "active", "account_created"] }
      }
    });

    if (!agent) {
      return NextResponse.json({ message: "Invalid agent code" }, { status: 400 });
    }

    // 3. تحديث بيانات اللاعب واليوزر لربطهم بالوكيل (في عملية واحدة)
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { assignedAgentId: agent.id, playerStatus: "active" }
      });

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: { assignedAgentId: agent.id, status: "active" }
      });

      return { updatedUser, updatedPlayer };
    });

    // 4. 🟢 هنا صلحنا السميات باش يطابقو دالة createReferral
    await createReferral({ 
      playerUserId: user.id, 
      playerEmail: user.email, 
      referredByAgentId: agent.id 
    });

    // 5. إرسال إشعار للوكيل
    await createNotification({
      userId: agent.userId,
      title: "Referral code used",
      message: `${user.username || user.email} applied your agent code.`,
    });

    return NextResponse.json({ 
      message: "Referral code applied successfully", 
      user: result.updatedUser, 
      player: result.updatedPlayer 
    });

  } catch (error) {
    console.error("APPLY REFERRAL CODE ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء تطبيق كود الإحالة. يرجى المحاولة لاحقاً." }, 
      { status: 500 }
    );
  }
}