export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto"; // 👈 استيراد مكتبة لتوليد ID

export const runtime = "nodejs";

// 1. جلب سجل طلبات الوكيل
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ requests: [] }, { status: 400 });
    }

    const requests = await prisma.rechargeRequest.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

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

// 2. إرسال طلب شحن جديد
export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ message: "بيانات غير مكتملة" }, { status: 400 });
    }

    let finalNote = note || "";
    if (gosport365_username) {
      finalNote = `حساب GoSport365: ${gosport365_username}` + (finalNote ? ` | ملاحظة إضافية: ${finalNote}` : "");
    }

    const newRequest = await prisma.rechargeRequest.create({
      data: {
        id: randomUUID(), // 👈 توليد ID فريد يدوياً لحل المشكلة
        agentId: agentId,
        agentEmail: agentEmail,
        amount: Number(amount),
        adminMethodId: admin_method_id,
        adminMethodName: admin_method_name || "Unknown",
        txHash: tx_hash || null,
        proofUrl: proof_url || null,
        note: finalNote || null,
        status: "pending",
        bonusAmount: 0,
        pendingBonusApplied: 0,
        updatedAt: new Date(), // 👈 إعطاء وقت التحديث يدوياً
      },
    });

    return NextResponse.json({ 
      message: "تم إرسال طلب الشحن بنجاح", 
      request: newRequest 
    });

  } catch (error) {
    console.error("❌ PRISMA CREATE ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إرسال الطلب" }, { status: 500 });
  }
}