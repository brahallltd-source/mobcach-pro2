import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { applyFraudFlagOrderAction } from "@/lib/admin-fraud-flag-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_SUMMARY = { suspiciousOrders: 0, pendingFlags: 0, highRisk: 0 };

/** Fraud center queue + stats (GET was missing before, which broke JSON parsing on the client). */
export async function GET() {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access, { items: [], summary: EMPTY_SUMMARY });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({
      items: [],
      summary: EMPTY_SUMMARY,
      message: "Database not available",
    });
  }

  try {
    const flags = await prisma.fraudFlag.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        order: {
          include: {
            agent: true,
            player: true,
          },
        },
      },
    });

    const items = flags.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      type: f.type,
      note: f.note ?? "",
      score: f.score,
      resolved: f.resolved,
      createdAt: f.createdAt.toISOString(),
      order: {
        amount: f.order.amount,
        status: f.order.status,
        proofUrl: f.order.proofUrl ?? undefined,
        player: {
          email: f.order.playerEmail,
          username: f.order.player?.username ?? f.order.gosportUsername ?? "—",
        },
        agent: {
          email: f.order.agent.email,
          username: f.order.agent.username,
        },
      },
    }));

    const open = items.filter((i) => !i.resolved);
    const summary = {
      suspiciousOrders: new Set(open.map((i) => i.orderId)).size,
      pendingFlags: open.length,
      highRisk: open.filter((i) => i.score >= 70).length,
    };

    return NextResponse.json({ items, summary });
  } catch (e) {
    console.error("GET /api/admin/fraud:", e);
    return NextResponse.json(
      { items: [], summary: EMPTY_SUMMARY, message: "Failed to load fraud data" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access, { items: [], summary: EMPTY_SUMMARY });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const orderId = body.orderId != null ? String(body.orderId).trim() : "";
  const action = body.action != null ? String(body.action).trim() : "";

  if (orderId && (action === "resolve" || action === "reopen")) {
    try {
      await applyFraudFlagOrderAction(prisma, {
        orderId,
        action,
        note: body.note != null ? String(body.note) : undefined,
      });
      return NextResponse.json({
        success: true,
        message: action === "resolve" ? "تم حل المشكلة بنجاح" : "تم إعادة فتح المشكلة",
      });
    } catch (e) {
      console.error("POST /api/admin/fraud (flag action):", e);
      return NextResponse.json(
        { message: "حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً." },
        { status: 500 }
      );
    }
  }

  const agentId = body.agentId != null ? String(body.agentId).trim() : "";
  if (!agentId) {
    return NextResponse.json({ message: "agentId مطلوب" }, { status: 400 });
  }

  const data = body.data as Record<string, unknown> | undefined;

  try {
    if (action === "update_balance") {
      if (!data || data.balance === undefined) {
        return NextResponse.json({ message: "data.balance مطلوب" }, { status: 400 });
      }
      const newBalance = parseFloat(String(data.balance));
      if (!Number.isFinite(newBalance)) {
        return NextResponse.json({ message: "رصيد غير صالح" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.update({
          where: { agentId },
          data: { balance: newBalance },
        });

        await tx.walletLedger.create({
          data: {
            agentId,
            walletId: wallet.id,
            type: "ADMIN_ADJUSTMENT",
            amount: newBalance,
            reason: (data.reason != null ? String(data.reason) : "") || "تعديل يدوي من الإدارة",
          },
        });
        return wallet;
      });

      return NextResponse.json({
        success: true,
        message: "تم تحديث الرصيد بنجاح ✅",
        balance: result.balance,
      });
    }

    if (action === "update_profile") {
      if (!data) {
        return NextResponse.json({ message: "data مطلوب" }, { status: 400 });
      }
      const patch: Record<string, string> = {};
      if (data.email != null) patch.email = String(data.email);
      if (data.phone != null) patch.phone = String(data.phone);
      if (data.status != null) patch.status = String(data.status);
      if (data.fullName != null) patch.fullName = String(data.fullName);
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ message: "لا توجد حقول للتحديث" }, { status: 400 });
      }
      await prisma.agent.update({
        where: { id: agentId },
        data: patch,
      });
      return NextResponse.json({ success: true, message: "تم تحديث بيانات الوكيل" });
    }

    return NextResponse.json({ message: "Action invalid" }, { status: 400 });
  } catch (error: unknown) {
    console.error("ADMIN FRAUD POST ERROR:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء التحديث" }, { status: 500 });
  }
}
