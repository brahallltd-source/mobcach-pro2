import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 1. جلب سجل طلبات الوكيل (ليظهر في صفحته)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ requests: [] }, { status: 400 });
    }

    // البحث في قاعدة البيانات عن طلبات هذا الوكيل فقط
    const requests = await prisma.topupRequest.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

    // إعادة صياغة الحقول لتتطابق مع ما تتوقعه صفحة الواجهة (frontend)
    const formattedRequests = requests.map((req: any) => ({
      ...req,
      admin_method_name: req.adminMethodName,
      created_at: req.createdAt,
      bonus_amount: req.bonusAmount,
      proof_url: req.proofUrl,
      tx_hash: req.txHash,
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error("AGENT GET TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ requests: [] }, { status: 500 });
  }
}

// 2. إرسال طلب شحن جديد (من الوكيل للآدمن)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      agentId,
      agentEmail,
      amount,
      admin_method_name,
      tx_hash,
      proof_url,
      note,
      gosport365_username,
    } = body;

    if (!agentId || !amount) {
      return NextResponse.json({ message: "بيانات غير مكتملة" }, { status: 400 });
    }

    // إنشاء الطلب مباشرة في قاعدة بيانات Prisma
    const newRequest = await prisma.topupRequest.create({
      data: {
        agentId: agentId,
        agentEmail: agentEmail,
        amount: Number(amount),
        adminMethodName: admin_method_name || "Unknown",
        txHash: tx_hash || null,
        proofUrl: proof_url || null,
        note: note || null,
        gosport365_username: gosport365_username || null,
        status: "pending",
      },
    });

    return NextResponse.json({ 
      message: "تم إرسال طلب الشحن بنجاح", 
      request: newRequest 
    });

  } catch (error) {
    console.error("AGENT POST TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال الطلب" }, { status: 500 });
  }
}