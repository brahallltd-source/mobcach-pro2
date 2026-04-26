export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { processRechargeRequestDecision } from "@/lib/admin-process-recharge-request";
import { notifyAgentRechargeDecision } from "@/lib/in-app-notifications";

/** POST body: `{ requestId: string, action: "approve" | "reject" }` */
export async function POST(req: Request) {
  const access = await requireAdminPermission("APPROVE_RECHARGES");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { success: false, message: "Database unavailable" },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      requestId?: string;
      action?: string;
    };
    const requestId = String(body.requestId ?? "");
    const action = String(body.action ?? "").toLowerCase() as "approve" | "reject";

    if (!requestId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { success: false, message: "requestId and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    const result = await processRechargeRequestDecision(prisma, {
      requestId,
      action,
      adminEmail: access.user.email,
    });

    if (result.ok === false) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status ?? 400 }
      );
    }

    const approvalMessage =
      action === "approve" && "message" in result && result.message
        ? result.message
        : undefined;

    const reqRow = await prisma.rechargeRequest.findUnique({
      where: { id: requestId },
      select: { agentId: true, amount: true },
    });
    if (reqRow?.agentId) {
      try {
        const approved = action === "approve";
        await notifyAgentRechargeDecision({
          agentUserId: reqRow.agentId,
          title: "تحديث طلب الشحن",
          message: approved
            ? (approvalMessage ??
              "تمت الموافقة على طلب الشحن، الرصيد المضاف يشمل مكافآت الترويج المستحقة.")
            : `تم رفض طلب الشحن الخاص بك بقيمة ${reqRow.amount} DH.`,
          type: approved ? "SUCCESS" : "ALERT",
          link: "/agent/gosport365-topup",
        });
      } catch (e) {
        console.error("Recharge decision agent notification:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? (approvalMessage ??
            "تمت الموافقة على طلب الشحن، الرصيد المضاف يشمل مكافآت الترويج المستحقة.")
          : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/recharge/approve:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
