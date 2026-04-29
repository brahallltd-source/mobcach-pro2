import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { rejectAgentIfSuspended, rejectIfMaintenanceBlocksAgents } from "@/lib/agent-account-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentSession = { id: string; email: string };

type CryptoBody = {
  amount?: unknown;
  note?: unknown;
  admin_method_id?: unknown;
  admin_method_name?: unknown;
  gosport365_username?: unknown;
  confirm_gosport365_username?: unknown;
  gosportUsername?: unknown;
  confirmGosport365Username?: unknown;
};

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

async function resolveAgentForRecharge(): Promise<AgentSession | null> {
  const fromCookie = await getAgentFromMobcashUserCookie();
  if (fromCookie) return { id: fromCookie.id, email: fromCookie.email };
  const user = await getSessionUserFromCookies();
  if (user && String(user.role).trim().toUpperCase() === "AGENT") {
    return { id: user.id, email: user.email };
  }
  return null;
}

function appBaseUrl(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function resolveGosportUsername(body: CryptoBody): string {
  return String(
    body.gosport365_username ??
      body.gosportUsername ??
      ""
  ).trim();
}

function resolveConfirmGosportUsername(body: CryptoBody): string {
  return String(
    body.confirm_gosport365_username ??
      body.confirmGosport365Username ??
      ""
  ).trim();
}

export async function POST(req: Request) {
  try {
    const agent = await resolveAgentForRecharge();
    if (!agent) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database unavailable" }, { status: 500 });
    }

    const maintenanceBlock = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenanceBlock) return maintenanceBlock;

    const suspendedBlock = await rejectAgentIfSuspended(prisma, agent.id);
    if (suspendedBlock) return suspendedBlock;

    const gate = await prisma.user.findUnique({
      where: { id: agent.id },
      select: { applicationStatus: true, hasUsdtAccess: true },
    });
    if (!gate || gate.applicationStatus !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message: "Crypto recharge is only available once your agent application is approved.",
        },
        { status: 403 }
      );
    }
    if (!gate.hasUsdtAccess) {
      return NextResponse.json(
        { success: false, message: "USDT top-up is not enabled for this account." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as CryptoBody;
    const requestedAmountMad = parsePositiveAmount(body.amount);
    if (requestedAmountMad === null) {
      return NextResponse.json(
        { success: false, message: "Invalid amount: must be greater than zero." },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSystemSettings(prisma);
    const rawRate = Number(settings.usdtToMadRate);
    const usdtToMadRate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 10.5;
    // Critical: convert only the requested base MAD amount (bonus is not charged in crypto).
    const usdtAmount = roundTo(requestedAmountMad / usdtToMadRate, 6);
    if (!Number.isFinite(usdtAmount) || usdtAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid calculated USDT amount." },
        { status: 400 }
      );
    }

    const gosportUsername = resolveGosportUsername(body);
    const confirmGosportUsername = resolveConfirmGosportUsername(body);
    if (!gosportUsername) {
      return NextResponse.json(
        { success: false, message: "Missing required field: gosport365_username" },
        { status: 400 }
      );
    }
    if (gosportUsername !== confirmGosportUsername) {
      return NextResponse.json(
        { success: false, message: "gosport365_username and confirm_gosport365_username must match" },
        { status: 400 }
      );
    }

    const requestId = uuidv4();
    const requestedMethodId = String(body.admin_method_id ?? "").trim();
    const selectedMethod = requestedMethodId
      ? await prisma.paymentMethod.findUnique({
          where: { id: requestedMethodId },
          select: { id: true, methodName: true },
        })
      : null;
    const adminMethodId = selectedMethod?.id ?? "NOWPAYMENTS_USDT";
    const adminMethodName =
      selectedMethod?.methodName || String(body.admin_method_name ?? "NOWPayments USDT").trim();

    await prisma.rechargeRequest.create({
      data: {
        id: requestId,
        agentId: agent.id,
        agentEmail: agent.email,
        amount: requestedAmountMad,
        adminMethodId,
        adminMethodName: adminMethodName || "NOWPayments USDT",
        paymentMethodId: selectedMethod?.id ?? null,
        note: String(body.note ?? "").trim() || null,
        gosport365Username: gosportUsername,
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    const nowApiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
    if (!nowApiKey) {
      await prisma.rechargeRequest.update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          note: `[nowpayments_error:missing_api_key] ${String(body.note ?? "").trim()}`.trim(),
          updatedAt: new Date(),
        },
      });
      return NextResponse.json(
        { success: false, message: "NOWPayments is not configured on this server." },
        { status: 500 }
      );
    }

    const base = appBaseUrl(req);
    const invoicePayload = {
      price_amount: usdtAmount,
      price_currency: "usdt",
      pay_currency: String(process.env.NOWPAYMENTS_PAY_CURRENCY ?? "usdttrc20")
        .trim()
        .toLowerCase(),
      order_id: requestId,
      order_description: `Agent recharge ${requestedAmountMad} MAD`,
      ipn_callback_url: `${base}/api/webhooks/nowpayments`,
      success_url: `${base}/agent/gosport365-topup?tab=history`,
      cancel_url: `${base}/agent/gosport365-topup?tab=deposit`,
    };

    const nowRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": nowApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });
    const nowJson = (await nowRes.json().catch(() => ({}))) as Record<string, unknown>;

    if (!nowRes.ok) {
      const providerMessage = String(nowJson.message ?? nowJson.error ?? "Invoice creation failed");
      await prisma.rechargeRequest.update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          note: `[nowpayments_error:${providerMessage}] ${String(body.note ?? "").trim()}`.trim(),
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: false, message: providerMessage }, { status: 502 });
    }

    const nowPaymentsIdRaw =
      nowJson.invoice_id ?? nowJson.id ?? nowJson.payment_id ?? nowJson.order_id ?? null;
    const nowPaymentsId = nowPaymentsIdRaw ? String(nowPaymentsIdRaw).trim() : null;
    const invoiceUrlRaw = nowJson.invoice_url ?? nowJson.payment_url ?? nowJson.url ?? null;
    const invoiceUrl = invoiceUrlRaw ? String(invoiceUrlRaw).trim() : "";

    await prisma.rechargeRequest.update({
      where: { id: requestId },
      data: {
        nowPaymentsId,
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    if (!invoiceUrl) {
      return NextResponse.json(
        { success: false, message: "Invoice created but invoice URL is missing from provider response." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      nowPaymentsId,
      invoiceUrl,
      amountMad: requestedAmountMad,
      usdtAmount,
      usdtToMadRate,
    });
  } catch (error) {
    console.error("POST /api/agent/recharge/crypto", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
