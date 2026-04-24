/**
 * Central product branding (defaults before admin overrides from DB).
 * Prefer {@link BRANDING} for static copy; runtime `platformName` may still come from `SystemSettings`.
 */
export const BRANDING = {
  name: "GS365 Cash",
  shortName: "GS365",
  slogan: "شحن وسحب أرباحك في ثوانٍ",
  supportEmail: "support@gs365.cash",
  /** Legacy single-token name (DB / health checks) — prefer {@link BRANDING.name} in UI. */
  legacyPlatformKey: "GS365Cash",
  /** Public path to the default SVG mark (`public/logo.svg`). */
  logoPath: "/logo.svg",
  /** Default marketing hero line (EN) when admin has not set `heroTitle`. */
  defaultHeroTitleEn: "Recharge made simple, trusted and mobile-first.",
  /** Default marketing body (EN). */
  defaultHeroBodyEn:
    "GS365 Cash connects players, agents and admins with a clear recharge flow, trusted agent selection and proof-based order confirmation.",
} as const;

export type BrandingConfig = typeof BRANDING;
