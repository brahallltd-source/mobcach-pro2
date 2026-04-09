import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available", profile: null }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get("email") || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ message: "Email is required", profile: null }, { status: 400 });
    }

    // البحث في قاعدة بيانات Prisma بدلاً من ملفات JSON
    const user = await prisma.user.findFirst({
      where: { email: email, role: "PLAYER" },
      include: { player: true } // جلب بيانات الـ Player المرتبطة به
    });

    if (!user) {
      return NextResponse.json({ message: "Player user not found", profile: null }, { status: 404 });
    }

    if (!user.player) {
      return NextResponse.json({ message: "Player profile not found", profile: null }, { status: 404 });
    }

    // إرجاع البيانات بنفس الهيكلة التي تتوقعها واجهة المستخدم
    return NextResponse.json({ 
      profile: { 
        user_id: user.id, 
        email: user.email, 
        phone: user.player.phone,
        firstName: user.player.firstName,
        lastName: user.player.lastName,
        status: user.player.status,
        assigned_agent_id: user.player.assignedAgentId
      } 
    });

  } catch (error) {
    console.error("GET PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ 
      message: "Something went wrong. We could not complete your request right now.", 
      profile: null 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const { currentEmail, newEmail, newPhone } = await req.json();

    if (!currentEmail || !newEmail || !newPhone) {
      return NextResponse.json({ message: "currentEmail, newEmail and newPhone are required" }, { status: 400 });
    }

    const currEmailClean = String(currentEmail).trim().toLowerCase();
    const newEmailClean = String(newEmail).trim().toLowerCase();

    // 1. جلب المستخدم الحالي
    const user = await prisma.user.findFirst({
      where: { email: currEmailClean, role: "PLAYER" },
      include: { player: true }
    });

    if (!user || !user.player) {
      return NextResponse.json({ message: "Player profile not found" }, { status: 404 });
    }

    // 2. التحقق من أن الإيميل الجديد غير مستخدم من طرف شخص آخر
    if (currEmailClean !== newEmailClean) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: newEmailClean }
      });
      if (emailTaken) {
        return NextResponse.json({ message: "This email is already used by another account" }, { status: 400 });
      }
    }

    // 3. تحديث البيانات في قاعدة البيانات باستخدام Transaction لضمان تزامن التحديث
    const [updatedUser, updatedPlayer] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { email: newEmailClean }
      }),
      prisma.player.update({
        where: { userId: user.id },
        data: { phone: String(newPhone).trim() }
      })
    ]);

    return NextResponse.json({ 
      message: "Profile updated successfully ✅", 
      user: { 
        id: updatedUser.id, 
        email: updatedUser.email, 
        role: updatedUser.role.toLowerCase(), 
        player_status: updatedPlayer.status || "inactive", 
        assigned_agent_id: updatedPlayer.assignedAgentId || "" 
      }, 
      profile: { 
        email: updatedUser.email, 
        phone: updatedPlayer.phone 
      } 
    });

  } catch (error) {
    console.error("UPDATE PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ 
      message: "Something went wrong. We could not complete your request right now." 
    }, { status: 500 });
  }
}