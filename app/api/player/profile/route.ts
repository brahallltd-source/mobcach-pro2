import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب البيانات (GET)
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database error", profile: null }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get("email") || "").trim().toLowerCase();

    if (!email) return NextResponse.json({ message: "Email is required", profile: null }, { status: 400 });

    const user = await prisma.user.findFirst({
      where: { email, role: "PLAYER" },
      include: { player: true } 
    });

    if (!user || !user.player) {
      return NextResponse.json({ message: "Player profile not found", profile: null }, { status: 404 });
    }

    return NextResponse.json({ 
      profile: { 
        user_id: user.id, 
        email: user.email, 
        phone: user.player.phone || "—",
        firstName: user.player.firstName || "—",
        first_name: user.player.firstName || "—",
        lastName: user.player.lastName || "—",
        last_name: user.player.lastName || "—",
        username: user.player.username || user.username || "—",
        city: user.player.city || "—",
        country: user.player.country || "—",
        status: user.player.status || user.playerStatus || "inactive",
        assigned_agent_id: user.player.assignedAgentId || "—"
      } 
    });

  } catch (error) {
    console.error("GET PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ في جلب البيانات" }, { status: 500 });
  }
}

// 🔵 تحديث البيانات (POST) - كيشمل الإيميل، الهاتف، والباشورد
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const { currentEmail, newEmail, newPhone, newPassword, firstName, lastName } = body;

    if (!currentEmail || !newEmail) {
      return NextResponse.json({ message: "البريد الإلكتروني الحالي والجديد مطلوبان" }, { status: 400 });
    }

    const currEmailClean = String(currentEmail).trim().toLowerCase();
    const newEmailClean = String(newEmail).trim().toLowerCase();

    // 1. جلب المستخدم الحالي
    const user = await prisma.user.findFirst({
      where: { email: currEmailClean, role: "PLAYER" },
      include: { player: true }
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
    const userUpdateData: any = { email: newEmailClean };
    if (newPassword && newPassword.length >= 6) {
      userUpdateData.passwordHash = await hashPassword(newPassword);
    }

    const playerUpdateData: any = {};
    if (newPhone) playerUpdateData.phone = String(newPhone).trim();
    if (firstName) playerUpdateData.firstName = String(firstName).trim();
    if (lastName) playerUpdateData.lastName = String(lastName).trim();

    // 4. التحديث في Transaction واحدة
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: userUpdateData
      });

      const updatedPlayer = await tx.player.update({
        where: { userId: user.id },
        data: playerUpdateData
      });

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