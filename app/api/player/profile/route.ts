import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب البيانات (GET)
export async function GET(_req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Unauthorized", profile: null },
        { status: 401 }
      );
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden", profile: null }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database error", profile: null }, { status: 500 });

    const email = String(session.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ message: "Email is required", profile: null }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email, role: "PLAYER" },
      include: { player: true },
    });

    if (!user || !user.player) {
      return NextResponse.json({ message: "Player profile not found", profile: null }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        user_id: user.id,
        email: user.email,
        phone: user.player.phone || user.phone || "—",
        firstName: user.player.firstName || "—",
        first_name: user.player.firstName || "—",
        lastName: user.player.lastName || "—",
        last_name: user.player.lastName || "—",
        username: user.player.username || user.username || "—",
        city: user.player.city || "—",
        country: user.player.country || "—",
        date_of_birth: user.player.dateOfBirth || "—",
        status: user.player.status || user.playerStatus || "inactive",
        assigned_agent_id: user.player.assignedAgentId || "—",
        pendingAgentRequest: user.pendingAgentRequest,
      },
    });

  } catch (error) {
    console.error("GET PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ في جلب البيانات" }, { status: 500 });
  }
}

// 🔵 تحديث البيانات (POST) - كيشمل الإيميل، الهاتف، والباشورد
export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database error" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { newEmail, newPhone, newPassword, firstName, lastName, currentEmail } = body;

    const currEmailClean = String(session.email || "").trim().toLowerCase();
    if (!currEmailClean) {
      return NextResponse.json({ message: "البريد الإلكتروني غير متوفر في الجلسة" }, { status: 400 });
    }

    const newEmailRaw = newEmail != null ? String(newEmail) : "";
    const newEmailClean = newEmailRaw.trim().toLowerCase();
    if (!newEmailClean) {
      return NextResponse.json({ message: "البريد الإلكتروني مطلوب" }, { status: 400 });
    }

    if (currentEmail != null && String(currentEmail).trim().toLowerCase() !== currEmailClean) {
      return NextResponse.json({ message: "لا يتطابق البريد الحالي مع الجلسة" }, { status: 400 });
    }

    // 1. جلب المستخدم الحالي
    const user = await prisma.user.findFirst({
      where: { email: currEmailClean, role: "PLAYER" },
      include: { player: true },
    });

    if (!user || !user.player) {
      return NextResponse.json({ message: "لم يتم العثور على بروفايل اللاعب" }, { status: 404 });
    }

    // 2. التحقق من الإيميل الجديد إذا تغير
    if (currEmailClean !== newEmailClean) {
      const emailTaken = await prisma.user.findUnique({ where: { email: newEmailClean } });
      if (emailTaken) return NextResponse.json({ message: "هذا البريد مستخدم من قبل حساب آخر" }, { status: 400 });
    }

    // 3. تجهيز بيانات التحديث
    const userUpdateData: Record<string, unknown> = { email: newEmailClean };
    const pwdStr =
      typeof newPassword === "string" ? newPassword : newPassword != null ? String(newPassword) : "";
    if (pwdStr.length >= 6) {
      userUpdateData.passwordHash = await hashPassword(pwdStr);
    }

    const playerUpdateData: Record<string, unknown> = {};
    const phoneStr = newPhone != null ? String(newPhone).trim() : "";
    if (phoneStr) {
      playerUpdateData.phone = phoneStr;
      userUpdateData.phone = phoneStr;
    }
    if (firstName) playerUpdateData.firstName = String(firstName).trim();
    if (lastName) playerUpdateData.lastName = String(lastName).trim();

    // 4. التحديث في Transaction واحدة
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: userUpdateData as object,
      });

      const updatedPlayer =
        Object.keys(playerUpdateData).length > 0
          ? await tx.player.update({
              where: { userId: user.id },
              data: playerUpdateData as object,
            })
          : await tx.player.findUniqueOrThrow({ where: { userId: user.id } });

      return { updatedUser, updatedPlayer };
    });

    return NextResponse.json({ 
      message: "تم تحديث الملف الشخصي بنجاح ✅", 
      // إرجاع كائن User متوافق مع localStorage لضمان استمرار الجلسة
      user: { 
        id: result.updatedUser.id, 
        email: result.updatedUser.email, 
        username: result.updatedUser.username,
        role: "player", 
        player_status: result.updatedPlayer.status || "active", 
        assigned_agent_id: result.updatedPlayer.assignedAgentId || "" 
      }
    });

  } catch (error) {
    console.error("UPDATE PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ message: "تعذر تحديث البيانات حالياً" }, { status: 500 });
  }
}