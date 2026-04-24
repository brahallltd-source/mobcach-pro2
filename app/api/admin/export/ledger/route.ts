import { NextResponse } from "next/server";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Start of UTC calendar day for `YYYY-MM-DD`. */
function utcDayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** End of UTC calendar day for `YYYY-MM-DD`. */
function utcDayEnd(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const access = await requireAdminPermission("VIEW_FINANCIALS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("startDate")?.trim() ?? "";
  const endParam = searchParams.get("endDate")?.trim() ?? "";

  let start: Date;
  let end: Date;

  if (!startParam && !endParam) {
    end = new Date();
    start = new Date(end.getTime() - 30 * DAY_MS);
  } else {
    if (startParam && !isYmd(startParam)) {
      return NextResponse.json({ message: "Invalid startDate (use YYYY-MM-DD)" }, { status: 400 });
    }
    if (endParam && !isYmd(endParam)) {
      return NextResponse.json({ message: "Invalid endDate (use YYYY-MM-DD)" }, { status: 400 });
    }

    const now = new Date();
    const todayYmd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    if (startParam && endParam) {
      start = utcDayStart(startParam);
      end = utcDayEnd(endParam);
    } else if (startParam) {
      start = utcDayStart(startParam);
      end = utcDayEnd(todayYmd);
    } else {
      end = utcDayEnd(endParam);
      start = new Date(end.getTime() - 30 * DAY_MS);
    }

    if (start.getTime() > end.getTime()) {
      return NextResponse.json(
        { message: "startDate must be on or before endDate" },
        { status: 400 }
      );
    }
  }

  try {
    const rows = await prisma.walletLedger.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "asc" },
      include: {
        wallet: {
          include: {
            user: { select: { email: true, username: true } },
          },
        },
      },
    });

    const header = [
      "id",
      "createdAt",
      "type",
      "amount",
      "reason",
      "agentId",
      "walletId",
      "userEmail",
      "userUsername",
    ];

    const lines = [header.join(",")];
    for (const r of rows) {
      const u = r.wallet?.user;
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.type),
          csvCell(r.amount),
          csvCell(r.reason),
          csvCell(r.agentId),
          csvCell(r.walletId),
          csvCell(u?.email ?? ""),
          csvCell(u?.username ?? ""),
        ].join(",")
      );
    }

    const csv = "\uFEFF" + lines.join("\n");
    const fname = `ledger-export-${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error("GET /api/admin/export/ledger:", e);
    return NextResponse.json({ message: "Failed to export ledger" }, { status: 500 });
  }
}
