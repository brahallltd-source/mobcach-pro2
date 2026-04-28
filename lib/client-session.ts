/**
 * Client-side session helpers: the browser cannot read httpOnly `mobcash_session` /
 * `mobcash_user` cookies, so we call `GET /api/auth/session` and mirror the user into
 * `localStorage` for legacy UI that still reads `mobcash_user` there.
 */

import type { MobcashUser } from "@/lib/mobcash-user-types";

const ME_URL = "/api/auth/session";

export type { MobcashUser };

/**
 * If `mobcash_user` is missing in localStorage, fetches the current user from
 * the session and mirrors the login response into `localStorage`.
 * Returns `true` when a user object is available (either was already present or was hydrated).
 */
export async function ensureMobcashUserInLocalStorage(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem("mobcash_user")) return true;

  const res = await fetch(ME_URL, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    user?: unknown;
  };
  if (!res.ok || !data.success || !data.user) {
    return false;
  }
  localStorage.setItem("mobcash_user", JSON.stringify(data.user));
  return true;
}

/** Fetches the current user from the server; does not rely on `localStorage`. */
export async function fetchSessionUser(): Promise<unknown | null> {
  if (typeof window === "undefined") return null;
  const res = await fetch(ME_URL, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    user?: unknown;
  };
  if (!res.ok || !data.success || !data.user) {
    return null;
  }
  return data.user;
}

/**
 * After optional hydration, returns the in-memory `mobcash_user` from
 * `localStorage` if it matches `requiredRole` (case-insensitive). Otherwise `null`.
 */
export async function requireMobcashUserOnClient(
  requiredRole: "admin" | "agent" | "player"
): Promise<MobcashUser | null> {
  if (typeof window === "undefined") return null;
  if (!(await ensureMobcashUserInLocalStorage())) return null;
  const raw = localStorage.getItem("mobcash_user");
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
