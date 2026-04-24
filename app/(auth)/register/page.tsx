"use client";

import { Suspense } from "react";
import { Shell } from "@/components/ui";
import { RegisterPlayerClient } from "@/components/RegisterPlayerClient";

/**
 * Auth-group register entry: same PLAYER flow as `/register/player`, with session overlap handling.
 * Invite `?ref=` is read inside {@link RegisterPlayerClient} as a hidden `inviteCode` (not the username field);
 * optional manual agent code stays separate. `role` is always PLAYER server-side.
 */
export default function AuthRegisterPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="mx-auto max-w-6xl py-12 text-center text-white/70">جاري التحميل…</div>
        </Shell>
      }
    >
      <RegisterPlayerClient
        registerApiPath="/api/auth/register"
        multiStepAgentSelection
        pageTitle="إنشاء حساب لاعب"
        pageSubtitle="سجّل كمستخدم لاعب. تسجيل الوكلاء يتم من صفحة «كن وكيلاً» فقط."
      />
    </Suspense>
  );
}
