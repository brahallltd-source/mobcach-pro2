import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// ✅ منع التخزين المؤقت لضمان رؤية اللاعب للرصيد المشحون فوراً
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) return NextResponse.json({ message: "Agent ID required" }, { status: 400 });

    // البحث عن الوكيل مع جلب المحفظة المرتبطة به
    const agentData = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        wallet: true, // ✅ جلب بيانات المحفظة (الرصيد الحقيقي)
      }
    });

    if (!agentData) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    // ✅ إعادة صياغة البيانات لترسل الرصيد الصحيح للواجهة
    const formattedAgent = {
      id: agentData.id,
      fullName: agentData.fullName,
      phone: agentData.phone,
      // نأخذ الرصيد من المحفظة، وإذا لم توجد نضع 0
      availableBalance: agentData.wallet?.balance || 0, 
    };

    return NextResponse.json({ agent: formattedAgent });
  } catch (error) {
    console.error("PUBLIC PROFILE ERROR:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}