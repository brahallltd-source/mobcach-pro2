import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAdminPermission } from "@/lib/server-auth";

export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const methods = await prisma.paymentMethod.findMany({
      where: {
        ownerRole: "ADMIN",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ methods });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const body = await req.json();

    if (!body.method_name) {
      return NextResponse.json({ message: "method_name is required" }, { status: 400 });
    }

    // ⚠️ hack: نحتاج agentId
    const fallbackAgent = await prisma.agent.findFirst();

    if (!fallbackAgent) {
      return NextResponse.json(
        { message: "No agent found. Create an agent first." },
        { status: 400 }
      );
    }

    const method = await prisma.paymentMethod.create({
      data: {
        ownerRole: "ADMIN",
        ownerId: "SYSTEM",

        type: body.type || "bank",
        methodName: body.method_name,
        currency: body.currency || "MAD",

        accountName: body.account_name || null,
        rib: body.rib || null,
        walletAddress: body.wallet_address || null,
        network: body.network || null,
        phone: body.phone || null,

        active: body.active !== false,

        agentId: fallbackAgent.id, // مهم
      },
    });

    return NextResponse.json({
      message: "Payment method created successfully ✅",
      method,
    });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS POST ERROR:", error);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { methodId, active } = await req.json();

    const method = await prisma.paymentMethod.update({
      where: { id: methodId },
      data: {
        active: Boolean(active),
      },
    });

    return NextResponse.json({
      message: "Payment method updated successfully",
      method,
    });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS PATCH ERROR:", error);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const body = await req.json();

    const method = await prisma.paymentMethod.update({
      where: { id: body.methodId },
      data: {
        type: body.type,
        methodName: body.method_name,
        currency: body.currency,

        accountName: body.account_name ?? null,
        rib: body.rib ?? null,
        walletAddress: body.wallet_address ?? null,
        network: body.network ?? null,
        phone: body.phone ?? null,

        active: body.active !== false,
      },
    });

    return NextResponse.json({
      message: "Payment method updated successfully ✅",
      method,
    });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS PUT ERROR:", error);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { searchParams } = new URL(req.url);
    const methodId = searchParams.get("methodId");

    if (!methodId) {
      return NextResponse.json({ message: "methodId is required" }, { status: 400 });
    }

    await prisma.paymentMethod.delete({
      where: { id: methodId },
    });

    return NextResponse.json({
      message: "Payment method deleted successfully ✅",
    });
  } catch (error) {
    console.error("ADMIN PAYMENT METHODS DELETE ERROR:", error);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}