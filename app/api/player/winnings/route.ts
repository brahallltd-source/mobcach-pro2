import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification, getAgentUserIdByAgentProfileId } from "@/lib/notifications";
import { notifyAllActiveAdmins } from "@/lib/in-app-notifications";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// دالة لتنسيق البيانات المرسلة للـ Frontend
function mapWithdrawal(item: any) {
  return {
    id: item.id,
    amount: Number(item.amount || 0),
    method: item.method,
    status: item.status,
    created_at: item.createdAt,
    cashProvider: item.cashProvider || null,
    rib: item.rib || null,
    swift: item.swift || null,
    gosportUsername: item.gosportUsername || null,
    kind: item.kind || null,
  };
}

export async function GET(_req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ winning: null, history: [] }, { status: 500 });
    }

    const playerEmail = String(session.email || "").trim().toLowerCase();
    if (!playerEmail) {
      return NextResponse.json({ winning: null, history: [], message: "الإيميل غير متوفر" }, { status: 400 });
    }

    // 1. جلب بيانات اللاعب والوكيل المربوط به
    const player = await prisma.player.findFirst({
      where: { user: { email: playerEmail } },
      include: { user: { select: { email: true } } },
    });

    if (!player) {
      return NextResponse.json({ message: "حساب اللاعب غير موجود", history: [] });
    }

    // 2. جلب تاريخ السحوبات السابقة (الأرباح فقط)
    const history = await prisma.withdrawal.findMany({
      where: {
        playerId: player.id,
        kind: "winner",
      },
      orderBy: { createdAt: "desc" },
    });

    const settings = await getOrCreateSystemSettings(prisma);
    const maxRaw = Number(settings.maxWithdrawalAmount);
    const maxWithdrawalAmount =
      Number.isFinite(maxRaw) && maxRaw >= 100 ? maxRaw : 100000;

    // 3. نرسلو معلومات التنبيه (Rules) باش الـ Frontend يعرضهم للاعب
    const info = {
      maxWithdrawalAmount,
      rules: [
        { 
          min: 100, 
          max: 6000, 
          time: "خلال نصف يوم", 
          method: "Gichet Automatic (Cash Sans Carte)", 
          note: "ستصلك رسالة نصية (SMS/WhatsApp) برمز السحب." 
        },
        { 
          min: 6001, 
          max: 30000, 
          time: "خلال 24 ساعة", 
          method: "تحويل بنكي محلي (Virement National)", 
          note: "يتم التحويل للحساب البنكي المصرح به." 
        },
        { 
          min: 30001, 
          max: null, // 👈 null كتعني "بدون سقف"
          time: "3 أيام إلى أسبوع", 
          method: "تحويل بنكي دولي (International Transfer)", 
          note: "يتم التحويل مباشرة من الشركة الأم بعد التصريح." 
        }
      ],
      assignedAgentId: player.assignedAgentId
    };

    return NextResponse.json({
      winning: null,
      playerInfo: {
        username: player.username,
        email: player.user.email,
        agentId: player.assignedAgentId,
      },
      history: history.map(mapWithdrawal),
      info,
    });
  } catch (error) {
    console.error("WINNINGS GET ERROR:", error);
    return NextResponse.json({ winning: null, history: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database error" }, { status: 500 });

    const body = await req.json();
    const {
      amount,
      method,
      gosportUsername,
      gosportPassword,
      rib,
      swift,
      cashProvider,
      fullName,
      phone,
      city,
    } = body;

    const playerEmail = String(session.email || "").trim().toLowerCase();
    if (!playerEmail || !amount || !gosportUsername || !gosportPassword) {
      return NextResponse.json({ message: "جميع معلومات الحساب والمبلغ مطلوبة" }, { status: 400 });
    }

    // 1. جلب اللاعب والوكيل المسؤول عنه
    const player = await prisma.player.findFirst({
      where: { user: { email: playerEmail } },
      include: { user: { select: { email: true } } },
    });

    if (!player) return NextResponse.json({ message: "اللاعب غير موجود" }, { status: 404 });

    // 2. التحقق من مبلغ السحب وتطبيق القواعد
    if (amount < 100) return NextResponse.json({ message: "أقل مبلغ للتصريح هو 100 درهم" }, { status: 400 });

    const settings = await getOrCreateSystemSettings(prisma);
    const maxRaw = Number(settings.maxWithdrawalAmount);
    const maxWithdrawalAmount =
      Number.isFinite(maxRaw) && maxRaw >= 100 ? maxRaw : 100000;
    if (Number(amount) > maxWithdrawalAmount) {
      return NextResponse.json(
        {
          message: `الحد الأقصى المسموح به لكل طلب هو ${maxWithdrawalAmount} درهم. راجع الإعدادات أو قسّم المبلغ.`,
        },
        { status: 400 },
      );
    }

    // 3. إنشاء طلب السحب (التصريح بالربح)
    const withdrawal = await prisma.withdrawal.create({
      data: {
        playerId: player.id,
        playerEmail,
        agentId: player.assignedAgentId, // ربط الطلب بالوكيل الخاص باللاعب
        amount: Number(amount),
        method: method, // bank or cash
        status: "pending",
        kind: "winner",
        gosportUsername,
        // تخزين الباسوورد فـ ملاحظة الإدارة بشكل آمن
        adminNote: `GoSport Password: ${gosportPassword} | Note: طلب ربح جديد`,
        rib: method === "bank" ? rib : null,
        swift: method === "bank" ? swift : null,
        cashProvider: method === "cash" ? cashProvider : null,
        fullName: fullName || player.firstName + " " + player.lastName,
        phone: phone || player.phone,
        city: city || ""
      }
    });

    if (player.assignedAgentId) {
      const agentUserId = await getAgentUserIdByAgentProfileId(player.assignedAgentId);
      if (agentUserId) {
        await createNotification({
          userId: agentUserId,
          title: "تأكيد ربح لاعب 🏆",
          message: `اللاعب ${player.username} صرح بربح ${amount} DH. المرجو التفقد.`,
        });
      }
    }

    await notifyAllActiveAdmins({
      title: "طلب سحب أرباح جديد",
      message: `لاعب صرح بربح ${amount} DH. الطريقة: ${method}.`,
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال تصريح الربح بنجاح ✅. سيتم معالجة طلبك حسب السلم الزمني للمبالغ.",
      withdrawal: mapWithdrawal(withdrawal)
    });

  } catch (error) {
    console.error("WINNINGS POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال الطلب" }, { status: 500 });
  }
}