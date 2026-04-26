"use client";

import useSWR from "swr";
import { BRANDING } from "@/lib/branding";
import { cn } from "@/lib/cn";
import { publicBrandingFetcher } from "@/hooks/usePublicBrandingSwr";

const SWR_KEY = "/api/public/branding";

export type DynamicLogoProps = {
  className?: string;
  /** Tailwind height class; width follows image aspect ratio. */
  heightClass?: string;
  /** Accessible label; defaults to platform name from branding or {@link BRANDING.name}. */
  alt?: string;
};

/**
 * Loads the admin-configured logo from `GET /api/public/branding` (SWR, deduped).
 * Falls back to {@link BRANDING.logoPath} while loading, on error, or when `logoUrl` is empty.
 */
export function DynamicLogo({ className, heightClass = "h-8", alt }: DynamicLogoProps) {
  const { data, error, isLoading } = useSWR(SWR_KEY, publicBrandingFetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  const raw = data?.branding?.logoUrl;
  const logoUrl = typeof raw === "string" ? raw.trim() : "";
  const name =
    typeof data?.branding?.brandName === "string" && data.branding.brandName.trim()
      ? data.branding.brandName.trim()
      : BRANDING.name;

  const useFallback = Boolean(error) || isLoading || !logoUrl;
  const src = useFallback ? BRANDING.logoPath : logoUrl;

  return (
    <img
      src={src}
      alt={alt ?? name}
      className={cn(heightClass, "w-auto object-contain object-left", className)}
      loading="eager"
      decoding="async"
    />
  );
}
