import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ success: false }, { status: 500 });

    const body = await req.json();
    // 🟢 كنأكدو أننا غانشدو الصورة بأي سمية جات باش ما تضيعش
    const { agentId, agentEmail, amount, admin_method_id, adminMethodId, admin_method_name, adminMethodName, proof_url, proofUrl, note, gosport365_username } = body;

    const finalProof = proofUrl || proof_url || "";
    const finalMethodId = adminMethodId || admin_method_id || "";
    const finalMethodName = adminMethodName || admin_method_name || "";

    const request = await prisma.rechargeRequest.create({
      data: {
        id: crypto.randomUUID(),
        agentId: String(agentId),
        agentEmail: String(agentEmail),
        amount: parseFloat(amount),
        adminMethodId: String(finalMethodId),
        adminMethodName: String(finalMethodName),
        proofUrl: finalProof, // 🟢 هنا غاتخزن الصورة صحيحة
        note: note || gosport365_username || "",
        status: "pending",
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    console.error("TOPUP API ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const prisma = getPrisma();

  try {
    const requests = await prisma?.rechargeRequest.findMany({
      where: agentId ? { agentId: String(agentId) } : {},
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ requests });
  } catch (e) {
    return NextResponse.json({ requests: [] });
  }
}