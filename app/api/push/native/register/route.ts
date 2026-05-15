import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  platform?: string;
  appId?: string;
};

export async function POST(req: Request) {
  const session = await getSessionUserFromCookies();
  if (!session?.id) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ success: false, message: "token is required" }, { status: 400 });
  }

  const platformRaw = String(body.platform ?? "android").trim().toLowerCase();
  const platform = platformRaw === "ios" ? "ios" : "android";
  const appId = String(body.appId ?? "").trim() || null;

  await prisma.nativePushDevice.upsert({
    where: { token },
    update: {
      userId: session.id,
      platform,
      appId,
      enabled: true,
      lastSeenAt: new Date(),
    },
    create: {
      userId: session.id,
      token,
      platform,
      appId,
      enabled: true,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
