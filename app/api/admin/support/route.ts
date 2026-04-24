import { SupportTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { serializeAdminTicket } from "@/lib/support-tickets-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OPEN tickets first (enum order), then newest first within each group. */
export async function GET() {
  const access = await requireAdminPermission("SUPPORT_TICKETS");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { tickets: [] });
    }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ tickets: [] });
  }

  const rows = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      agent: { select: { id: true, email: true, username: true } },
    },
  });

  rows.sort((a, b) => {
    const ao = a.status === SupportTicketStatus.OPEN ? 0 : 1;
    const bo = b.status === SupportTicketStatus.OPEN ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return NextResponse.json({
    tickets: rows.map((t) =>
      serializeAdminTicket({
        ...t,
        agent: t.agent,
      })
    ),
  });
}
