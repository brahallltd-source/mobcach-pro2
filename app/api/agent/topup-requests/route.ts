export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const requests = await prisma.topupRequest.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

    // تحويل الأسماء لتطابق ما يتوقعه الـ Frontend (snake_case)
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
      admin_method_id,   // ✅ يجب استلام الـ ID من الواجهة
      admin_method_name,
      tx_hash,
      proof_url,
      note,
      gosport365_username,
    } = body;

    // التحقق من البيانات الأساسية
    if (!agentId || !amount || !admin_method_id) {
      return NextResponse.json({ message: "بيانات غير مكتملة: تأكد من اختيار طريقة الدفع والمبلغ" }, { status: 400 });
    }

    // إنشاء الطلب في Prisma
    const newRequest = await prisma.topupRequest.create({
      data: {
        agentId: agentId,
        agentEmail: agentEmail,
        amount: Number(amount),
        adminMethodId: admin_method_id,      // ✅ الحقل الإلزامي الذي كان مفقوداً
        adminMethodName: admin_method_name || "Unknown",
        txHash: tx_hash || null,
        proofUrl: proof_url || null,
        note: note || null,
        gosport365_username: gosport365_username || null,
        status: "pending",
        // الحقول التالية لها Default Value في السكيما فلا داعي لذكرها إلا إذا أردت تغييرها
        bonusAmount: 0,
        pendingBonusApplied: 0,
      },
    });

    return NextResponse.json({ 
      message: "تم إرسال طلب الشحن بنجاح", 
      request: newRequest 
    });

  } catch (error) {
    // طباعة الخطأ التفصيلي في الـ Console لمعرفته بدقة
    console.error("❌ PRISMA CREATE ERROR:", error);
    
    return NextResponse.json({ 
      message: "حدث خطأ أثناء إرسال الطلب، تأكد من صحة البيانات وقاعدة البيانات",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined 
    }, { status: 500 });
  }
}