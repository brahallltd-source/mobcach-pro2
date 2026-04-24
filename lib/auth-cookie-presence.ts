/**
 * Shared cookie names for “something session-like is present” checks.
 * Keep aligned with `middleware.ts` and `lib/server-session-user.ts`.
 */
export const MOBCASH_JWT_COOKIE_NAMES = [
  "mobcash_session",
  "token",
  "auth_token",
  "mobcash_token",
] as const;

export const MOBCASH_USER_COOKIE = "mobcash_user";

/** Optional NextAuth (this app is custom-session-first; some stacks run both). */
export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export type CookieGetter = (name: string) => string | undefined;

export function getCookieValue(get: CookieGetter, name: string): string | undefined {
  const v = get(name);
  return v && v.length > 0 ? v : undefined;
}

/** True if any Mobcash JWT, `mobcash_user`, or NextAuth session cookie is set. */
export function hasAuthCookiePresence(get: CookieGetter): boolean {
  for (const n of MOBCASH_JWT_COOKIE_NAMES) {
    if (getCookieValue(get, n)) return true;
  }
  if (getCookieValue(get, MOBCASH_USER_COOKIE)) return true;
  for (const n of NEXTAUTH_SESSION_COOKIE_NAMES) {
    if (getCookieValue(get, n)) return true;
  }
  return false;
}

export function hasNextAuthSessionCookie(get: CookieGetter): boolean {
  for (const n of NEXTAUTH_SESSION_COOKIE_NAMES) {
    if (getCookieValue(get, n)) return true;
  }
  return false;
}
