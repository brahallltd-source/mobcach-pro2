import { getPrisma } from "@/lib/db";
import { isMasterAdminEmail } from "@/lib/server-auth";
import { CookieJar } from "tough-cookie";

const GOSPORT_BASE_URL = "https://www.gosport365.com";
const CSRF_URL = `${GOSPORT_BASE_URL}/api/auth/csrf`;
const LOGIN_URL = `${GOSPORT_BASE_URL}/api/auth/callback/credentials`;
const GOSPORT_PROXY_URL = process.env.GOSPORT_PROXY_URL?.trim() || undefined;
const GOSPORT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Minimal shape of a got-scraping response (the bits we use).
 * We keep this local to avoid forcing the heavy got types onto callers.
 */
export type GotScrapingResponseLike = {
  statusCode: number;
  statusMessage?: string;
  body: string;
  headers: Record<string, string | string[] | undefined>;
};

export type GotScrapingOptions = Record<string, unknown>;

type GotScrapingFn = (options: GotScrapingOptions) => Promise<GotScrapingResponseLike>;

let gotScrapingCache: GotScrapingFn | null = null;

/**
 * Lazy-load `got-scraping` because it is ESM-only and we run inside Next.js
 * Node runtime. Cached after first import.
 */
export async function getGotScraping(): Promise<GotScrapingFn> {
  if (gotScrapingCache) return gotScrapingCache;
  const mod = (await import("got-scraping")) as unknown as {
    gotScraping: GotScrapingFn;
  };
  gotScrapingCache = mod.gotScraping;
  return gotScrapingCache;
}

type ParsedHttpBody = {
  rawText: string;
  parsedJson: unknown | null;
};

function parseBodySafe(body: string | undefined | null): ParsedHttpBody {
  const rawText = String(body ?? "");
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
  responseHeaders: Record<string, string | string[] | undefined>;
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

/**
 * Build shared got-scraping options: TLS/header fingerprint spoofing, proxy
 * injection, and disabled HTTP error throwing (we handle non-2xx manually).
 */
export function buildGoSportScrapingOptions(extra: GotScrapingOptions = {}): GotScrapingOptions {
  const base: GotScrapingOptions = {
    useHeaderGenerator: true,
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 124 }],
      devices: ["desktop"],
      operatingSystems: ["windows"],
      locales: ["fr-FR", "fr", "en-US", "en"],
    },
    followRedirect: false,
    throwHttpErrors: false,
    timeout: { request: 30000 },
    retry: { limit: 0 },
    http2: false,
  };
  if (GOSPORT_PROXY_URL) {
    base.proxyUrl = GOSPORT_PROXY_URL;
  }
  return { ...base, ...extra };
}

