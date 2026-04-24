import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ methods: [] });

    // Global treasury for agent recharge: active ADMIN-owned methods (case-insensitive `ownerRole`), not filtered by `agentId`.
    const methods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
        ownerRole: { equals: "ADMIN", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      methods: methods.map((m) => ({
        id: m.id,
        method_name: m.methodName,
        account_name: m.accountName,
        rib: m.rib,
        wallet_address: m.walletAddress,
        type: m.type,
        currency: m.currency,
        network: m.network,
        phone: m.phone,
        instructions: m.instructions,
      })),
    });
  } catch (error) {
    return NextResponse.json({ methods: [] });
  }
}