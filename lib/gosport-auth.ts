import { getPrisma } from "@/lib/db";

const GOSPORT_BASE_URL = "https://www.gosport365.com";
const CSRF_URL = `${GOSPORT_BASE_URL}/api/auth/csrf`;
const LOGIN_URL = `${GOSPORT_BASE_URL}/api/auth/callback/credentials`;

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
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

  let username = String(params.username ?? "").trim();
  let password = String(params.password ?? "").trim();
  if (!username || !password) {
    const userRow = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        id: true,
        role: true,
        goSportUsername: true,
        goSportPassword: true,
      },
    });
    if (!userRow || String(userRow.role ?? "").trim().toUpperCase() !== "AGENT") {
      throw new Error("Agent account not found for GoSport integration.");
    }
    username = String(userRow.goSportUsername ?? "").trim();
    password = String(userRow.goSportPassword ?? "").trim();
  }
  if (!username || !password) {
    await deactivateIntegration();
    throw new Error("Integration disconnected: Invalid GoSport credentials.");
  }

  try {
    // Step 1: fetch CSRF token + csrf cookie.
    const csrfRes = await fetch(CSRF_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!csrfRes.ok) {
      throw new Error(`Failed to fetch CSRF token (status ${csrfRes.status}).`);
    }

    const csrfJson = (await csrfRes.json().catch(() => ({}))) as { csrfToken?: unknown };
    const csrfToken = String(csrfJson.csrfToken ?? "").trim();
    if (!csrfToken) {
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
      userAgent:
        String(process.env.GOSPORT_AGENT_USER_AGENT ?? "").trim() ||
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      device: String(process.env.GOSPORT_AGENT_DEVICE ?? "desktop"),
      csrfToken,
      json: "true",
    });

    const loginRes = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: GOSPORT_BASE_URL,
        Referer: `${GOSPORT_BASE_URL}/en/login?callbackUrl=%2Fagent%2Ftransfer`,
        Cookie: `${csrfCookie.name}=${csrfCookie.value}; ${callbackCookieName}=${callbackCookieValue}`,
      },
      body: body.toString(),
      redirect: "manual",
      cache: "no-store",
    });

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
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Integration disconnected")) {
      throw error;
    }
    await deactivateIntegration();
    throw new Error("Integration disconnected: Invalid GoSport credentials.");
  }
}
