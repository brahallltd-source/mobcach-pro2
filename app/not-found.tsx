"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari standalone mode fallback
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (!isStandalone) return;

    const timeout = window.setTimeout(() => {
      window.location.replace("/");
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-bold text-white">404</h1>
      <p className="text-white/80">الصفحة غير موجودة. سيتم تحويلك للصفحة الرئيسية خلال ثانيتين.</p>
      <Link
        href="/"
        className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        العودة الآن
      </Link>
    </main>
  );
}

