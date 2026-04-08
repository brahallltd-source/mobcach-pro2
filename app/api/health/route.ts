
import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    let database = "disabled";
    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (!prisma) {
        return NextResponse.json({ ok: false, database: "unavailable" }, { status: 500 });
      }
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    }
    return NextResponse.json({ ok: true, app: "GS365Cash", database, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("HEALTH CHECK ERROR:", error);
    return NextResponse.json({ ok: false, app: "GS365Cash", database: "error", timestamp: new Date().toISOString() }, { status: 500 });
  }
}
