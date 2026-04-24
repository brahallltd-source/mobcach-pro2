import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { applyFraudFlagOrderAction } from "@/lib/admin-fraud-flag-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  let body: { orderId?: unknown; action?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const orderId = body.orderId != null ? String(body.orderId).trim() : "";
  const action = body.action != null ? String(body.action).trim() : "";

  if (!orderId || !action) {
    return NextResponse.json({ message: "orderId and action are required" }, { status: 400 });
  }

  if (action !== "resolve" && action !== "reopen") {
    return NextResponse.json({ message: "action must be resolve or reopen" }, { status: 400 });
  }

  try {
    const result = await applyFraudFlagOrderAction(prisma, {
      orderId,
      action,
      note: body.note != null ? String(body.note) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: action === "resolve" ? "تم حل المشكلة بنجاح" : "تم إعادة فتح المشكلة",
      order: result,
    });
  } catch (error) {
    console.error("ADMIN FRAUD REVIEW ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً." },
      { status: 500 }
    );
  }
}
