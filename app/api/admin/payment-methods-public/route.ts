import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: {
        ownerRole: "ADMIN",
        active: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      methods: methods.map((item) => ({
        id: item.id,
        type: item.type,
        method_name: item.methodName,
        currency: item.currency,
        account_name: item.accountName,
        rib: item.rib,
        wallet_address: item.walletAddress,
        network: item.network,
        phone: item.phone,
        fee_percent: item.feePercent,
        active: item.active,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    });
  } catch (error) {
    console.error("PUBLIC ADMIN PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
        methods: [],
      },
      { status: 500 }
    );
  }
}