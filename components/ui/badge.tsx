import * as React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" && "border-transparent bg-cyan-500/20 text-cyan-100",
        variant === "secondary" && "border-white/10 bg-white/10 text-white/80",
        variant === "outline" && "border-white/15 bg-transparent text-white/85",
        variant === "destructive" && "border-transparent bg-rose-500/20 text-rose-100",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
