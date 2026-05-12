"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

type FaqItem = {
  question: string;
  answer: ReactNode;
  highlight?: string;
};

export function PlayerFAQSection() {
  const { tx } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const FAQ_ITEMS: readonly FaqItem[] = [
    {
      question: tx("home.playerFaq.items.0.question"),
      answer: (
        <>
          {tx("home.playerFaq.items.0.answerPrefix")}{" "}
          <span className="font-extrabold text-emerald-300">{tx("home.playerFaq.items.0.answerHighlight")}</span>{" "}
          {tx("home.playerFaq.items.0.answerSuffix")}
        </>
      ),
      highlight: tx("home.playerFaq.items.0.badge"),
    },
    {
      question: tx("home.playerFaq.items.1.question"),
      answer: tx("home.playerFaq.items.1.answer"),
    },
    {
      question: tx("home.playerFaq.items.2.question"),
      answer: tx("home.playerFaq.items.2.answer"),
      highlight: tx("home.playerFaq.items.2.badge"),
    },
    {
      question: tx("home.playerFaq.items.3.question"),
      answer: (
        <>
          {tx("home.playerFaq.items.3.answerPrefix")}{" "}
          <span className="font-extrabold text-cyan-300">{tx("home.playerFaq.items.3.answerAmountRange")}</span>{" "}
          {tx("home.playerFaq.items.3.answerMiddle")}{" "}
          <span className="font-extrabold text-emerald-300">{tx("home.playerFaq.items.3.answerTime")}</span>{" "}
          {tx("home.playerFaq.items.3.answerSuffix")}
        </>
      ),
    },
    {
      question: tx("home.playerFaq.items.4.question"),
      answer: tx("home.playerFaq.items.4.answer"),
    },
  ];

  return (
    <section id="player-faq" className="scroll-mt-24 py-20">
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white md:text-4xl">{tx("home.playerFaq.title")}</h2>
          <p className="mt-3 text-sm text-slate-400 md:text-base">{tx("home.playerFaq.subtitle")}</p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <GlassCard
                key={item.question}
                className={cn(
                  "overflow-hidden border-white/10 bg-white/[0.02] backdrop-blur-xl",
                  isOpen ? "shadow-[0_0_26px_rgba(16,185,129,0.18),0_0_20px_rgba(34,211,238,0.14)]" : "",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-start md:p-6"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold text-white md:text-base">{item.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-300",
                      isOpen ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/10 px-5 pb-5 pt-4 md:px-6 md:pb-6">
                        <p className="text-sm leading-7 text-slate-300">{item.answer}</p>
                        {item.highlight ? (
                          <div className="mt-3">
                            <span className="inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                              {item.highlight}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

