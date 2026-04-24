import * as React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50",
          size === "default" && "px-4 py-3 text-sm",
          size === "lg" && "px-5 py-4 text-base font-bold tracking-wide",
          variant === "default" &&
            "bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-[0.99]",
          variant === "outline" && "border border-white/15 bg-white/5 text-white hover:bg-white/10",
          variant === "ghost" && "text-white/80 hover:bg-white/10 hover:text-white",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
