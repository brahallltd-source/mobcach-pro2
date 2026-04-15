import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const prisma = getPrisma();

  try {
    console.log("🔍 Fetching all agents for admin...");

    // كنقلبو فـ جدول الـ User على كاع لي عندهم Role هو AGENT
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        createdAt: true,
        // التكامل السحري: كنجيبو معلومات المحفظة من الجدول الآخر
        agentProfile: {
          select: {
            id: true,
            availableBalance: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // الجديد هو اللول
      },
    });

    return NextResponse.json(agents);
  } catch (error: any) {
    console.error("🔥 Error fetching agents:", error.message);
    return NextResponse.json(
      { error: "تعذر جلب قائمة الوكلاء" },
      { status: 500 }
    );
  }
}