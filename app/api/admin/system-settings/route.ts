import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings, SYSTEM_SETTINGS_ROW_ID } from "@/lib/system-settings";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }
  const auth = await requirePermission("MANAGE_SETTINGS");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth);
  }
  const row = await getOrCreateSystemSettings(prisma);
  const maxRaw = Number(row.maxWithdrawalAmount);
  const maxWithdrawalAmount =
    Number.isFinite(maxRaw) && maxRaw >= 100 ? maxRaw : 100000;
  const usdtRaw = Number(row.usdtToMadRate);
  const usdtToMadRate =
    Number.isFinite(usdtRaw) && usdtRaw > 0 ? usdtRaw : 10.5;
  return NextResponse.json({
    bonusPercentage: row.bonusPercentage,
    minRechargeAmount: Number(row.minRechargeAmount),
    affiliateBonusEnabled: Boolean(row.affiliateBonusEnabled),
    maxWithdrawalAmount,
    usdtToMadRate,
    isMaintenance: row.isMaintenance,
    announcement: row.announcement,
  });
}

export async function PATCH(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }
  const auth = await requirePermission("MANAGE_SETTINGS");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth);
  }

  let body: {
    bonusPercentage?: unknown;
    minRechargeAmount?: unknown;
    affiliateBonusEnabled?: unknown;
    maxWithdrawalAmount?: unknown;
    /** MAD per 1 USDT (same as DB `usdtToMadRate`). */
    usdtToMadRate?: unknown;
    usdtExchangeRate?: unknown;
    isMaintenance?: unknown;
    announcement?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    bonusPercentage?: number;
    minRechargeAmount?: number;
    affiliateBonusEnabled?: boolean;
    maxWithdrawalAmount?: number;
    usdtToMadRate?: number;
    isMaintenance?: boolean;
    announcement?: string;
  } = {};

  if (body.bonusPercentage !== undefined && body.bonusPercentage !== null) {
    const n = parseFloat(String(body.bonusPercentage));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      return NextResponse.json(
        { message: "bonusPercentage must be a number between 0 and 1000" },
        { status: 400 }
      );
    }
    data.bonusPercentage = n;
  }

  if (body.minRechargeAmount !== undefined && body.minRechargeAmount !== null) {
    const n = parseFloat(String(body.minRechargeAmount));
    if (!Number.isFinite(n) || n < 1 || n > 10_000_000) {
      return NextResponse.json(
        { message: "minRechargeAmount must be a number between 1 and 10000000" },
        { status: 400 }
      );
    }
    data.minRechargeAmount = n;
  }

  if (body.affiliateBonusEnabled !== undefined && body.affiliateBonusEnabled !== null) {
    data.affiliateBonusEnabled =
      body.affiliateBonusEnabled === true || String(body.affiliateBonusEnabled) === "true";
  }

  if (body.maxWithdrawalAmount !== undefined && body.maxWithdrawalAmount !== null) {
    const n = parseFloat(String(body.maxWithdrawalAmount));
    if (!Number.isFinite(n) || n < 100 || n > 50_000_000) {
      return NextResponse.json(
        { message: "maxWithdrawalAmount must be a number between 100 and 50000000" },
        { status: 400 }
      );
    }
    data.maxWithdrawalAmount = n;
  }

  const usdtIncoming =
    body.usdtToMadRate !== undefined && body.usdtToMadRate !== null
      ? body.usdtToMadRate
      : body.usdtExchangeRate !== undefined && body.usdtExchangeRate !== null
        ? body.usdtExchangeRate
        : undefined;
  if (usdtIncoming !== undefined) {
    const n = parseFloat(String(usdtIncoming));
    if (!Number.isFinite(n) || n < 0.01 || n > 10_000) {
      return NextResponse.json(
        { message: "usdtToMadRate must be a number between 0.01 and 10000 (MAD per 1 USDT)" },
        { status: 400 }
      );
    }
    data.usdtToMadRate = n;
  }

  if (body.isMaintenance !== undefined && body.isMaintenance !== null) {
    data.isMaintenance = body.isMaintenance === true || String(body.isMaintenance) === "true";
  }

  if (body.announcement !== undefined && body.announcement !== null) {
    const msg = String(body.announcement);
    if (msg.length > 20000) {
      return NextResponse.json({ message: "announcement is too long" }, { status: 400 });
    }
    data.announcement = msg;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "No fields to update" }, { status: 400 });
  }

  await getOrCreateSystemSettings(prisma);
  const row = await prisma.systemSettings.update({
    where: { id: SYSTEM_SETTINGS_ROW_ID },
    data,
  });

  const maxOut = Number(row.maxWithdrawalAmount);
  const maxWithdrawalAmount =
    Number.isFinite(maxOut) && maxOut >= 100 ? maxOut : 100000;

  const usdtOut = Number(row.usdtToMadRate);
  const usdtToMadRate =
    Number.isFinite(usdtOut) && usdtOut > 0 ? usdtOut : 10.5;

  return NextResponse.json({
    bonusPercentage: row.bonusPercentage,
    minRechargeAmount: Number(row.minRechargeAmount),
    affiliateBonusEnabled: Boolean(row.affiliateBonusEnabled),
    maxWithdrawalAmount,
    usdtToMadRate,
    isMaintenance: row.isMaintenance,
    announcement: row.announcement,
  });
}
