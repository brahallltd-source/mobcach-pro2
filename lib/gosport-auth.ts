import { getPrisma } from "@/lib/db";
import { isMasterAdminEmail } from "@/lib/server-auth";

const GOSPORT_BASE_URL = "https://www.gosport365.com";
const CSRF_URL = `${GOSPORT_BASE_URL}/api/auth/csrf`;
const LOGIN_URL = `${GOSPORT_BASE_URL}/api/auth/callback/credentials`;
const GOSPORT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

type ParsedHttpBody = {
  rawText: string;
  parsedJson: unknown | null;
};

function getSetCookieLines(headers: Headers): string[] {
  const h = headers as HeadersWithSetCookie;
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  if (!combined) return [];
  // Split multiple Set-Cookie entries while preserving Expires commas.
  return combined.split(/,(?=\s*[^;,\s]+=)/g).map((v) => v.trim()).filter(Boolean);
}

function parseCookiePair(setCookieLine: string): { name: string; value: string } | null {
  const pair = setCookieLine.split(";")[0]?.trim();
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;
  return { name, value };
}

function findCookieValue(
  setCookieLines: string[],
  names: readonly string[],
): { name: string; value: string } | null {
  for (const line of setCookieLines) {
    const parsed = parseCookiePair(line);
    if (!parsed) continue;
    if (names.includes(parsed.name)) return parsed;
  }
  return null;
}

async function readHttpBodySafe(response: Response): Promise<ParsedHttpBody> {
  const rawText = await response.text().catch(() => "");
  let parsedJson: unknown | null = null;
  if (rawText) {
    try {
      parsedJson = JSON.parse(rawText) as unknown;
    } catch {
      parsedJson = null;
    }
  }
  return { rawText, parsedJson };
}

function logGoSportHttpDetails(args: {
  step: string;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  bodyText: string;
  bodyJson: unknown | null;
  username: string;
}): void {
  console.error("[GoSport Auth Debug] HTTP failure", {
    step: args.step,
    status: args.status,
    statusText: args.statusText,
    username: args.username,
    responseHeaders: args.responseHeaders,
    bodyJson: args.bodyJson,
    bodyTextPreview: args.bodyText.slice(0, 5000),
  });
}

function toHeaderRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Logs into GoSport NextAuth credentials flow and returns the session token value.
 */
