import "./globals.css";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});
import { Toaster } from "sonner";
import { BrandingStyleVars } from "@/components/BrandingStyleVars";
import { AuthSessionRehydrator } from "@/components/auth/AuthSessionRehydrator";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { CacheBuster } from "@/components/pwa/CacheBuster";
import { getRootBranding } from "@/lib/root-branding";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getRootBranding();
  return {
    title: b.platformName,
    description: "المنصة رقم واحد في العالم العربي  والمسؤول الأول عن تسليم كافة مستحقاتك المالية في وقتها وتحميك من اي تلاعب.'",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "GoSport365",
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
    ...(b.faviconUrl
      ? {
          icons: {
            icon: [{ url: b.faviconUrl }],
            apple: [{ url: "/icon-192x192.png" }],
          },
        }
      : {
          icons: {
            apple: [{ url: "/icon-192x192.png" }],
          },
        }),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const b = await getRootBranding();
  const htmlStyle = {
    ["--primary"]: b.primaryColor,
  } as CSSProperties;

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`min-h-screen bg-[#0B0F19] ${tajawal.variable}`}
      style={htmlStyle}
    >
      <body className="relative min-h-screen overflow-x-hidden bg-[#0B0F19] text-white">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-[20%] top-[-15%] h-[min(70vh,640px)] w-[min(95vw,920px)] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -right-[15%] bottom-[-20%] h-[min(65vh,560px)] w-[min(90vw,800px)] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute left-1/2 top-[35%] h-[45vh] w-[min(85vw,720px)] max-w-4xl -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <BrandingStyleVars primaryColor={b.primaryColor} />
        <div className="relative z-0">
          <LanguageProvider>
            <AuthSessionRehydrator />
            <CacheBuster />
            <Toaster richColors position="top-center" closeButton />
            <InstallBanner />
            {children}
          </LanguageProvider>
        </div>
      </body>
    </html>
  );
}
