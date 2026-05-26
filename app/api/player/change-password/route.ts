import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentGoSportAuth, updateGoSportPlayerPassword } from "@/lib/gosport-api";
import { hashPassword, verifyPassword } from "@/lib/security";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database error" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmNewPassword = String(body.confirmNewPassword ?? "");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json({ success: false, message: "جميع حقول كلمة المرور مطلوبة." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل." },
        { status: 400 },
      );
    }
    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ success: false, message: "تأكيد كلمة المرور غير مطابق." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: { player: true },
    });
    if (!user || !user.player) {
      return NextResponse.json({ success: false, message: "Player profile not found." }, { status: 404 });
    }

    const currentPasswordOk = await verifyPassword(currentPassword, String(user.passwordHash ?? ""));
    if (!currentPasswordOk) {
      return NextResponse.json({ success: false, message: "كلمة المرور الحالية غير صحيحة." }, { status: 400 });
    }

    const goSportUsername = String(user.player.username ?? user.username ?? "").trim();
    if (!goSportUsername) {
      return NextResponse.json(
        { success: false, message: "لا يمكن مزامنة كلمة المرور: اسم مستخدم GoSport غير متوفر." },
        { status: 400 },
      );
    }

    const assignedAgentId = String(user.player.assignedAgentId ?? "").trim();
    if (!assignedAgentId) {
      return NextResponse.json(
        { success: false, message: "لا يمكن مزامنة كلمة المرور: لا يوجد وكيل مرتبط بالحساب." },
        { status: 400 },
      );
    }

    const assignedAgent = await prisma.agent.findUnique({
      where: { id: assignedAgentId },
      select: { id: true, userId: true },
    });
    const agentUserId = String(assignedAgent?.userId ?? "").trim();
    if (!agentUserId) {
      return NextResponse.json(
        { success: false, message: "تعذر الوصول إلى بيانات وكيل GoSport." },
        { status: 400 },
      );
    }

    const goSportAuth = await getAgentGoSportAuth(agentUserId);
    const remoteUpdate = await updateGoSportPlayerPassword(goSportAuth.accessToken, goSportUsername, newPassword);
    if (!remoteUpdate.success) {
      return NextResponse.json(
        { success: false, message: remoteUpdate.error || "فشل تحديث كلمة المرور في GoSport365." },
        { status: 400 },
      );
    }

    const nextHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
    });

    return NextResponse.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح ومزامنتها مع GoSport365.",
    });
  } catch (error) {
    console.error("PLAYER_CHANGE_PASSWORD_ERROR", error);
    const message = error instanceof Error ? error.message : "تعذر تغيير كلمة المرور حالياً.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