export async function loginAndGetGoSportToken(params: {
  agentUserId: string;
  username?: string;
  password?: string;
}): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database unavailable for GoSport integration.");
  }
  const agentUserId = String(params.agentUserId || "").trim();
  if (!agentUserId) {
    throw new Error("Missing agent user id for GoSport integration.");
  }

  const deactivateIntegration = async () => {
    await prisma.user
      .update({
        where: { id: agentUserId },
        data: { goSportIntegrationStatus: "INACTIVE" },
      })
      .catch(() => {});
  };

  const userRow = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: {
      id: true,
      email: true,
      role: true,
      goSportUsername: true,
      goSportPassword: true,
    },
  });
  if (!userRow) {
    throw new Error("User account not found for GoSport integration.");
  }

  const roleUpper = String(userRow.role ?? "").trim().toUpperCase();
  const isMasterAdmin =
    roleUpper === "SUPER_ADMIN" || isMasterAdminEmail(String(userRow.email ?? ""));

  let username = String(params.username ?? "").trim();
  let password = String(params.password ?? "").trim();
  let credentialSource: "payload" | "db" | "env_master_admin" = "payload";

  if (!username || !password) {
    username = String(userRow.goSportUsername ?? "").trim();
    password = String(userRow.goSportPassword ?? "").trim();
    credentialSource = "db";
  }

  // Multi-tenant rule:
  // - regular agents: credentials must come from payload/agent DB profile
  // - env fallback: allowed only for master admin accounts
  if ((!username || !password) && isMasterAdmin) {
    username = String(process.env.GOSPORT_AGENT_USERNAME ?? "").trim();
    password = String(process.env.GOSPORT_AGENT_PASSWORD ?? "").trim();
    credentialSource = "env_master_admin";
  }

  if (!username || !password) {
    await deactivateIntegration();
    throw new Error("Integration disconnected: Invalid GoSport credentials.");
  }

  if (roleUpper === "AGENT" && credentialSource === "env_master_admin") {
    await deactivateIntegration();
    throw new Error("Integration disconnected: Agent credentials must be configured in profile.");
  }

  console.error("[GoSport Auth Debug] Credential source", {
    agentUserId,
    role: roleUpper,
    source: credentialSource,
    username,
  });

  try {
    const safeUserAgent = GOSPORT_BROWSER_USER_AGENT;

    // Step 1: fetch CSRF token + csrf cookie.
    let csrfRes: Response;
    try {
      csrfRes = await fetch(CSRF_URL, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,ar;q=0.6",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          Connection: "keep-alive",
          "User-Agent": safeUserAgent,
          Referer: `${GOSPORT_BASE_URL}/en/login?callbackUrl=%2Fagent%2Ftransfer`,
          Origin: GOSPORT_BASE_URL,
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("[GoSport Auth Debug] CSRF network error", {
        step: "csrf_fetch",
        username,
        message: error instanceof Error ? error.message : String(error),
        errorResponseStatus:
          typeof error === "object" && error !== null && "response" in error
            ? (error as { response?: { status?: unknown } }).response?.status
            : undefined,
        errorResponseData:
          typeof error === "object" && error !== null && "response" in error
            ? (error as { response?: { data?: unknown } }).response?.data
            : undefined,
      });
      throw error;
    }

    if (!csrfRes.ok) {
      const csrfBody = await readHttpBodySafe(csrfRes);
      logGoSportHttpDetails({
        step: "csrf_fetch",
        status: csrfRes.status,
        statusText: csrfRes.statusText,
        responseHeaders: toHeaderRecord(csrfRes.headers),
        bodyText: csrfBody.rawText,
        bodyJson: csrfBody.parsedJson,
        username,
      });
      throw new Error(`Failed to fetch CSRF token (status ${csrfRes.status}).`);
    }

    const csrfBody = await readHttpBodySafe(csrfRes);
    const csrfJson =
      (csrfBody.parsedJson as { csrfToken?: unknown } | null) ??
      ({} as { csrfToken?: unknown });
    const csrfToken = String(csrfJson.csrfToken ?? "").trim();
    if (!csrfToken) {
      logGoSportHttpDetails({
        step: "csrf_missing_token",
        status: csrfRes.status,
        statusText: csrfRes.statusText,
        responseHeaders: toHeaderRecord(csrfRes.headers),
        bodyText: csrfBody.rawText,
        bodyJson: csrfBody.parsedJson,
        username,
      });
      throw new Error("CSRF token missing in /api/auth/csrf response.");
    }

    const csrfCookie = findCookieValue(getSetCookieLines(csrfRes.headers), [
      "__Host-next-auth.csrf-token",
      "__Secure-next-auth.csrf-token",
      "next-auth.csrf-token",
    ]);
    if (!csrfCookie) {
      throw new Error("NextAuth CSRF cookie not found in CSRF response.");
    }

    // Step 2: submit credentials with csrf token + csrf cookie.
    const callbackUrl = GOSPORT_BASE_URL;
    const callbackCookieName = csrfCookie.name.startsWith("__Host-")
      ? "__Secure-next-auth.callback-url"
      : "next-auth.callback-url";
    const callbackCookieValue = encodeURIComponent(callbackUrl);

    const body = new URLSearchParams({
      redirect: "false",
      loginMode: "username",
      loginField: username,
      password,
      clientIP: String(process.env.GOSPORT_AGENT_CLIENT_IP ?? ""),
      callbackUrl,
      userAgent: safeUserAgent,
      device: String(process.env.GOSPORT_AGENT_DEVICE ?? "desktop"),
      csrfToken,
      json: "true",
    });

    let loginRes: Response;
    try {
      loginRes = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,ar;q=0.6",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          Connection: "keep-alive",
          "User-Agent": safeUserAgent,
          Origin: GOSPORT_BASE_URL,
          Referer: `${GOSPORT_BASE_URL}/en/login?callbackUrl=%2Fagent%2Ftransfer`,
          Cookie: `${csrfCookie.name}=${csrfCookie.value}; ${callbackCookieName}=${callbackCookieValue}`,
        },
        body: body.toString(),
        redirect: "manual",
        cache: "no-store",
      });
    } catch (error) {
      console.error("[GoSport Auth Debug] Login network error", {
        step: "login_fetch",
        username,
        message: error instanceof Error ? error.message : String(error),
        errorResponseStatus:
          typeof error === "object" && error !== null && "response" in error
            ? (error as { response?: { status?: unknown } }).response?.status
            : undefined,
        errorResponseData:
          typeof error === "object" && error !== null && "response" in error
            ? (error as { response?: { data?: unknown } }).response?.data
            : undefined,
      });
      throw error;
    }

    const loginBody = await readHttpBodySafe(loginRes);
    if (!loginRes.ok) {
      logGoSportHttpDetails({
        step: "login_fetch",
        status: loginRes.status,
        statusText: loginRes.statusText,
        responseHeaders: toHeaderRecord(loginRes.headers),
        bodyText: loginBody.rawText,
        bodyJson: loginBody.parsedJson,
        username,
      });
    }

    // Explicit watchdog trigger for invalid credentials.
    if (loginRes.status === 401 || loginRes.status === 403) {
      await deactivateIntegration();
      throw new Error("Integration disconnected: Invalid GoSport credentials.");
    }

    // Step 3: extract NextAuth session cookie from login response.
    const sessionCookie = findCookieValue(getSetCookieLines(loginRes.headers), [
      "__Secure-next-auth.session-token",
      "next-auth.session-token",
      "__Host-next-auth.session-token",
    ]);
    if (!sessionCookie?.value) {
      logGoSportHttpDetails({
        step: "login_missing_session_cookie",
        status: loginRes.status,
        statusText: loginRes.statusText,
        responseHeaders: toHeaderRecord(loginRes.headers),
        bodyText: loginBody.rawText,
        bodyJson: loginBody.parsedJson,
        username,
      });
      await deactivateIntegration();
      throw new Error("Integration disconnected: Invalid GoSport credentials.");
    }

    await prisma.user
      .update({
        where: { id: agentUserId },
        data: { goSportIntegrationStatus: "ACTIVE" },
      })
      .catch(() => {});

    return sessionCookie.value;
  } catch (error) {
    const catchStatus =
      typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: unknown } }).response?.status
        : undefined;
    console.error("[GoSport Auth Debug] Catch status code", { status: catchStatus });
    if (catchStatus === 403 || catchStatus === 503) {
      console.error("WAF/Cloudflare IP Block detected in production.");
    }
    console.error("[GoSport Auth Debug] Final catch", {
      step: "loginAndGetGoSportToken",
      username,
      message: error instanceof Error ? error.message : String(error),
      errorResponseStatus:
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: unknown } }).response?.status
          : undefined,
      errorResponseData:
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: unknown } }).response?.data
          : undefined,
    });
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Integration disconnected")) {
      throw error;
    }
    await deactivateIntegration();
    throw new Error("Integration disconnected: Invalid GoSport credentials.");
  }
}
