import { SupportTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import { serializeAdminTicket } from "@/lib/support-tickets-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mark read by admin, or change status (e.g. re-open).  
 * To submit a reply and close, use `PATCH /api/admin/support/reply`.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminPermission("SUPPORT_TICKETS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const { id } = await params;
  const ticketId = String(id ?? "").trim();
  if (!ticketId) {
    return NextResponse.json({ message: "Missing ticket id" }, { status: 400 });
  }

  let body: { status?: unknown; isReadByAdmin?: unknown; adminReply?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (body.adminReply !== undefined) {
    return NextResponse.json(
      { message: "Use PATCH /api/admin/support/reply with ticketId and adminReply to send a reply and close." },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  const existing = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!existing) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }

  const data: {
    status?: SupportTicketStatus;
    isReadByAdmin?: boolean;
    isReadByAgent?: boolean;
  } = {};

  if (body.status !== undefined && body.status !== null) {
    const raw = String(body.status).trim().toUpperCase();
    if (raw !== "OPEN" && raw !== "CLOSED") {
      return NextResponse.json({ message: "status must be OPEN or CLOSED" }, { status: 400 });
    }
    data.status = raw === "CLOSED" ? SupportTicketStatus.CLOSED : SupportTicketStatus.OPEN;
    if (data.status === SupportTicketStatus.OPEN) {
      data.isReadByAgent = true;
    }
  }

  if (body.isReadByAdmin !== undefined) {
    data.isReadByAdmin = Boolean(body.isReadByAdmin);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data,
    include: { agent: { select: { email: true, username: true } } },
  });

  return NextResponse.json({
    ticket: serializeAdminTicket({
      ...updated,
      agent: updated.agent,
    }),
  });
}
