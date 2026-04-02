import "./globals.css";
import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language";

export const metadata: Metadata = {
  title: "MobCash Pro",
  description: "Modern recharge workflow for players, agents and admins",
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