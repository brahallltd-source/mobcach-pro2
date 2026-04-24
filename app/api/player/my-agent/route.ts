import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isAgentCustomerLinkedStatus, isAgentCustomerPendingRequestStatus } from "@/lib/agent-customer-status";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

/**
 * Agent row + linked `User` JSON payment catalog (min/max per method live there;
 * Prisma `PaymentMethod` rows do not store min/max).
 */
const MY_AGENT_AGENT_SELECT = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  online: true,
  paymentMethods: {
    where: { active: true },
    orderBy: { updatedAt: "desc" as const },
    select: { id: true, methodName: true, active: true },
  },
  user: {
    select: {
      id: true,
      isOnline: true,
      lastSeen: true,
      paymentMethods: true,
    },
  },
} satisfies Prisma.AgentSelect;

type AgentWithMyAgentSelect = Prisma.AgentGetPayload<{ select: typeof MY_AGENT_AGENT_SELECT }>;

/** Active methods from agent settings JSON — same source as `/api/agent/public-profile`. */
function paymentMethodsFromAgentCatalog(agent: AgentWithMyAgentSelect) {
  const rows = parseAgentPaymentMethodsJson(agent.user?.paymentMethods);
  return rows
    .filter((r) => r.isActive)
    .map((r) => {
      const pub = toPublicPaymentMethodPayload(r as AgentPaymentMethodRow);
      return {
        id: pub.id,
        methodName: pub.methodTitle,
        methodTitle: pub.methodTitle,
        minAmount: pub.minAmount,
        maxAmount: pub.maxAmount,
        category: pub.category,
      };
    });
}

/** Catalog JSON (min/max) plus Prisma `PaymentMethod` rows, deduped by display name. */
function mergePaymentMethodsForAgent(agent: AgentWithMyAgentSelect) {
  const catalog = paymentMethodsFromAgentCatalog(agent);
  const seen = new Set(
    catalog
      .map((c) => String(c.methodName || c.methodTitle || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const prismaRows = agent.paymentMethods ?? [];
  const extras = prismaRows.map((m) => ({
    id: m.id,
    methodName: m.methodName,
    methodTitle: m.methodName,
  })).filter((row) => {
    const key = String(row.methodName || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...catalog, ...extras];
}

function pickAgentCustomerLink<
  T extends {
    agentId: string;
    status: string;
  },
>(rows: T[], assignedAgentId: string | null | undefined): T | null {
  if (!rows.length) return null;
  const linked = rows.filter((r) => isAgentCustomerLinkedStatus(r.status));
  const pending = rows.filter((r) => isAgentCustomerPendingRequestStatus(r.status));
  const aid = assignedAgentId ? String(assignedAgentId).trim() : "";

  return (
    (aid ? linked.find((r) => r.agentId === aid) : undefined) ??
    linked[0] ??
    (aid ? pending.find((r) => r.agentId === aid) : undefined) ??
    pending[0] ??
    rows[0] ??
    null
  );
}

function buildPayload(agent: AgentWithMyAgentSelect) {
  const agentUser = agent.user;
  const lastSeen = agentUser.lastSeen;
  const lastSeenMs = lastSeen instanceof Date ? lastSeen.getTime() : new Date(lastSeen as string).getTime();
  const recentlySeen = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs < ONLINE_WINDOW_MS;

  return {
    agent: {
      id: agent.id,
      userId: agentUser.id,
      name: agent.fullName,
      username: agent.username,
      email: agent.email,
      isOnline: recentlySeen,
      lastSeen: lastSeen instanceof Date ? lastSeen.toISOString() : String(lastSeen ?? ""),
      agentProfileOnline: agent.online,
    },
    paymentMethods: mergePaymentMethodsForAgent(agent),
    chatHref: `/player/chat?agentId=${encodeURIComponent(agent.id)}`,
  };
}

/** Linked agent + live status + active payment methods (with min/max from agent catalog JSON). */
export async function GET() {
  try {
    const session = await getSessionUserFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    if (String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ agent: null, paymentMethods: [], chatHref: "/player/chat" }, { status: 503 });
    }

    const player = await prisma.player.findUnique({
      where: { userId: session.id },
      select: { id: true, assignedAgentId: true },
    });

    if (!player) {
      return NextResponse.json({ agent: null, paymentMethods: [], chatHref: "/player/chat" });
    }

    const agentCustomerRows = await prisma.agentCustomer.findMany({
      where: { playerId: player.id },
      include: {
        agent: {
          select: MY_AGENT_AGENT_SELECT,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const preferred = pickAgentCustomerLink(agentCustomerRows, player.assignedAgentId);

    if (preferred?.agent) {
      return NextResponse.json(buildPayload(preferred.agent));
    }

    /** Legacy / edge case: assigned agent on `Player` without a matching `AgentCustomer` row. */
    if (player.assignedAgentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: player.assignedAgentId },
        select: MY_AGENT_AGENT_SELECT,
      });
      if (agent) {
        return NextResponse.json(buildPayload(agent));
      }
    }

    return NextResponse.json({ agent: null, paymentMethods: [], chatHref: "/player/chat" });
  } catch (e) {
    console.error("GET /api/player/my-agent", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
