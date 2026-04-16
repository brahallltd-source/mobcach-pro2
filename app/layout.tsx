import "./globals.css";
import type { Metadata } from "next";
// 🟢 بدلنا الـ Import باش يقرأ من الملف المصلح
import { LanguageProvider } from "@/lib/i18n"; 
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "GS365Cash",
  description: "Modern recharge workflow for players, agents and admins",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 💡 ملاحظة: الـ html lang هنا كيبقى static للـ Server
    // ولكن الـ LanguageProvider غايتكلف بالـ dir والترجمة لداخل
    <html lang="fr" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <ToastProvider>
            {/* 💡 الـ LanguageProvider اللي صاوبنا فيه ديجا <div dir={dir}> */}
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}