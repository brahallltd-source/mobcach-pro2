import { NextResponse } from "next/server";
import { getPublicBrandingMerged } from "@/lib/get-public-branding-merged";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public read-only branding (logo, name, hero, banners). No auth. */
export async function GET() {
  const branding = await getPublicBrandingMerged();
  return NextResponse.json({ branding });
}
