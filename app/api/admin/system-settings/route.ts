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
  return NextResponse.json({
    bonusPercentage: row.bonusPercentage,
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

  return NextResponse.json({
    bonusPercentage: row.bonusPercentage,
    isMaintenance: row.isMaintenance,
    announcement: row.announcement,
  });
}
