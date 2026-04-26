import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Active global broadcast message for player/agent shell (no auth). */
export async function GET() {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { message: null as string | null },
      { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } },
    );
  }

  const row = await prisma.broadcast.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { message: true },
  });
  const raw = String(row?.message ?? "").trim();
  const message = raw.length > 0 ? raw : null;

  return NextResponse.json(
    { message },
    { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } },
  );
}