/**
 * Logs into GoSport NextAuth credentials flow and returns the session token value.
 * Uses got-scraping for Chrome-grade TLS/JA3 fingerprinting + Cloudflare evasion.
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
    proxyEnabled: Boolean(GOSPORT_PROXY_URL),
  });

  // Shared cookie jar persists CSRF + callback cookies between the two requests.
  const cookieJar = new CookieJar();
  const gotScraping = await getGotScraping();

  try {
    // Step 1: fetch CSRF token + csrf cookie (stored automatically in cookieJar).
    let csrfRes: GotScrapingResponseLike;
    try {
      csrfRes = await gotScraping(
        buildGoSportScrapingOptions({
          url: CSRF_URL,
          method: "GET",
          cookieJar,
          headers: {
            referer: `${GOSPORT_BASE_URL}/en/login?callbackUrl=%2Fagent%2Ftransfer`,
          },
        }),
      );
    } catch (error) {
      console.error("[GoSport Auth Debug] CSRF network error", {
        step: "csrf_fetch",
        username,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    console.log("--- GOSPORT CSRF ATTEMPT ---");
    console.log("STATUS:", csrfRes.statusCode);
    console.log(
      "RAW RESPONSE (first 300 chars):",
      String(csrfRes.body ?? "").substring(0, 300),
    );

    if (csrfRes.statusCode < 200 || csrfRes.statusCode >= 300) {
      const csrfBody = parseBodySafe(csrfRes.body);
      logGoSportHttpDetails({
        step: "csrf_fetch",
        status: csrfRes.statusCode,
        statusText: csrfRes.statusMessage ?? "",
        responseHeaders: csrfRes.headers,
        bodyText: csrfBody.rawText,
        bodyJson: csrfBody.parsedJson,
        username,
      });
      if (csrfRes.statusCode === 403 || csrfRes.statusCode === 503) {
        console.error("WAF/Cloudflare IP Block detected in production.");
      }
      throw new Error(`Failed to fetch CSRF token (status ${csrfRes.statusCode}).`);
    }

    const csrfBody = parseBodySafe(csrfRes.body);
    const csrfJson =
      (csrfBody.parsedJson as { csrfToken?: unknown } | null) ??
      ({} as { csrfToken?: unknown });
    const csrfToken = String(csrfJson.csrfToken ?? "").trim();
    if (!csrfToken) {
      logGoSportHttpDetails({
        step: "csrf_missing_token",
        status: csrfRes.statusCode,
        statusText: csrfRes.statusMessage ?? "",
        responseHeaders: csrfRes.headers,
        bodyText: csrfBody.rawText,
        bodyJson: csrfBody.parsedJson,
        username,
      });
      throw new Error("CSRF token missing in /api/auth/csrf response.");
    }

    // Verify the CSRF cookie was captured by the jar.
    const csrfCookies = await cookieJar.getCookies(GOSPORT_BASE_URL);
    const csrfCookieEntry = csrfCookies.find((c) =>
      [
        "__Host-next-auth.csrf-token",
        "__Secure-next-auth.csrf-token",
        "next-auth.csrf-token",
      ].includes(c.key),
    );
    if (!csrfCookieEntry) {
      throw new Error("NextAuth CSRF cookie not found in CSRF response.");
    }

    // Seed the matching callback-url cookie expected by NextAuth.
    const callbackUrl = GOSPORT_BASE_URL;
    const callbackCookieName = csrfCookieEntry.key.startsWith("__Host-")
      ? "__Secure-next-auth.callback-url"
      : "next-auth.callback-url";
    await cookieJar.setCookie(
      `${callbackCookieName}=${encodeURIComponent(callbackUrl)}; Path=/; Secure`,
      GOSPORT_BASE_URL,
    );

    // Step 2: submit credentials. cookieJar auto-attaches CSRF + callback cookies.
    const body = new URLSearchParams({
      redirect: "false",
      loginMode: "username",
      loginField: username,
      password,
      clientIP: String(process.env.GOSPORT_AGENT_CLIENT_IP ?? ""),
      callbackUrl,
      userAgent: GOSPORT_BROWSER_USER_AGENT,
      device: String(process.env.GOSPORT_AGENT_DEVICE ?? "desktop"),
      csrfToken,
      json: "true",
    }).toString();

    let loginRes: GotScrapingResponseLike;
    try {
      loginRes = await gotScraping(
        buildGoSportScrapingOptions({
          url: LOGIN_URL,
          method: "POST",
          cookieJar,
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            origin: GOSPORT_BASE_URL,
            referer: `${GOSPORT_BASE_URL}/en/login?callbackUrl=%2Fagent%2Ftransfer`,
          },
          body,
        }),
      );
    } catch (error) {
      console.error("[GoSport Auth Debug] Login network error", {
        step: "login_fetch",
        username,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const loginBody = parseBodySafe(loginRes.body);
    console.log("--- GOSPORT LOGIN ATTEMPT ---");
    console.log("STATUS:", loginRes.statusCode);
    console.log(
      "RAW RESPONSE (first 300 chars):",
      String(loginBody.rawText ?? "").substring(0, 300),
    );

    if (loginRes.statusCode < 200 || loginRes.statusCode >= 400) {
      logGoSportHttpDetails({
        step: "login_fetch",
        status: loginRes.statusCode,
        statusText: loginRes.statusMessage ?? "",
        responseHeaders: loginRes.headers,
        bodyText: loginBody.rawText,
        bodyJson: loginBody.parsedJson,
        username,
      });
      if (loginRes.statusCode === 403 || loginRes.statusCode === 503) {
        console.error("WAF/Cloudflare IP Block detected in production.");
      }
    }

    // Explicit watchdog trigger for invalid credentials.
    if (loginRes.statusCode === 401 || loginRes.statusCode === 403) {
      await deactivateIntegration();
      throw new Error("Integration disconnected: Invalid GoSport credentials.");
    }

    // Step 3: extract NextAuth session cookie from the shared cookie jar.
    const cookies = await cookieJar.getCookies(GOSPORT_BASE_URL);
    const sessionCookie = cookies.find((c) =>
      [
        "__Secure-next-auth.session-token",
        "next-auth.session-token",
        "__Host-next-auth.session-token",
      ].includes(c.key),
    );
    if (!sessionCookie?.value) {
      logGoSportHttpDetails({
        step: "login_missing_session_cookie",
        status: loginRes.statusCode,
        statusText: loginRes.statusMessage ?? "",
        responseHeaders: loginRes.headers,
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
        ? (error as { response?: { statusCode?: unknown; status?: unknown } }).response
            ?.statusCode ??
          (error as { response?: { status?: unknown } }).response?.status
        : undefined;
    console.error("[GoSport Auth Debug] Catch status code", { status: catchStatus });
    if (catchStatus === 403 || catchStatus === 503) {
      console.error("WAF/Cloudflare IP Block detected in production.");
    }
    console.error("[GoSport Auth Debug] Final catch", {
      step: "loginAndGetGoSportToken",
      username,
      message: error instanceof Error ? error.message : String(error),
    });
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Integration disconnected")) {
      throw error;
    }
    await deactivateIntegration();
    throw new Error("Integration disconnected: Invalid GoSport credentials.");
  }
}
