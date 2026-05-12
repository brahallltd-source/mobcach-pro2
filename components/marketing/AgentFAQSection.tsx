"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle, MessageCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/lib/i18n";

type AgentFaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
};

const AGENT_FAQ_ITEMS: AgentFaqItem[] = [
  {
    id: "profit-model",
    question: "كيف أحقق الربح بشكل مباشر كوكيل؟",
    answer:
      "عند شحن محفظتك كوكيل تستفيد من هامش فوري (10%)، ما يعني أن ربحك يتحقق مباشرة عند إعادة بيع الرصيد للاعبين دون انتظار دورة سحب تقليدية.",
  },
  {
    id: "master-agent",
    question: "كيف يعمل نظام Master Agent؟",
    answer:
      "يمكنك دعوة شركاء جدد للعمل تحت شبكتك، وتحصل على عمولات إضافية تلقائياً: 2% من شحن الوكلاء المسجلين عبرك و3% من إيداعات اللاعبين المرتبطين بك.",
  },
  {
    id: "usdt-recharge",
    question: "لماذا يتم شحن رصيد الوكلاء عبر USDT (TRC20) فقط؟",
    answer:
      "اعتماد USDT (TRC20) يضمن سرعة أعلى في التسويات، تتبعاً أوضح للحوالات، واستقراراً أكبر في تدفق السيولة المالية داخل النظام.",
  },
  {
    id: "dual-interface",
    question: "ما المقصود بالواجهتين (GoSport365 و GS365Cash)؟",
    answer:
      "واجهة GoSport365 مخصصة لتشغيل حسابات اللاعبين وإدارة الرصيد التشغيلي، بينما GS365Cash مخصصة لإدارة عمليات الشحن، المتابعة، وسير العمل المالي للوكيل.",
  },
  {
    id: "ai-security",
    question: "كيف يحمي النظام الوكيل من التلاعب في إثباتات الدفع؟",
    answer:
      "المنصة تعتمد طبقة تحقق ذكية مدعومة بالذكاء الاصطناعي إلى جانب مراجعة تشغيلية، لرصد الأنماط المشبوهة وتقليل مخاطر التزوير قبل اعتماد أي عملية.",
  },
  {
    id: "mobility",
    question: "هل أستطيع إدارة عملي كوكيل من الهاتف أثناء التنقل؟",
    answer:
      "نعم، الواجهة مصممة لتعمل بكفاءة على الهاتف والكمبيوتر، مع إشعارات لحظية تساعدك على متابعة الطلبات واتخاذ القرار بسرعة من أي مكان.",
  },
  {
    id: "fraud-sentinel-flagging",
    question: "كيف يحميني النظام من وصولات الدفع المزورة أو ادعاء اللاعبين بالإرسال دون دفع؟",
    icon: ShieldAlert,
    iconClassName: "text-rose-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.65)]",
    answer: (
      <>
        نظامنا مزود بـ{" "}
        <span className="font-extrabold text-rose-500">
          System Fraud
        </span>{" "}
        متطور يعمل بالذكاء الاصطناعي لفحص البيانات وتحليل الصور واكتشاف محاولات التزوير آلياً. في حال وجود أي شبهة،
        يتيح لك النظام استخدام{" "}
        <span className="font-extrabold text-rose-500">
          Flag Button
        </span>{" "}
        الموجود بجانب كل طلب؛ بمجرد الضغط عليه، يتم تجميد العملية فوراً وإحالتها لفريق الرقابة المالية للتحقق
        اليدوي وحظر الحسابات المشبوهة نهائياً لضمان سلامة رصيدك.
      </>
    ),
  },
  {
    id: "usdt-whatsapp-support",
    question: "ماذا لو لم يتوفر لدي رصيد USDT حالياً لشحن حساب الوكيل؟",
    icon: MessageCircle,
    iconClassName: "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]",
    answer: (
      <>
        لا تقلق، في حال عدم توفر USDT لديك، يمكنك التواصل مباشرة مع دعم الوكلاء عبر{" "}
        <span className="font-extrabold text-emerald-400">
          الواتساب (WhatsApp)
        </span>{" "}
        فور قبول حسابك في النظام. فريقنا المتخصص سيقوم بإرشادك وتوفير الحلول المناسبة لمساعدتك في شحن رصيدك الأول
        والبدء في نشاطك كشريك معتمد بكل سهولة. رابط التواصل المباشر يظهر لك داخل لوحة الوكيل بعد الموافقة على حسابك.
      </>
    ),
  },
];

