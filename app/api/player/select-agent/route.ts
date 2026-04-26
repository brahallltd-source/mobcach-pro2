import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { playerEmail, agentId } = await req.json();

    const cleanEmail = String(playerEmail || "").trim().toLowerCase();
    const cleanAgentId = String(agentId || "").trim();

    if (!cleanEmail || !cleanAgentId) {
      return NextResponse.json({ message: "بيانات ناقصة: البريد الإلكتروني أو معرف الوكيل" }, { status: 400 });
    }

    // 1. جلب اليوزر (اللاعب) من قاعدة البيانات
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail, role: "PLAYER" },
    });

    if (!user) {
      return NextResponse.json({ message: "لاعب غير موجود بهذا البريد" }, { status: 404 });
    }

    // 2. جلب بروفايل اللاعب
    const player = await prisma.player.findFirst({
      where: { userId: user.id },
    });

    if (!player) {
      return NextResponse.json({ message: "بروفايل اللاعب غير موجود" }, { status: 404 });
    }

    // 3. التأكد من وجود الوكيل وصلاحية حالته
    const agent = await prisma.agent.findFirst({
      where: {
        id: cleanAgentId,
        status: { in: ["ACTIVE", "active", "account_created", "pending"] } 
      },
    });

    if (!agent) {
      return NextResponse.json({ message: "الوكيل المختار غير متاح حالياً" }, { status: 404 });
    }

    // 4. تنفيذ العمليات داخل Transaction لضمان التزامن
    const result = await prisma.$transaction(async (tx) => {
      // تحديث حالة اليوزر
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          assignedAgentId: cleanAgentId,
          playerStatus: "active",
          status: "ACTIVE",
          rejectionReason: null,
        },
      });

      // تحديث حالة البروفايل
      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          assignedAgentId: cleanAgentId,
          status: "active",
          referredBy: player.referredBy || cleanAgentId,
        },
      });

      const existingLink = await tx.agentCustomer.findUnique({
        where: {
          agentId_playerId: { agentId: cleanAgentId, playerId: player.id },
        },
      });
      if (!existingLink) {
        await tx.agentCustomer.create({
          data: {
            agentId: cleanAgentId,
            playerId: player.id,
            status: "CONNECTED",
          },
        });
      }

      // 🟢 حل مشكلة الـ upsert: البحث أولاً ثم التحديث أو الإنشاء
      const existingActivation = await tx.activation.findFirst({
        where: { playerUserId: user.id },
      });

      if (existingActivation) {
        await tx.activation.update({
          where: { id: existingActivation.id },
          data: {
            agentId: cleanAgentId,
            playerEmail: updatedUser.email,
            username: updatedUser.username,
            status: "pending_activation",
          },
        });
      } else {
        await tx.activation.create({
          data: {
            agentId: cleanAgentId,
            playerUserId: updatedUser.id,
            playerEmail: updatedUser.email,
            username: updatedUser.username,
            passwordPlain: "", // 🟢 تم إخلاؤه ليعبئه الوكيل يدوياً
            whatsapp: updatedPlayer.phone || "",
            status: "pending_activation",
          },
        });
      }

      // تسجيل سجل تتبع لعملية الربط
      await tx.order.create({
        data: {
          agentId: cleanAgentId,
          playerEmail: updatedUser.email,
          amount: 0,
          gosportUsername: updatedUser.username || "",
          status: "linked_waiting_first_order",
          reviewRequired: false
        },
      });

      return { updatedUser, updatedPlayer };
    });

    const agentUserId = await getAgentUserIdByAgentProfileId(cleanAgentId);
    if (agentUserId) {
      await createNotification({
        userId: agentUserId,
        title: "لاعب جديد مربوط",
        message: `قام اللاعب ${result.updatedUser.username} باختيارك كوكيل له.`,
      });
    }

    await createNotification({
      userId: user.id,
      title: "تم الربط بنجاح",
      message: "تم ربط حسابك بالوكيل. يمكنك البدء بطلب الشحن الآن.",
    });

    // 6. الرد النهائي بالبيانات المطلوبة للـ LocalStorage
    return NextResponse.json({
      success: true,
      message: "تم ربط الوكيل بنجاح ✅",
      user: {
        id: result.updatedUser.id,
        email: result.updatedUser.email,
        username: result.updatedUser.username,
        role: "player",
        status: result.updatedUser.status,
        player_status: "active",
        assigned_agent_id: cleanAgentId,
        created_at: result.updatedUser.createdAt,
      },
    });

  } catch (error: any) {
    console.error("SELECT AGENT ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ غير متوقع أثناء عملية الربط." 
    }, { status: 500 });
  }
}