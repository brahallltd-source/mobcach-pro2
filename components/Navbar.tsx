"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NavbarProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "initial" | "animate">;

/**
 * Top app bar wrapper (used by `Shell` in `components/ui.tsx`): slide-down on first paint.
 * Logo, login, and language controls live in `Shell`’s `Navbar` children.
 */
export function Navbar({ children, className, ...rest }: NavbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
