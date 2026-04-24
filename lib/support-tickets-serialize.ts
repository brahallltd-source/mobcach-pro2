import type { SupportTicketStatus } from "@prisma/client";

type AgentTicketRow = {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminReply: string | null;
  isReadByAdmin: boolean;
  isReadByAgent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminTicketRow = AgentTicketRow & {
  agentId: string;
  agent: { email: string; username: string } | null;
};

export function serializeAgentTicket(t: AgentTicketRow) {
  return {
    id: t.id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    adminReply: t.adminReply,
    isReadByAdmin: t.isReadByAdmin,
    isReadByAgent: t.isReadByAgent,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeAdminTicket(t: AdminTicketRow) {
  return {
    ...serializeAgentTicket(t),
    agentId: t.agentId,
    agentEmail: t.agent?.email ?? "",
    agentUsername: t.agent?.username ?? "",
  };
}
