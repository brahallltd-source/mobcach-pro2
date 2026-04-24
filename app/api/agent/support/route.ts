import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { notifyAllAdminsNewSupportTicket } from "@/lib/in-app-notifications";
import { serializeAgentTicket } from "@/lib/support-tickets-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agent = await getAgentFromMobcashUserCookie();
  if (!agent) {
    return NextResponse.json({ message: "Unauthorized", tickets: [] }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ tickets: [] });
  }
  const tickets = await prisma.supportTicket.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    tickets: tickets.map(serializeAgentTicket),
  });
}

export async function POST(request: Request) {
  const agent = await getAgentFromMobcashUserCookie();
  if (!agent) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  let body: { subject?: unknown; message?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!subject || subject.length > 200) {
    return NextResponse.json({ message: "Subject is required (max 200 chars)" }, { status: 400 });
  }
  if (!message || message.length > 10000) {
    return NextResponse.json({ message: "Message is required (max 10000 chars)" }, { status: 400 });
  }

  const row = await prisma.supportTicket.create({
    data: {
      agentId: agent.id,
      subject,
      message,
      isReadByAdmin: false,
      isReadByAgent: true,
    },
  });

  const agentUser = await prisma.user.findUnique({
    where: { id: agent.id },
    select: { username: true, email: true },
  });
  const agentUsername = String(agentUser?.username ?? "").trim() || String(agentUser?.email ?? agent.email).trim();

  await notifyAllAdminsNewSupportTicket({
    agentUsername,
    subject,
    ticketId: row.id,
  });

  return NextResponse.json({
    ticket: serializeAgentTicket(row),
  });
}

/** Mark ticket as read by the agent (e.g. after viewing admin reply). */
export async function PATCH(request: Request) {
  const agent = await getAgentFromMobcashUserCookie();
  if (!agent) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { ticketId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const ticketId = String(body.ticketId ?? "").trim();
  if (!ticketId) {
    return NextResponse.json({ message: "ticketId is required" }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, agentId: agent.id },
  });
  if (!existing) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { isReadByAgent: true },
  });

  return NextResponse.json({ ticket: serializeAgentTicket(updated) });
}
