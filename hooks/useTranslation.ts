"use client";

import { useCallback, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { agentT, type AgentTranslationKey } from "@/lib/i18n/dictionaries/agent";

/**
 * Agent-flow copy keyed by `lib/i18n/dictionaries/agent.ts`.
 * JSON messages under `agent.*` in `messages/{lang}.json` — use {@link useAgentTranslation}.`am("path")`
 * (e.g. `am("topup.summary.total")` → `agent.topup.summary.total`).
 */
export function useAgentTranslation() {
  const { lang, tx, dir } = useTranslation();
  const am = useCallback(
    (path: string, vars?: Record<string, string>) => tx(`agent.${path}`, vars),
    [tx],
  );
  return useMemo(
    () => ({
      lang,
      dir,
      am,
      t: (key: AgentTranslationKey) => agentT(lang, key),
      ta: (key: AgentTranslationKey, vars?: Record<string, string>) => {
        let s = agentT(lang, key);
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            s = s.split(`{{${k}}}`).join(v);
          }
        }
        return s;
      },
    }),
    [lang, dir, am],
  );
}