export function AgentFAQSection() {
  const { tx } = useTranslation();
  const [openId, setOpenId] = useState<string>(AGENT_FAQ_ITEMS[0].id);
  const localizedItems: AgentFaqItem[] = [
    {
      ...AGENT_FAQ_ITEMS[0],
      question: tx("agent.landing.faq.items.0.question"),
      answer: tx("agent.landing.faq.items.0.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[1],
      question: tx("agent.landing.faq.items.1.question"),
      answer: tx("agent.landing.faq.items.1.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[2],
      question: tx("agent.landing.faq.items.2.question"),
      answer: tx("agent.landing.faq.items.2.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[3],
      question: tx("agent.landing.faq.items.3.question"),
      answer: tx("agent.landing.faq.items.3.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[4],
      question: tx("agent.landing.faq.items.4.question"),
      answer: tx("agent.landing.faq.items.4.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[5],
      question: tx("agent.landing.faq.items.5.question"),
      answer: tx("agent.landing.faq.items.5.answer"),
    },
    {
      ...AGENT_FAQ_ITEMS[6],
      question: tx("agent.landing.faq.items.6.question"),
      answer: (
        <>
          {tx("agent.landing.faq.items.6.answerPrefix")}{" "}
          <span className="font-extrabold text-rose-500">{tx("agent.landing.faq.items.6.systemFraud")}</span>{" "}
          {tx("agent.landing.faq.items.6.answerMiddle")}{" "}
          <span className="font-extrabold text-rose-500">{tx("agent.landing.faq.items.6.flagButton")}</span>{" "}
          {tx("agent.landing.faq.items.6.answerSuffix")}
        </>
      ),
    },
    {
      ...AGENT_FAQ_ITEMS[7],
      question: tx("agent.landing.faq.items.7.question"),
      answer: (
        <>
          {tx("agent.landing.faq.items.7.answerPrefix")}{" "}
          <span className="font-extrabold text-emerald-400">{tx("agent.landing.faq.items.7.whatsapp")}</span>{" "}
          {tx("agent.landing.faq.items.7.answerSuffix")}
        </>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("agent.landing.faq.title")}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
          {tx("agent.landing.faq.subtitle")}
        </p>
      </div>

      <div className="space-y-3">
        {localizedItems.map((item) => {
          const isOpen = openId === item.id;
          const Icon = item.icon ?? HelpCircle;
          const iconClassName = item.iconClassName ?? "text-cyan-300";
          return (
            <GlassCard
              key={item.id}
              className={cn(
                "overflow-hidden border-white/10 bg-white/[0.02] backdrop-blur-xl",
                isOpen
                  ? "border-cyan-300/30 shadow-[0_0_22px_rgba(34,211,238,0.14),0_0_20px_rgba(251,191,36,0.08)]"
                  : "",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? "" : item.id)}
                className="flex w-full items-center justify-between gap-4 p-5 text-start md:p-6"
                aria-expanded={isOpen}
              >
                <span className="inline-flex items-center gap-2 text-sm font-bold text-white md:text-base">
                  <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} aria-hidden />
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-amber-200 transition-transform duration-300",
                    isOpen ? "rotate-180" : "",
                  )}
                  aria-hidden
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/10 px-5 pb-5 pt-4 md:px-6 md:pb-6">
                      <p className="text-sm leading-7 text-slate-300">{item.answer}</p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}

