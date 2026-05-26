import { NextResponse } from "next/server";
import { initializeWhatsAppClient } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await initializeWhatsAppClient();
    return NextResponse.json({ success: true, message: "WhatsApp bot initialization started." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize WhatsApp bot.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
