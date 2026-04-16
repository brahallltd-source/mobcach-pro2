import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json({ invites: [], message: "Database Error" }, { status: 500 });
    }

    // 1. جلب الدعوات (Referrals) من الداتابيز
    const referrals = await prisma.referral.findMany({
      where: {
        // إذا صيفطنا agentId كنفلترو بيه، وإلا كنجيبو كولشي (للآدمين مثلاً)
        ...(agentId ? { referredByAgentId: String(agentId) } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 2. تنسيق البيانات لتتوافق مع الـ Frontend القديم (Snake Case)
    // زدنا "total_recharge_amount" افتراضياً بـ 0 حيت الـ Schema مافيهش هاد الحقل ديريكت
    const formattedInvites = referrals.map((ref) => ({
      id: ref.id,
      agentId: ref.referredByAgentId,
      playerEmail: ref.playerEmail,
      status: ref.rewardStatus,
      created_at: ref.createdAt,
      // إلا كنتي باغي تحسب الشحن ديال كل واحد، خاصك تزيد Logic ديال Sum لـ Orders هنا
      total_recharge_amount: 0, 
    }));

    return NextResponse.json({ invites: formattedInvites });
  } catch (error) {
    console.error("GET INVITES ERROR:", error);
    return NextResponse.json({ invites: [], message: "حدث خطأ أثناء جلب الدعوات" }, { status: 500 });
  }
}