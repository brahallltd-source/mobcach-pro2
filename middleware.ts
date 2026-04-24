import { NextRequest, NextResponse } from "next/server";
import {
  MOBCASH_JWT_COOKIE_NAMES,
  MOBCASH_USER_COOKIE,
  hasNextAuthSessionCookie,
} from "@/lib/auth-cookie-presence";
import { verifySessionToken } from "@/lib/security";

/** Cookie names used for the JWT session (keep in sync with `lib/server-auth.ts`). */
const SESSION_COOKIE_NAMES = MOBCASH_JWT_COOKIE_NAMES;

/** Role claim stored in the session JWT (`User.role`-style). */
type JwtRole = "SUPER_ADMIN" | "ADMIN" | "AGENT" | "PLAYER";

/**
 * API routes that must stay public (no session).
 * All other matched `/api/{admin|agent|player}/*` routes require the matching role.
 */
const PUBLIC_API_PATHS = new Set<string>([
  "/api/agent/public-profile",
  "/api/admin/payment-methods-public",
  "/api/admin/setup-first-admin",
]);

function dashboardPath(role: JwtRole): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin/dashboard";
    case "AGENT":
      return "/agent/dashboard";
    case "PLAYER":
      return "/player/dashboard";
  }
}

function isHomePage(pathname: string): boolean {
  return pathname === "/";
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isUnderApiSegment(
  pathname: string,
  segment: "admin" | "agent" | "player",
): boolean {
  const base = `/api/${segment}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isUnderAgentRechargeAliasApi(pathname: string): boolean {
  return pathname === "/api/recharge" || pathname.startsWith("/api/recharge/");
}

function getRequiredRole(pathname: string): JwtRole | null {
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    isUnderApiSegment(pathname, "admin")
  ) {
    return "ADMIN";
  }
  if (
    pathname === "/agent" ||
    pathname.startsWith("/agent/") ||
    isUnderApiSegment(pathname, "agent") ||
    isUnderAgentRechargeAliasApi(pathname)
  ) {
    return "AGENT";
  }
  if (
    pathname === "/player" ||
    pathname.startsWith("/player/") ||
    isUnderApiSegment(pathname, "player")
  ) {
    return "PLAYER";
  }
  return null;
}

function isAlreadyOnDesignatedRolePath(pathname: string, role: JwtRole): boolean {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return (
        pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        isUnderApiSegment(pathname, "admin")
      );
    case "AGENT":
      return (
        pathname === "/agent" ||
        pathname.startsWith("/agent/") ||
        isUnderApiSegment(pathname, "agent") ||
        isUnderAgentRechargeAliasApi(pathname)
      );
    case "PLAYER":
      return (
        pathname === "/player" ||
        pathname.startsWith("/player/") ||
        isUnderApiSegment(pathname, "player")
      );
  }
}

function getSessionToken(req: NextRequest): string | undefined {
  const get = (name: string) => req.cookies.get(name)?.value;
  for (const name of SESSION_COOKIE_NAMES) {
    const v = get(name);
    if (v) return v;
  }
  return undefined;
}

function clearSessionCookies(res: NextResponse): void {
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  res.cookies.set(MOBCASH_USER_COOKIE, "", { path: "/", maxAge: 0 });
}

function redirectToLogin(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/login", req.url));
}

function redirectToLoginClearingSession(req: NextRequest): NextResponse {
  const res = redirectToLogin(req);
  clearSessionCookies(res);
  return res;
}

function redirectToDashboard(req: NextRequest, role: JwtRole): NextResponse {
  const pathname = req.nextUrl.pathname;
  if (isAlreadyOnDesignatedRolePath(pathname, role)) {
    return NextResponse.next();
  }
  const target = new URL(dashboardPath(role), req.url);
  if (target.pathname === pathname) {
    return NextResponse.next();
  }
  return NextResponse.redirect(target);
}

function jsonForbidden(message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

function jsonUnauthorized(message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

function parseRoleString(role: unknown): JwtRole | null {
  const r = String(role ?? "").trim().toLowerCase();
  if (r === "super_admin") return "SUPER_ADMIN";
  if (r === "admin") return "ADMIN";
  if (r === "agent") return "AGENT";
  if (r === "player") return "PLAYER";
  return null;
}

function parseMobcashUserJson(req: NextRequest): Record<string, unknown> | null {
  const raw = req.cookies.get(MOBCASH_USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseMobcashUserRole(req: NextRequest): JwtRole | null {
  const data = parseMobcashUserJson(req);
  if (!data) return null;
  return parseRoleString(data.role);
}

async function sessionApplicationStatusUpper(
  req: NextRequest,
  token: string | undefined,
): Promise<string | null> {
  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const raw = (payload as { applicationStatus?: unknown }).applicationStatus;
      if (typeof raw === "string" && raw.trim() !== "") {
        return raw.trim().toUpperCase();
      }
    } catch {
      // invalid JWT — try cookie
    }
  }
  const j = parseMobcashUserJson(req);
  if (j) {
    const s = String(j.applicationStatus ?? "").trim();
    if (s !== "") return s.toUpperCase();
  }
  return null;
}

async function resolveRequestRole(
  req: NextRequest,
  token: string | undefined,
): Promise<JwtRole | null> {
  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const fromJwt = parseRoleString(payload.role);
      if (fromJwt) {
        return fromJwt;
      }
    } catch {
      // Invalid/expired session cookie — may still have a good `mobcash_user` in edge cases
    }
  }
  return parseMobcashUserRole(req);
}

/**
 * Edge-safe session snapshot (JWT + `mobcash_user` cookies).
 * Used for the PENDING lock before any role-based dashboard routing.
 */
async function getAuthUser(
  req: NextRequest,
  token: string | undefined,
): Promise<{ role: JwtRole; applicationStatus: string | null } | null> {
  const role = await resolveRequestRole(req, token);
  if (!role) return null;
  const applicationStatus = await sessionApplicationStatusUpper(req, token);
  return { role, applicationStatus };
}

function forbiddenMessageForRole(role: JwtRole): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "Admin access required";
    case "AGENT":
      return "Agent access required";
    case "PLAYER":
      return "Player access required";
  }
}

/**
 * Returns true if `userRole` may access a route that requires `pathRequiredRole`.
 * SUPER_ADMIN bypasses all role-gated segments matched by this middleware.
 */
function rolesMatchPathRequirement(pathRequiredRole: JwtRole, userRole: JwtRole): boolean {
  if (userRole === "SUPER_ADMIN") {
    return true;
  }
  if (pathRequiredRole === "ADMIN") {
    return userRole === "ADMIN";
  }
  return userRole === pathRequiredRole;
}

/**
 * 1) PENDING lock first (any signed-in role with `applicationStatus === PENDING`).
 * 2) Home + login helpers.
 * 3) Role RBAC for `/admin`, `/agent`, `/player` (and scoped API matchers below).
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const token = getSessionToken(req);
  const user = await getAuthUser(req, token);

  const isPendingPage =
    pathname === "/pending" || pathname === "/pending/";
  const applicationPending =
    Boolean(user) &&
    String(user?.applicationStatus ?? "")
      .trim()
      .toUpperCase() === "PENDING";

  if (user && applicationPending) {
    if (isPendingPage) {
      return NextResponse.next();
    }
    if (isApi) {
      return jsonForbidden("Application pending review");
    }
    return NextResponse.redirect(new URL("/pending", req.url));
  }

  if (isHomePage(pathname)) {
    const hasUserCookie = Boolean(req.cookies.get(MOBCASH_USER_COOKIE));
    const role = await resolveRequestRole(req, token);
    if (!role) {
      if (token || hasUserCookie) {
        const res = NextResponse.next();
        clearSessionCookies(res);
        return res;
      }
      return NextResponse.next();
    }
    return redirectToDashboard(req, role);
  }

  if (isLoginPath(pathname)) {
    const hasUserCookie = Boolean(req.cookies.get(MOBCASH_USER_COOKIE));
    const role = await resolveRequestRole(req, token);
    if (!role && (token || hasUserCookie)) {
      const res = NextResponse.next();
      clearSessionCookies(res);
      return res;
    }
    return NextResponse.next();
  }

  const pathRequiredRole = getRequiredRole(pathname);
  if (pathRequiredRole === null) {
    return NextResponse.next();
  }

  if (isApi && PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const hasUserCookie = Boolean(req.cookies.get(MOBCASH_USER_COOKIE));
  const userRole = await resolveRequestRole(req, token);

  if (!userRole) {
    if (isApi) {
      return jsonUnauthorized("Unauthorized");
    }
    const get = (name: string) => req.cookies.get(name)?.value;
    if (hasNextAuthSessionCookie(get)) {
      return NextResponse.next();
    }
    if (token || hasUserCookie) {
      return redirectToLoginClearingSession(req);
    }
    return redirectToLogin(req);
  }

  if (!rolesMatchPathRequirement(pathRequiredRole, userRole)) {
    if (isApi) {
      return jsonForbidden(forbiddenMessageForRole(pathRequiredRole));
    }
    return redirectToDashboard(req, userRole);
  }

  return NextResponse.next();
}

/**
 * Page routes: exclude `api`, Next internals, favicon, and extensioned static paths.
 * API RBAC: re-include `/api/{admin|agent|player|recharge}` trees (same as before).
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/admin",
    "/api/admin/:path*",
    "/api/agent",
    "/api/agent/:path*",
    "/api/player",
    "/api/player/:path*",
    "/api/recharge",
    "/api/recharge/:path*",
  ],
};
