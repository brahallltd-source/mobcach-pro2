import { SupportTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { notifyAgentSupportTicketReplied } from "@/lib/in-app-notifications";
import { serializeAdminTicket } from "@/lib/support-tickets-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const access = await requireAdminPermission("SUPPORT_TICKETS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  let body: { ticketId?: unknown; adminReply?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const ticketId = String(body.ticketId ?? "").trim();
  const adminReply = String(body.adminReply ?? "").trim();
  if (!ticketId) {
    return NextResponse.json({ message: "ticketId is required" }, { status: 400 });
  }
  if (!adminReply) {
    return NextResponse.json({ message: "adminReply is required" }, { status: 400 });
  }
  if (adminReply.length > 20000) {
    return NextResponse.json({ message: "Reply is too long" }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { agent: { select: { email: true, username: true } } },
  });
  if (!existing) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      adminReply,
      status: SupportTicketStatus.CLOSED,
      isReadByAgent: false,
      isReadByAdmin: true,
    },
    include: { agent: { select: { id: true, email: true, username: true } } },
  });

  await notifyAgentSupportTicketReplied({
    agentUserId: existing.agentId,
    subject: existing.subject,
  });

  return NextResponse.json({
    ticket: serializeAdminTicket({
      ...updated,
      agent: updated.agent,
    }),
  });
}
