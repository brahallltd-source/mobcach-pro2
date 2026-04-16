import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ضرورية لـ Next.js 15

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

    // 1. جلب اليوزر (اللاعب)
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

    // 3. جلب الوكيل (البحث عن أي حالة نشطة)
    const agent = await prisma.agent.findFirst({
      where: {
        id: cleanAgentId,
        status: { in: ["ACTIVE", "active", "account_created", "pending"] } 
      },
    });

    if (!agent) {
      return NextResponse.json({ message: "الوكيل المختار غير متاح حالياً" }, { status: 404 });
    }

    // 4. تنفيذ العملية في Transaction واحدة لضمان سلامة البيانات
    const result = await prisma.$transaction(async (tx) => {
      // تحديث اليوزر
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          assignedAgentId: cleanAgentId,
          playerStatus: "active", // نفعلوه باش يقدر يدخل للداشبورد
        },
      });

      // تحديث البروفايل
      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          assignedAgentId: cleanAgentId,
          status: "active",
          referredBy: player.referredBy || cleanAgentId,
        },
      });

      // إدارة سجل التفعيل (Activation)
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
            whatsapp: updatedPlayer.phone || "",
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
            passwordPlain: "123456", // كلمة سر افتراضية للتغيير
            whatsapp: updatedPlayer.phone || "",
            status: "pending_activation",
          },
        });
      }

      // تسجيل سجل تتبع للطلبات (اختياري حسب منطقك)
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

    // 5. الإشعارات
    await createNotification({
      targetRole: "agent",
      targetId: cleanAgentId,
      title: "لاعب جديد",
      message: `قام ${cleanEmail} باختيارك كوكيل له.`,
    });

    await createNotification({
      targetRole: "player",
      targetId: user.id,
      title: "تم الربط بنجاح",
      message: "تم ربط حسابك بالوكيل بنجاح. يمكنك الآن البدء بطلب الشحن.",
    });

    return NextResponse.json({
      success: true,
      message: "تم اختيار الوكيل بنجاح ✅",
      user: {
        id: result.updatedUser.id,
        email: result.updatedUser.email,
        username: result.updatedUser.username,
        role: "player",
        player_status: result.updatedUser.playerStatus,
        assigned_agent_id: result.updatedUser.assignedAgentId,
        created_at: result.updatedUser.createdAt,
      },
      player: result.updatedPlayer,
    });

  } catch (error: any) {
    console.error("SELECT AGENT ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء عملية الربط، المرجو المحاولة لاحقاً." 
    }, { status: 500 });
  }
}