/**
 * Client-side session helpers: the browser cannot read httpOnly `mobcash_session` /
 * `mobcash_user` cookies, so we call `GET /api/auth/session` and mirror the user into
 * `localStorage` for legacy UI that still reads `mobcash_user` there.
 */

import type { MobcashUser } from "@/lib/mobcash-user-types";

const ME_URL = "/api/auth/session";
const RESTORE_URL = "/api/auth/restore";
const USER_STORAGE_KEY = "mobcash_user";
const SESSION_TOKEN_STORAGE_KEY = "mobcash_session_token";

export type { MobcashUser };

type SessionApiResponse = {
  success?: boolean;
  user?: unknown;
  sessionToken?: string;
};

export function saveClientSession(user: unknown, sessionToken?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  if (typeof sessionToken === "string" && sessionToken.trim()) {
    localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken.trim());
  }
}

export function clearClientSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token && token.trim() ? token.trim() : null;
}

/**
 * If `mobcash_user` is missing in localStorage, fetches the current user from
 * the session and mirrors the login response into `localStorage`.
 * Returns `true` when a user object is available (either was already present or was hydrated).
 */
export async function ensureMobcashUserInLocalStorage(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(USER_STORAGE_KEY)) return true;

  const res = await fetch(ME_URL, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as SessionApiResponse;
  if (!res.ok || !data.success || !data.user) {
    return false;
  }
  saveClientSession(data.user, data.sessionToken);
  return true;
}

/** Fetches the current user from the server; does not rely on `localStorage`. */
export async function fetchSessionUser(): Promise<unknown | null> {
  if (typeof window === "undefined") return null;
  const res = await fetch(ME_URL, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as SessionApiResponse;
  if (!res.ok || !data.success || !data.user) {
    return null;
  }
  saveClientSession(data.user, data.sessionToken);
  return data.user;
}

/**
 * Restores server cookies from a persisted token when WebView process restarts and
 * drops in-memory session cookies. Returns `true` when a valid session exists/restored.
 */
export async function restoreSessionFromLocalToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const existing = await fetchSessionUser();
  if (existing) return true;

  const storedToken = getStoredSessionToken();
  if (!storedToken) return false;

  const res = await fetch(RESTORE_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: storedToken }),
  });
  const data = (await res.json().catch(() => ({}))) as SessionApiResponse;
  if (!res.ok || !data.success || !data.user) {
    return false;
  }
  saveClientSession(data.user, data.sessionToken ?? storedToken);
  return true;
}

/**
 * After optional hydration, returns the in-memory `mobcash_user` from
 * `localStorage` if it matches `requiredRole` (case-insensitive). Otherwise `null`.
 */
export async function requireMobcashUserOnClient(
  requiredRole: "admin" | "agent" | "player"
): Promise<MobcashUser | null> {
  if (typeof window === "undefined") return null;
  await restoreSessionFromLocalToken();
  if (!(await ensureMobcashUserInLocalStorage())) return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  let u: MobcashUser & Record<string, unknown>;
  try {
    u = JSON.parse(raw) as MobcashUser & Record<string, unknown>;
  } catch {
    return null;
  }
  if (String(u.role).toLowerCase() !== requiredRole) return null;
  return u;
}

export function redirectToLogin() {
  if (typeof window !== "undefined") window.location.href = "/login";
}
