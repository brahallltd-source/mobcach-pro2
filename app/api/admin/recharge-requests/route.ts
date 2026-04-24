export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import {
  adminRechargeRequestInclude,
  toAdminRechargeRequestJson,
} from "@/lib/admin-recharge-request-dto";

/**
 * Lists wallet recharge requests for admin review.
 * `RechargeRequest.agent` → `User` (flat `agent: true` include avoids nested relation issues).
 */
export async function GET() {
  const access = await requireAdminPermission("APPROVE_RECHARGES");
  if (!access.ok) {
      return respondIfAdminAccessDenied(access, { requests: [] });
    }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ requests: [] });
  }

  try {
    const rows = await prisma.rechargeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: adminRechargeRequestInclude,
    });

    const requests = rows.map(toAdminRechargeRequestJson);

    return NextResponse.json({ requests });
  } catch (e) {
    console.error("GET /api/admin/recharge-requests:", e);
    return NextResponse.json(
      { message: "Error fetching recharge requests", requests: [] },
      { status: 500 }
    );
  }
}
