import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  agentPaymentMethodSchema,
  agentPaymentMethodUpdateSchema,
} from "@/lib/validations/payment";

export const runtime = "nodejs";

type ResolvedAgent = { agentTableId: string; userId: string };

function mapMethod(item: {
  id: string;
  agentId: string | null;
  ownerRole: string;
  type: string;
  methodName: string;
  currency: string;
  accountName: string | null;
  rib: string | null;
  walletAddress: string | null;
  network: string | null;
  phone: string | null;
  feePercent: number;
  active: boolean;
  instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    agentId: item.agentId,
    owner_role: item.ownerRole,
    type: item.type,
    methodName: item.methodName,
    method_name: item.methodName,
    currency: item.currency,
    accountName: item.accountName ?? "",
    account_name: item.accountName ?? "",
    rib: item.rib ?? "",
    walletAddress: item.walletAddress ?? "",
    wallet_address: item.walletAddress ?? "",
    network: item.network ?? "",
    phone: item.phone ?? "",
    fee_percent: Number(item.feePercent || 0),
    enabled: item.active,
    instructions: item.instructions ?? "",
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

/** Resolve the logged-in agent (cookie or JWT) to `Agent.id` + `User.id`. */
async function resolveAuthenticatedAgent(prisma: PrismaClient): Promise<ResolvedAgent | null> {
  const fromCookie = await getAgentFromMobcashUserCookie();
  if (fromCookie) {
    const row = await prisma.agent.findFirst({
      where: { OR: [{ id: fromCookie.id }, { userId: fromCookie.id }] },
      select: { id: true, userId: true },
    });
    if (row) return { agentTableId: row.id, userId: row.userId };
  }
  const user = await getSessionUserFromCookies();
  if (user && String(user.role).trim().toUpperCase() === "AGENT") {
    const row = await prisma.agent.findFirst({
      where: { OR: [{ id: user.id }, { userId: user.id }] },
      select: { id: true, userId: true },
    });
    if (row) return { agentTableId: row.id, userId: row.userId };
  }
  return null;
}

function isBodyAgentIdForSession(bodyAgentId: string, a: ResolvedAgent): boolean {
  const t = String(bodyAgentId).trim();
  return t === a.agentTableId || t === a.userId;
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available", methods: [], profile: null },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = String(searchParams.get("agentId") || "").trim();
    const includeTreasury = ["1", "true", "yes"].includes(
      String(searchParams.get("includeTreasury") || "").trim().toLowerCase()
    );

    if (!agentId) {
      return NextResponse.json(
        { message: "agentId is required", methods: [], profile: null },
        { status: 400 }
      );
    }

    const agentRow = await prisma.agent.findFirst({
      where: { OR: [{ id: agentId }, { userId: agentId }] },
      select: { id: true },
    });
    const currentAgentId = agentRow?.id ?? agentId;

    const where: Prisma.PaymentMethodWhereInput = includeTreasury
      ? {
          active: true,
          OR: [
            { ownerRole: { equals: "ADMIN", mode: Prisma.QueryMode.insensitive } },
            { agentId: currentAgentId },
          ],
        }
      : {
          active: true,
          agentId: currentAgentId,
        };

    const methods = await prisma.paymentMethod.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      methods: methods.map(mapMethod),
      profile: null,
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, methods: [], profile: null },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await resolveAuthenticatedAgent(prisma);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const parsed = agentPaymentMethodSchema.safeParse({
      agentId: body.agentId,
      type: body.type,
      method_name: body.method_name,
      currency: body.currency,
      account_name: body.account_name,
      rib: body.rib,
      wallet_address: body.wallet_address,
      network: body.network,
      phone: body.phone,
      fee_percent: body.fee_percent,
      enabled: body.enabled,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { message: first?.message ?? "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (!isBodyAgentIdForSession(d.agentId, auth)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const created = await prisma.paymentMethod.create({
      data: {
        agentId: auth.agentTableId,
        ownerRole: "agent",
        ownerId: auth.userId,
        type: d.type,
        methodName: d.method_name,
        currency: d.currency,
        accountName: d.account_name,
        rib: d.type === "bank" ? d.rib || null : null,
        walletAddress: null,
        network: d.network.length > 0 ? d.network : null,
        phone: d.type === "cash" ? d.phone || null : null,
        feePercent: d.fee_percent,
        active: d.enabled,
      },
    });

    return NextResponse.json({
      message: "Payment method savedYour payment details are now available to players.",
      method: mapMethod(created),
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS POST ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await resolveAuthenticatedAgent(prisma);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const parsed = agentPaymentMethodUpdateSchema.safeParse({
      methodId: body.methodId,
      type: body.type,
      method_name: body.method_name,
      currency: body.currency,
      account_name: body.account_name,
      rib: body.rib,
      wallet_address: body.wallet_address,
      network: body.network,
      phone: body.phone,
      fee_percent: body.fee_percent,
      enabled: body.enabled,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { message: first?.message ?? "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const methodId = d.methodId;

    const existing = await prisma.paymentMethod.findFirst({ where: { id: methodId } });
    if (!existing) {
      return NextResponse.json({ message: "Method not found" }, { status: 404 });
    }
    if (String(existing.ownerRole).toLowerCase() !== "agent" || existing.agentId !== auth.agentTableId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.paymentMethod.update({
      where: { id: methodId },
      data: {
        type: d.type,
        methodName: d.method_name,
        currency: d.currency,
        accountName: d.account_name,
        rib: d.type === "bank" ? d.rib || null : null,
        walletAddress: null,
        network: d.network.length > 0 ? d.network : null,
        phone: d.type === "cash" ? d.phone || null : null,
        feePercent: d.fee_percent,
        active: d.enabled,
      },
    });

    return NextResponse.json({
      message: "Payment method updated successfully",
      method: mapMethod(updated),
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS PUT ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const auth = await resolveAuthenticatedAgent(prisma);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const methodId = String(searchParams.get("methodId") || "").trim();

    if (!methodId) {
      return NextResponse.json({ message: "methodId is required" }, { status: 400 });
    }

    const existing = await prisma.paymentMethod.findFirst({ where: { id: methodId } });
    if (!existing) {
      return NextResponse.json({ message: "Method not found" }, { status: 404 });
    }
    if (String(existing.ownerRole).toLowerCase() !== "agent" || existing.agentId !== auth.agentTableId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await prisma.paymentMethod.delete({
      where: { id: methodId },
    });

    return NextResponse.json({
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS DELETE ERROR:", error);
    return NextResponse.json(
      { message: `Something went wrong
We could not complete your request right now. Please try again.`, },
      { status: 500 }
    );
  }
}
