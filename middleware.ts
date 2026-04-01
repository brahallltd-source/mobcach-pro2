import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/security";

function clearAndRedirectToLogin(req: NextRequest) {
  const url = new URL("/login", req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set("mobcash_session", "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("mobcash_session")?.value;

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isAgentRoute =
    pathname === "/agent" || pathname.startsWith("/agent/");
  const isPlayerRoute =
    pathname === "/player" || pathname.startsWith("/player/");

  const needsAuth = isAdminRoute || isAgentRoute || isPlayerRoute;

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (!token) {
    return clearAndRedirectToLogin(req);
  }

  try {
    const payload = await verifySessionToken(token);
    const role = String(payload.role || "").toLowerCase();

    if (isAdminRoute && role !== "admin") {
      return clearAndRedirectToLogin(req);
    }

    if (isAgentRoute && role !== "agent") {
      return clearAndRedirectToLogin(req);
    }

    if (isPlayerRoute && role !== "player") {
      return clearAndRedirectToLogin(req);
    }

    return NextResponse.next();
  } catch {
    return clearAndRedirectToLogin(req);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/agent/:path*", "/player/:path*"],
};