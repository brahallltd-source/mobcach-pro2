import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APK_URL =
  "https://github.com/brahallltd-source/mobcach-pro2/releases/download/v1.0.0-stable/gs365cash.apk";

export async function GET() {
  try {
    const upstream = await fetch(APK_URL, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { message: "Failed to download APK from upstream source." },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="GS365CASH.apk"',
      },
    });
  } catch (error) {
    console.error("GET /api/download-app:", error);
    return NextResponse.json({ message: "Unexpected download proxy error." }, { status: 500 });
  }
}
