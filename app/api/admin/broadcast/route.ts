import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requirePermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LEN = 8000;

export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }
  const auth = await requirePermission("MANAGE_SETTINGS");
  if (!auth.ok) return respondIfAdminAccessDenied(auth);

  const active = await prisma.broadcast.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    active: active
      ? {
          id: active.id,
          message: active.message,
          createdAt: active.createdAt.toISOString(),
        }
      : null,
  });
}

export async function POST(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }
  const auth = await requirePermission("MANAGE_SETTINGS");
  if (!auth.ok) return respondIfAdminAccessDenied(auth);

  let body: { message?: unknown };
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ message: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { message: `message must be at most ${MAX_MESSAGE_LEN} characters` },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.broadcast.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.broadcast.create({
      data: {
        message,
        isActive: true,
        createdByUserId: auth.user.id,
      },
    });
  });

  return NextResponse.json({
    active: {
      id: created.id,
      message: created.message,
      createdAt: created.createdAt.toISOString(),
    },
  });
}

/** Deactivate all broadcasts (clear global banner). */
export async function DELETE() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }
  const auth = await requirePermission("MANAGE_SETTINGS");
  if (!auth.ok) return respondIfAdminAccessDenied(auth);

  await prisma.broadcast.updateMany({ where: { isActive: true }, data: { isActive: false } });
  return NextResponse.json({ ok: true, active: null });
}
