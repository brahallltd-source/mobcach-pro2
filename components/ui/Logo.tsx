import { BRANDING } from "@/lib/branding";
import { cn } from "@/lib/cn";

export type LogoProps = {
  className?: string;
  /** Tailwind height class; width follows SVG aspect ratio. */
  heightClass?: string;
  /** Admin-uploaded logo URL; when empty, uses {@link BRANDING.logoPath}. */
  src?: string | null;
  /** Accessible label (defaults to {@link BRANDING.name}). */
  alt?: string;
};

/**
 * Brand mark from `public/logo.svg` by default, or a custom URL from admin branding.
 */
export function Logo({ className, heightClass = "h-8", src, alt = BRANDING.name }: LogoProps) {
  const url = src && String(src).trim() !== "" ? String(src).trim() : BRANDING.logoPath;
  return (
    <img
      src={url}
      alt={alt}
      className={cn(heightClass, "w-auto object-contain object-left", className)}
      loading="eager"
      decoding="async"
    />
  );
}
