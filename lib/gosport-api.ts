import { loginAndGetGoSportToken } from "@/lib/gosport-auth";
import { HttpsProxyAgent } from "https-proxy-agent";

const GOSPORT_CREATE_PLAYER_URL = "https://api.8d32211.info/api/agent/users/create";
const GOSPORT_TRANSFER_URL = "https://api.8d32211.info/api/agent/transfers/create";
const GOSPORT_SEARCH_PLAYER_URL = "https://api.8d32211.info/api/agent/users/search";
const GOSPORT_PASSWORD_CHANGE_URL = "https://api.8d32211.info/api/agent/users/changePassword";
const GOSPORT_NEXTAUTH_SESSION_URL = "https://www.gosport365.com/api/auth/session";
const proxyUrl = process.env.GOSPORT_PROXY_URL;
const goSportProxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

export type CreateGoSportPlayerResult<T = unknown> =
  | { success: true; goSportId: string | number; data: T; error: null }
  | { success: false; goSportId: null; data: null; error: string };
export type TransferGoSportBalanceResult<T = unknown> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };
export type UpdateGoSportPlayerPasswordResult<T = unknown> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

type GoSportRequestResult = {
  ok: boolean;
  status: number;
  parsed: unknown;
};

type GoSportSessionAuth = {
  accessToken: string;
  parentId: number;
};

type ProxiedRequestInit = RequestInit & {
  agent?: unknown;
};

function withGoSportProxy(init: RequestInit): ProxiedRequestInit {
  if (!goSportProxyAgent) return init;
  return {
    ...init,
    agent: goSportProxyAgent,
  };
}

export type AgentGoSportAuth = {
  accessToken: string;
  agentId: number;
};

type GoSportSearchCandidate = {
  username: string;
  id: number;
};

function extractErrorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === "object" && parsed !== null) {
    const maybeMessage = (parsed as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
    const maybeError = (parsed as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError.trim();
    }
  }
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  return `GoSport API request failed with status ${status}.`;
}

function isUnauthorizedResponse(res: GoSportRequestResult): boolean {
  if (res.status === 401 || res.status === 403) return true;
  const msg = extractErrorMessage(res.parsed, res.status).toLowerCase();
  return msg.includes("unauthorized") || msg.includes("forbidden");
}

function isHardTransferFailureMessage(message: string): boolean {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("insufficient funds") ||
    m.includes("insufficient balance") ||
    m.includes("not enough balance") ||
    m.includes("target not found") ||
    m.includes("recipient not found") ||
    m.includes("receiver not found") ||
    m.includes("player not found")
  );
}

function throwIfHardTransferFailure(parsed: unknown, status: number): void {
  const message = extractErrorMessage(parsed, status);
  if (isHardTransferFailureMessage(message)) {
    throw new Error(message);
  }
}

async function fetchGoSportSessionAuth(sessionToken: string): Promise<GoSportSessionAuth> {
  const response = await fetch(GOSPORT_NEXTAUTH_SESSION_URL, withGoSportProxy({
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
    },
    cache: "no-store",
  }));

  if (!response.ok) {
    throw new Error(`Failed to fetch GoSport session (status ${response.status}).`);
  }

  const sessionData = (await response.json().catch(() => ({}))) as {
    user?: { profile?: { token?: unknown; id?: unknown } };
  };
  const accessToken = String(sessionData.user?.profile?.token ?? "").trim();
  const parentIdRaw = String(sessionData.user?.profile?.id ?? "").trim();
  const parentId = Number.parseInt(parentIdRaw, 10);
  if (!accessToken) {
    throw new Error("GoSport session token is missing.");
  }
  if (!Number.isFinite(parentId)) {
    throw new Error("GoSport session parent id is missing.");
  }

  return { accessToken, parentId };
}

export async function getAgentGoSportAuth(agentUserId: string): Promise<AgentGoSportAuth> {
  const safeAgentUserId = String(agentUserId || "").trim();
  if (!safeAgentUserId) {
    throw new Error("agentUserId is required to fetch GoSport auth.");
  }

  const sessionToken = await loginAndGetGoSportToken({ agentUserId: safeAgentUserId });
  const sessionAuth = await fetchGoSportSessionAuth(sessionToken);
  return {
    accessToken: sessionAuth.accessToken,
    agentId: sessionAuth.parentId,
  };
}

function collectSearchRows(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed !== "object" || parsed === null) return [];
  const o = parsed as Record<string, unknown>;
  const pools = [o.data, o.items, o.results, o.users];
  for (const pool of pools) {
    if (Array.isArray(pool)) return pool;
  }
  return [];
}

