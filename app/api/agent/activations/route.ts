import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

// دالة بناء الرسالة الرسمية (بقات كما هي)
function buildOfficialMessage(payload: { username: string; password: string; email: string; whatsapp: string }) {
  const { username, password, email, whatsapp } = payload;
  return `مرحبًا، تم إنشاء حسابك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}

بيانات التواصل:
- Email: ${email}
- WhatsApp: ${whatsapp}

يرجى عدم مشاركة هذه المعلومات مع أي شخص.`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const prisma = getPrisma();

  try {
    // 1. البحث عن الوكيل عن طريق الإيميل الخاص باليوزر
    const agent = await prisma.agent.findFirst({
      where: { user: { email: email || "" } }
    });

    if (!agent) return NextResponse.json({ players: [] });

    // 2. جلب اللاعبين اللي ختاروا هاد الوكيل (Prisma)
    const dbPlayers = await prisma.player.findMany({
      where: {
        assignedAgentId: agent.id,
        // تقدري تزيد هنا شرط status: "inactive" إلا بغيتي تبين غير لي مازال ما تفعلوا
      },
      include: {
        user: { select: USER_SELECT_SAFE_RELATION },
      }
    });

    // 3. تنسيق البيانات للـ Frontend
    const rows = dbPlayers.map((player: any) => {
      // هنا كنصاوبو الرسالة الافتراضية، تقدري تطوريها مستقبلاً
      const plainPassword = "🔑 سيتم تحديده"; 
      const messageText = buildOfficialMessage({
        username: player.username || player.user?.username || "",
        password: plainPassword,
        email: player.user?.email || "",
        whatsapp: player.phone || "",
      });

      return {
        ...player,
        id: player.userId, // الـ Frontend كيتسنى id
        playerEmail: player.user?.email || "",
        password: plainPassword,
        messageText,
      };
    });

    return NextResponse.json({ players: rows });
  } catch (error) {
    console.error("GET ACTIVATIONS ERROR:", error);
    return NextResponse.json({ players: [] });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { playerUserId, action } = await req.json();

    if (action === "done") {
      await createNotification({
        userId: playerUserId,
        title: "تم إرسال البيانات",
        message: "لقد قام الوكيل بإرسال بيانات دخولك الرسمية.",
      });
      return NextResponse.json({ message: "Marked as sent successfully ✅" });
    }

    // 🟢 تفعيل اللاعب في جداول User و Player دقة وحدة
    const result = await prisma.$transaction([
      prisma.user.update({
        where: { id: playerUserId },
        data: { playerStatus: "active" }
      }),
      prisma.player.update({
        where: { userId: playerUserId },
        data: { status: "active" }
      })
    ]);

    await createNotification({
      userId: playerUserId,
      title: "تم تفعيل الحساب",
      message: "حسابك الآن نشط ويمكنك البدء في إرسال طلبات الشحن.",
    });

    return NextResponse.json({ 
      message: "Player activated successfully ✅", 
      user: result[0], 
      player: result[1] 
    });
  } catch (error) {
    console.error("ACTIVATE PLAYER ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء التفعيل" }, { status: 500 });
  }
}