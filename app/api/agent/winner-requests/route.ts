import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🟢 جلب طلبات الأرباح
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!prisma) return NextResponse.json({ requests: [] }, { status: 500 });

    // جلب الطلبات (فلترة بالوكيل إذا وجد)
    const requests = await prisma.winnerRequest.findMany({
      where: agentId ? { agentId: String(agentId) } : {},
      orderBy: { createdAt: "desc" },
    });

    // تنسيق البيانات للـ Frontend (Snake Case)
    const formatted = requests.map((r) => ({
      ...r,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));

    return NextResponse.json({ requests: formatted });
  } catch (error) {
    console.error("GET WINNER REQUESTS ERROR:", error);
    return NextResponse.json({ message: "خطأ في جلب البيانات", requests: [] }, { status: 500 });
  }
}

// 🔵 إرسال طلب تأكيد ربح جديد
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const { playerEmail, agentId, amount, note } = await req.json();

    if (!playerEmail || !agentId || !amount) {
      return NextResponse.json({ message: "البيانات المطلوبة ناقصة" }, { status: 400 });
    }

    // 1. إنشاء الطلب في الداتابيز
    const record = await prisma.winnerRequest.create({
      data: {
        playerEmail: String(playerEmail),
        agentId: String(agentId),
        amount: Number(amount),
        note: String(note || ""),
        status: "pending",
      },
    });

    const agentUserId = await getAgentUserIdByAgentProfileId(String(agentId));
    const notifs: Promise<unknown>[] = [
      notifyAllActiveAdmins({
        title: "طلب أرباح قيد الانتظار",
        message: `هناك طلب تأكيد أرباح جديد يحتاج للمراجعة.`,
      }),
    ];
    if (agentUserId) {
      notifs.push(
        createNotification({
          userId: agentUserId,
          title: "طلب تأكيد أرباح 🏆",
          message: `اللاعب ${playerEmail} أرسل طلب تأكيد ربح بمبلغ ${amount} DH.`,
        })
      );
    }
    await Promise.all(notifs);

    return NextResponse.json({ 
      success: true,
      message: "تم إرسال طلب تأكيد الأرباح بنجاح ✅", 
      request: {
        ...record,
        created_at: record.createdAt // توافق مع القديم
      }
    });

  } catch (error: any) {
    console.error("POST WINNER REQUESTS ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال الطلب" }, { status: 500 });
  }
}