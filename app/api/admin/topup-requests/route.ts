export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { processRechargeRequestDecision } from "@/lib/admin-process-recharge-request";

export async function GET() {
  const access = await requireAdminPermission("APPROVE_RECHARGES");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { requests: [] });
    }

  try {
    const prisma = getPrisma();
    const requests = await prisma.rechargeRequest.findMany({ orderBy: { createdAt: "desc" } });
    
    // نجلب معلومات الوكلاء
    const agentIds = [...new Set(requests.map((r: any) => r.agentId))];
    const agents = await prisma.agent.findMany({
      where: { OR: [{ id: { in: agentIds } }, { userId: { in: agentIds } }] },
      select: { id: true, userId: true, username: true },
    });

    const agentMap = agents.reduce((acc: any, agent: any) => { 
      acc[agent.id] = agent; 
      acc[agent.userId] = agent; 
      return acc; 
    }, {});

    const formattedRequests = requests.map((req: any) => ({
      ...req,
      agentUsername: agentMap[req.agentId]?.username || (req.agentEmail ? req.agentEmail.split("@")[0] : "N/A"),
      gosport365Username: String(req.gosport365Username ?? "").trim() || null,
      targetUsername: String(req.gosport365Username ?? "").trim() || null,
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (error) {
    return NextResponse.json({ message: "Error fetching requests", requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("APPROVE_RECHARGES");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database unavailable" },
        { status: 500 }
      );
    }
    const { requestId, action, adminEmail } = await req.json();
    const result = await processRechargeRequestDecision(prisma, {
      requestId,
      action,
      adminEmail,
    });

    if (result.ok === false) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status ?? 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("TOPUP ADMIN ERROR:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}