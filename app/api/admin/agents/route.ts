import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("agents");

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message },
      { status: access.status }
    );
  }

  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error("GET AGENTS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error", data: [] },
      { status: 500 }
    );
  }
}