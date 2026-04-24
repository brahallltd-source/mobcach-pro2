import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** App shell (aligns with `body` gradient base) — use with `bg-background`. */
        background: "#050816",
        /** Form control borders — use with `border-input`. */
        input: "rgba(148, 163, 184, 0.28)",
        /** Muted surfaces and body copy — use with `bg-muted` / `text-muted-foreground`. */
        muted: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          foreground: "rgba(255, 255, 255, 0.58)",
        },
        /** Glass nav / card surfaces (use with opacity modifiers). */
        card: "rgb(11 15 25 / <alpha-value>)",
        /** Theme accent from `SystemSettings.primaryColor` via CSS variable `--primary` */
        primary: "var(--primary)",
        ink: "#0a0f1d",
        panel: "#0f172a",
        soft: "#172033",
        brand: "#6ee7ff",
        brand2: "#8b5cf6",
        success: "#34d399",
        danger: "#fb7185",
        warn: "#fbbf24"
      },
      boxShadow: {
        glow: "0 20px 80px rgba(59,130,246,0.22)",
        glass: "0 10px 30px rgba(2,6,23,0.35)"
      },
      backgroundImage: {
        hero: "radial-gradient(circle at top left, rgba(110,231,255,0.20), transparent 35%), radial-gradient(circle at top right, rgba(139,92,246,0.20), transparent 30%), linear-gradient(180deg, #050816 0%, #09101f 100%)"
      },
      keyframes: {
        "player-nav-active": {
          from: { opacity: "0.65", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "player-nav-active": "player-nav-active 0.35s ease-out both",
      },
    }
  },
  plugins: []
};

export default config;
