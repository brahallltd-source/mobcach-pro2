import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
      }
    }
  },
  plugins: []
};

export default config;
