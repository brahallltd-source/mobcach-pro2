import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function mapMethod(item: any) {
  return {
    id: item.id,
    agentId: item.agentId,
    type: item.type,
    method_name: item.methodName,
    currency: item.currency,
    account_name: item.accountName || "",
    rib: item.rib || "",
    wallet_address: item.walletAddress || "",
    network: item.network || "",
    phone: item.phone || "",
    fee_percent: Number(item.feePercent || 0),
    enabled: item.active,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
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

    if (!agentId) {
      return NextResponse.json(
        { message: "agentId is required", methods: [], profile: null },
        { status: 400 }
      );
    }

    const methods = await prisma.paymentMethod.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      methods: methods.map(mapMethod),
      profile: null,
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json(
      { message: "Something went wrong
We could not complete your request right now. Please try again.", methods: [], profile: null },
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

    const body = await req.json();
    const agentId = String(body.agentId || "").trim();

    if (!agentId) {
      return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    }

    const created = await prisma.paymentMethod.create({
      data: {
        agentId,
        ownerRole: "agent",
        ownerId: agentId,
        type: body.type,
        methodName: String(body.method_name || "").trim(),
        currency: String(body.currency || "MAD").trim(),
        accountName: String(body.account_name || "").trim() || null,
        rib: String(body.rib || "").trim() || null,
        walletAddress: String(body.wallet_address || "").trim() || null,
        network: String(body.network || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
        feePercent: Number(body.fee_percent || 0),
        active: body.enabled !== false,
      },
    });

    return NextResponse.json({
      message: "Payment method saved
Your payment details are now available to players.",
      method: mapMethod(created),
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS POST ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
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

    const body = await req.json();
    const methodId = String(body.methodId || "").trim();

    if (!methodId) {
      return NextResponse.json({ message: "methodId is required" }, { status: 400 });
    }

    const updated = await prisma.paymentMethod.update({
      where: { id: methodId },
      data: {
        type: body.type,
        methodName: String(body.method_name || "").trim(),
        currency: String(body.currency || "MAD").trim(),
        accountName: String(body.account_name || "").trim() || null,
        rib: String(body.rib || "").trim() || null,
        walletAddress: String(body.wallet_address || "").trim() || null,
        network: String(body.network || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
        feePercent: Number(body.fee_percent || 0),
        active: body.enabled !== false,
      },
    });

    return NextResponse.json({
      message: "Payment method updated successfully",
      method: mapMethod(updated),
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS PUT ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
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

    const { searchParams } = new URL(req.url);
    const methodId = String(searchParams.get("methodId") || "").trim();

    if (!methodId) {
      return NextResponse.json({ message: "methodId is required" }, { status: 400 });
    }

    await prisma.paymentMethod.delete({
      where: { id: methodId },
    });

    return NextResponse.json({
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("AGENT PAYMENT METHODS DELETE ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}