function toSearchCandidate(row: unknown): GoSportSearchCandidate | null {
  if (typeof row !== "object" || row === null) return null;
  const rec = row as Record<string, unknown>;
  const nestedUser =
    typeof rec.user === "object" && rec.user !== null ? (rec.user as Record<string, unknown>) : null;

  const usernameRaw = nestedUser?.username ?? rec.username ?? rec.userName;
  const idRaw = nestedUser?.id ?? rec.id ?? rec.userId;

  const username = String(usernameRaw ?? "").trim();
  const idNum = Number.parseInt(String(idRaw ?? "").trim(), 10);
  if (!username || !Number.isFinite(idNum)) return null;
  return { username, id: idNum };
}

async function searchGoSportPlayers(
  agentToken: string,
  params: URLSearchParams,
): Promise<{ status: number; parsed: unknown }> {
  const url = `${GOSPORT_SEARCH_PLAYER_URL}?${params.toString()}`;
  const response = await fetch(url, withGoSportProxy({
    method: "GET",
    headers: {
      authorization: `Bearer ${agentToken}`,
      skinid: "kawarji365",
      accept: "application/json",
    },
    cache: "no-store",
  }));

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = rawText;
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, response.status));
  }

  return { status: response.status, parsed };
}

function findPlayerIdByUsername(parsed: unknown, username: string): number | null {
  const target = String(username || "").trim().toLowerCase();
  if (!target) return null;
  const rows = collectSearchRows(parsed);
  for (const row of rows) {
    const candidate = toSearchCandidate(row);
    if (!candidate) continue;
    if (candidate.username.trim().toLowerCase() === target) {
      return candidate.id;
    }
  }
  return null;
}

export async function resolveGoSportPlayerId(agentToken: string, username: string): Promise<number> {
  const safeToken = String(agentToken || "").trim();
  const safeUsername = String(username || "").trim();
  if (!safeToken) {
    throw new Error("agentToken is required to resolve GoSport player id.");
  }
  if (!safeUsername) {
    throw new Error("username is required to resolve GoSport player id.");
  }

  const baseParams = new URLSearchParams({
    filter: "Player",
    paged: "1",
    orderBy: "alphabetically",
  });
  const listResult = await searchGoSportPlayers(safeToken, baseParams);
  const hit = findPlayerIdByUsername(listResult.parsed, safeUsername);
  if (hit !== null) return hit;

  throw new Error("Player username not found in Agent's GoSport player list.");
}

async function sendCreatePlayerRequest(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<GoSportRequestResult> {
  const response = await fetch(GOSPORT_CREATE_PLAYER_URL, withGoSportProxy({
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      skinid: "kawarji365",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }));

  let parsed: unknown = null;
  try {
    parsed = (await response.json()) as unknown;
  } catch {
    const rawText = await response.text().catch(() => "");
    parsed = rawText || null;
  }

  return {
    ok: response.ok,
    status: response.status,
    parsed,
  };
}

function extractCreatedPlayerId(parsed: unknown): string | number | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const root = parsed as Record<string, unknown>;
  const directId = root.id;
  if (typeof directId === "number" || typeof directId === "string") {
    const s = String(directId).trim();
    if (s) return directId;
  }
  const dataObj =
    typeof root.data === "object" && root.data !== null ? (root.data as Record<string, unknown>) : null;
  const dataId = dataObj?.id;
  if (typeof dataId === "number" || typeof dataId === "string") {
    const s = String(dataId).trim();
    if (s) return dataId;
  }
  return null;
}

