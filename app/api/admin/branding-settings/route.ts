import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { brandingSettingsPublicPayload, getOrCreateBrandingSettings } from "@/lib/branding-settings";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { isSuperAdminRole } from "@/lib/admin-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getSessionUserFromCookies();
  if (!session) {
    return { ok: false as const, res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (!isSuperAdminRole(session.role)) {
    return { ok: false as const, res: NextResponse.json({ message: "Super admin only" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.res;

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }
  const row = await getOrCreateBrandingSettings(prisma);
  return NextResponse.json({ settings: brandingSettingsPublicPayload(row) });
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.res;

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database unavailable" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (body[k] != null ? String(body[k]).trim() : undefined);
  const bool = (k: string) => (typeof body[k] === "boolean" ? (body[k] as boolean) : undefined);

  const data: Record<string, unknown> = {};
  const fb = str("facebook");
  const ig = str("instagram");
  const tg = str("telegram");
  const gm = str("gmail");
  const web = str("websiteUrl");
  if (fb !== undefined) data.facebook = fb || null;
  if (ig !== undefined) data.instagram = ig || null;
  if (tg !== undefined) data.telegram = tg || null;
  if (gm !== undefined) data.gmail = gm || null;
  if (web !== undefined) data.websiteUrl = web || "https://gosport365.com";
  const sfb = bool("showFb");
  const sig = bool("showInsta");
  const ste = bool("showTele");
  if (sfb !== undefined) data.showFb = sfb;
  if (sig !== undefined) data.showInsta = sig;
  if (ste !== undefined) data.showTele = ste;

  await getOrCreateBrandingSettings(prisma);
  const updated = await prisma.brandingSettings.update({
    where: { id: 1 },
    data: data as object,
  });

  return NextResponse.json({
    message: "Saved",
    settings: brandingSettingsPublicPayload(updated),
  });
}
