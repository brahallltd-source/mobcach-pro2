import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// 🟢 هادي ضرورية باش Next.js ما يحاولش يدير ليها Cache فـ وقت الـ Build
export const dynamic = "force-dynamic";

export async function GET(req: Request) { // 👈 زدنا req هنا باش يتهنى الـ build
  try {
    const prisma = getPrisma();
    
    // 1. جلب البلاغات مع معلومات اللاعب (عبر اليوزر) والوكيل
    const flags = await prisma.fraudFlag.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: {
            player: {
              include: {
                user: true 
              }
            },
            agent: true
          }
        }
      }
    });

    // 2. تنسيق البيانات
    const formattedFlags = flags.map((flag: any) => ({
      ...flag,
      order: {
        ...flag.order,
        player: {
          email: flag.order?.player?.user?.email || flag.order?.player?.username || "N/A",
          username: flag.order?.player?.username || "N/A",
        },
        agent: {
          email: flag.order?.agent?.email || flag.order?.agent?.username || "N/A",
          username: flag.order?.agent?.username || "N/A",
        }
      }
    }));

    // 3. حساب الإحصائيات
    const summary = {
      suspiciousOrders: formattedFlags.length,
      pendingFlags: formattedFlags.filter((f: any) => !f.resolved).length,
      highRisk: formattedFlags.filter((f: any) => f.score >= 70).length,
    };

    return NextResponse.json({ items: formattedFlags, summary });
  } catch (error) {
    console.error("ADMIN FRAUD API ERROR:", error);
    return NextResponse.json({ items: [], summary: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { flagId, orderId, action, note } = await req.json();

    if (action === "resolve") {
      await prisma.$transaction([
        prisma.fraudFlag.update({ 
          where: { id: flagId }, 
          data: { resolved: true, note: `[حل الإدارة]: ${note || 'بدون ملاحظات'}` } 
        }),
        prisma.order.update({ 
          where: { id: orderId }, 
          data: { status: "proof_uploaded", reviewRequired: false } // 👈 حيدنا السينيال هنا دقة وحدة
        })
      ]);
    } else if (action === "reopen") {
      await prisma.$transaction([
        prisma.fraudFlag.update({ 
          where: { id: flagId }, 
          data: { resolved: false, note: `[معاد فتحه]: ${note || 'بدون ملاحظات'}` } 
        }),
        prisma.order.update({ 
          where: { id: orderId }, 
          data: { status: "flagged_for_review", reviewRequired: true } 
        })
      ]);
    }

    return NextResponse.json({ success: true, message: "تم تحديث حالة البلاغ بنجاح" });
  } catch (error) {
    console.error("ADMIN FRAUD POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ فني أثناء المعالجة" }, { status: 500 });
  }
}