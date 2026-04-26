"use client";

import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { BRANDING } from "@/lib/branding";

export type PublicBrandingPayload = {
  brandName?: string;
  logoUrl?: string;
  heroImages?: string[];
  [key: string]: unknown;
};

export type PublicBrandingResponse = {
  branding?: PublicBrandingPayload;
};

export async function publicBrandingFetcher(url: string): Promise<PublicBrandingResponse> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Branding ${res.status}`);
  }
  return (await res.json()) as PublicBrandingResponse;
}

const SWR_KEY = "/api/public/branding";

export function usePublicBrandingSwr() {
  const { data, error, isLoading, isValidating } = useSWR(SWR_KEY, publicBrandingFetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!data?.branding) return;
    try {
      localStorage.setItem("mobcash_branding", JSON.stringify(data.branding));
    } catch {
      /* ignore quota / private mode */
    }
  }, [data]);

  const branding = data?.branding;

  return useMemo(() => {
    const brandName =
      typeof branding?.brandName === "string" && branding.brandName.trim()
        ? branding.brandName.trim()
        : BRANDING.name;
    const logoUrl = typeof branding?.logoUrl === "string" ? branding.logoUrl.trim() : "";
    const heroImages = Array.isArray(branding?.heroImages)
      ? (branding!.heroImages as unknown[]).map(String)
      : ([] as string[]);

    return {
      brandName,
      logoUrl,
      heroImages,
      raw: branding,
      isLoading: Boolean(isLoading || isValidating) && !data,
      error,
    };
  }, [branding, data, error, isLoading, isValidating]);
}
