import "./globals.css";
import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language";

export const metadata: Metadata = {
  title: "MobCash Pro",
  description: "Modern recharge workflow for players, agents and admins",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}