export async function createGoSportPlayer(
  agentUserId: string,
  username: string,
  password: string,
): Promise<CreateGoSportPlayerResult> {
  const safeAgentUserId = String(agentUserId || "").trim();
  if (!safeAgentUserId) {
    return {
      success: false,
        goSportId: null,
      data: null,
      error: "agentUserId is required.",
    };
  }
  const safeUsername = String(username || "").trim();
  const safePassword = String(password || "").trim();

  if (!safeUsername || !safePassword) {
    return {
      success: false,
      goSportId: null,
      data: null,
      error: "username and password are required.",
    };
  }

  try {
    let sessionToken = await loginAndGetGoSportToken({ agentUserId: safeAgentUserId });
    let sessionAuth = await fetchGoSportSessionAuth(sessionToken);

    let payload = {
      username: safeUsername,
      password: safePassword,
      role: "Player",
      langCode: "en",
      currency_id: 23,
      country_id: 221,
      parent: sessionAuth.parentId,
      timezone_id: 176,
    };
    let result = await sendCreatePlayerRequest(sessionAuth.accessToken, payload);

    // Graceful retry once with a newly fetched token when auth is stale.
    if (!result.ok && isUnauthorizedResponse(result)) {
      sessionToken = await loginAndGetGoSportToken({ agentUserId: safeAgentUserId });
      sessionAuth = await fetchGoSportSessionAuth(sessionToken);
      payload = {
        username: safeUsername,
        password: safePassword,
        role: "Player",
        langCode: "en",
        currency_id: 23,
        country_id: 221,
        parent: sessionAuth.parentId,
        timezone_id: 176,
      };
      result = await sendCreatePlayerRequest(sessionAuth.accessToken, payload);
    }

    if (!result.ok) {
      return {
        success: false,
        goSportId: null,
        data: null,
        error: extractErrorMessage(result.parsed, result.status),
      };
    }

    const goSportId = extractCreatedPlayerId(result.parsed);
    if (goSportId === null) {
      return {
        success: false,
        goSportId: null,
        data: null,
        error: "GoSport player id is missing in creation response.",
      };
    }

    return {
      success: true,
      goSportId,
      data: result.parsed,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GoSport API error.";
    return {
      success: false,
      goSportId: null,
      data: null,
      error: message,
    };
  }
}

export async function transferGoSportBalance(
  agentToken: string,
  agentId: number,
  playerId: number,
  amount: number,
): Promise<TransferGoSportBalanceResult> {
  const safeToken = String(agentToken || "").trim();
  if (!safeToken) {
    return {
      success: false,
      data: null,
      error: "agentToken is required.",
    };
  }
  if (!Number.isFinite(agentId) || !Number.isFinite(playerId) || !Number.isFinite(amount)) {
    return {
      success: false,
      data: null,
      error: "agentId, playerId, and amount must be valid numbers.",
    };
  }

  try {
    const response = await fetch(GOSPORT_TRANSFER_URL, withGoSportProxy({
      method: "POST",
      headers: {
        authorization: `Bearer ${safeToken}`,
        skinid: "kawarji365",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: agentId,
        to: playerId,
        amount,
        note: "Auto-deposit via GS365 Cash",
        currency: "MAD",
      }),
      cache: "no-store",
    }));

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText) as unknown;
      } catch {
        parsed = rawText;
      }
    }

    throwIfHardTransferFailure(parsed, response.status);

    const parsedObj =
      typeof parsed === "object" && parsed !== null ? (parsed as { success?: unknown }) : null;
    const apiMarkedFailure = parsedObj?.success === false;
    if (apiMarkedFailure) {
      const message = extractErrorMessage(parsed, response.status);
      if (isHardTransferFailureMessage(message)) {
        throw new Error(message);
      }
      return {
        success: false,
        data: null,
        error: message,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(parsed, response.status),
      };
    }

    return {
      success: true,
      data: parsed,
      error: null,
    };
  } catch (error) {
    if (error instanceof Error && isHardTransferFailureMessage(error.message)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown GoSport API error.";
    return {
      success: false,
      data: null,
      error: message,
    };
  }
}

export async function updateGoSportPlayerPassword(
  agentToken: string,
  username: string,
  newPassword: string,
): Promise<UpdateGoSportPlayerPasswordResult> {
  const safeToken = String(agentToken || "").trim();
  const safeUsername = String(username || "").trim();
  const safePassword = String(newPassword || "").trim();
  if (!safeToken) {
    return {
      success: false,
      data: null,
      error: "agentToken is required.",
    };
  }
  if (!safeUsername) {
    return {
      success: false,
      data: null,
      error: "username is required.",
    };
  }
  if (safePassword.length < 6) {
    return {
      success: false,
      data: null,
      error: "newPassword must be at least 6 characters.",
    };
  }

  try {
    const response = await fetch(GOSPORT_PASSWORD_CHANGE_URL, withGoSportProxy({
      method: "POST",
      headers: {
        authorization: `Bearer ${safeToken}`,
        accept: "application/json",
        "content-type": "application/json",
        skinid: "kawarji365",
      },
      body: JSON.stringify({
        username: safeUsername,
        password: safePassword,
        password_confirmation: safePassword,
      }),
      cache: "no-store",
    }));

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText) as unknown;
      } catch {
        parsed = rawText;
      }
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(parsed, response.status));
    }

    const parsedObj =
      typeof parsed === "object" && parsed !== null ? (parsed as { success?: unknown }) : null;
    if (parsedObj?.success === false) {
      throw new Error(extractErrorMessage(parsed, response.status));
    }

    return { success: true, data: parsed, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GoSport API error.";
    return {
      success: false,
      data: null,
      error: message,
    };
  }
}
