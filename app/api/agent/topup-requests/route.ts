import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!agentId || !prisma) {
      return NextResponse.json({ requests: [] }, { status: 400 });
    }

    const requests = await prisma.rechargeRequest.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

    const formattedRequests = requests.map((item) => ({
      ...item,
      admin_method_name: item.adminMethodName,
      created_at: item.createdAt,
      bonus_amount: item.bonusAmount || 0,
      proof_url: item.proofUrl || "",
      tx_hash: item.txHash || "",
      // استخراج اليوزر نيم إذا كان مخبأ في الملاحظة
      gosport365_username: item.note?.includes("GoSport365:") 
        ? item.note.split("]")[0].replace("[GoSport365: ", "") 
        : "",
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error("GET TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "خطأ في قاعدة البيانات" }, { status: 500 });

    const body = await req.json();
    const {
      agentId,
      agentEmail,
      amount,
      admin_method_id,
      admin_method_name,
      proof_url,
      note,
      gosport365_username,
    } = body;

    if (!agentId || !amount || !admin_method_id) {
      return NextResponse.json({ message: "بيانات ناقصة، المرجو ملء جميع الحقول" }, { status: 400 });
    }

    // دمج اسم المستخدم في الملاحظة بشكل احترافي
    let finalNote = note || "";
    if (gosport365_username) {
      finalNote = `[GoSport365: ${gosport365_username}] ${finalNote}`.trim();
    }

    const newRequest = await prisma.rechargeRequest.create({
      data: {
        id: randomUUID(),
        agentId: String(agentId),
        agentEmail: agentEmail || "",
        amount: Number(amount),
        adminMethodId: String(admin_method_id),
        adminMethodName: admin_method_name || "Unknown",
        proofUrl: proof_url || null,
        note: finalNote || null,
        status: "pending",
        bonusAmount: 0,
        pendingBonusApplied: 0,
        updatedAt: new Date(), 
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "تم إرسال طلب الشحن بنجاح ✅ وهو قيد المراجعة الآن.", 
      request: newRequest 
    });

  } catch (error: any) {
    console.error("❌ CREATE TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ فني أثناء إرسال الطلب، المرجو المحاولة لاحقاً." 
    }, { status: 500 });
  }
}