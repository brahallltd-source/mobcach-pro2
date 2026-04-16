import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db"; // 🟢 استعملنا getPrisma لضمان استقرار الاتصال
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 1. جلب سجل طلبات الوكيل
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

    // تنسيق البيانات لتتوافق مع أسماء الحقول في واجهة المستخدم (Snake Case)
    const formattedRequests = requests.map((item) => ({
      ...item,
      admin_method_name: item.adminMethodName,
      created_at: item.createdAt,
      bonus_amount: item.bonusAmount,
      proof_url: item.proofUrl,
      tx_hash: item.txHash,
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    console.error("GET TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ requests: [] }, { status: 500 });
  }
}

// 2. إرسال طلب شحن جديد
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const body = await req.json();
    const {
      agentId,
      agentEmail,
      amount,
      admin_method_id,
      admin_method_name,
      tx_hash,
      proof_url,
      note,
      gosport365_username,
    } = body;

    if (!agentId || !amount || !admin_method_id) {
      return NextResponse.json({ message: "بيانات ناقصة، المرجو ملء جميع الحقول" }, { status: 400 });
    }

    // تنسيق الملاحظة لتشمل اسم المستخدم في المنصة
    let finalNote = note || "";
    if (gosport365_username) {
      finalNote = `[GoSport365: ${gosport365_username}]` + (finalNote ? ` - ${finalNote}` : "");
    }

    // إنشاء الطلب في قاعدة البيانات
    const newRequest = await prisma.rechargeRequest.create({
      data: {
        id: randomUUID(), // توليد ID فريد يدوياً لأن الموديل لا يحتوي على @default(uuid)
        agentId: agentId,
        agentEmail: agentEmail || "",
        amount: Number(amount),
        adminMethodId: admin_method_id,
        adminMethodName: admin_method_name || "Unknown",
        txHash: tx_hash || null,
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