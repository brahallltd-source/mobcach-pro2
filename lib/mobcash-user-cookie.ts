import { cookies } from "next/headers";

export type MobcashUserCookieAgent = {
  id: string;
  email: string;
  role: string;
};

/**
 * Reads the httpOnly `mobcash_user` cookie (JSON set at login), parses it, and returns
 * the payload only when the user is an agent (`role` is `AGENT`, case-insensitive).
 */
export async function getAgentFromMobcashUserCookie(): Promise<MobcashUserCookieAgent | null> {
  const store = await cookies();
  const raw = store.get("mobcash_user")?.value;
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const data = JSON.parse(decoded) as { id?: unknown; email?: unknown; role?: unknown };
    const id = data.id != null ? String(data.id).trim() : "";
    const email = data.email != null ? String(data.email).trim() : "";
    if (!id || !email) return null;
    if (String(data.role).trim().toUpperCase() !== "AGENT") return null;
    return {
      id,
      email,
      role: String(data.role).trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Same cookie shape as {@link getAgentFromMobcashUserCookie}, but only when `role` is ADMIN.
 */
export async function getAdminFromMobcashUserCookie(): Promise<MobcashUserCookieAgent | null> {
  const store = await cookies();
  const raw = store.get("mobcash_user")?.value;
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const data = JSON.parse(decoded) as { id?: unknown; email?: unknown; role?: unknown };
    const id = data.id != null ? String(data.id).trim() : "";
    const email = data.email != null ? String(data.email).trim() : "";
    if (!id || !email) return null;
    const roleU = String(data.role).trim().toUpperCase();
    if (roleU !== "ADMIN" && roleU !== "SUPER_ADMIN") return null;
    return {
      id,
      email,
      role: String(data.role).trim(),
    };
  } catch {
    return null;
  }
}
