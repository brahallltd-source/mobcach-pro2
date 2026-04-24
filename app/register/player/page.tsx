"use client";

import { Suspense } from "react";
import { Shell } from "@/components/ui";
import { RegisterPlayerClient } from "@/components/RegisterPlayerClient";

export default function RegisterPlayerPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="mx-auto max-w-6xl py-12 text-center text-white/70">جاري التحميل…</div>
        </Shell>
      }
    >
      <RegisterPlayerClient registerApiPath="/api/register" />
    </Suspense>
  );
}
