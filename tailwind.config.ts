import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1c2434",
          soft: "#46506b",
          faint: "#8b93a9",
        },
        paper: {
          DEFAULT: "#f4f1ea",
          sheet: "#fdfcf7",
          line: "#e5e0d3",
        },
        accent: {
          DEFAULT: "#2b4eda",
          dark: "#1e3aad",
          deep: "#16296e",
          soft: "#e6ebfc",
          wash: "#f2f5fe",
        },
        margin: "#e0656b",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        book: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        sheet: "0 1px 2px rgba(28,36,52,0.06), 0 12px 32px -12px rgba(28,36,52,0.18)",
        lift: "0 2px 8px -2px rgba(43,78,218,0.35)",
        card: "0 1px 3px rgba(28,36,52,0.08)",
        glow: "0 0 0 4px rgba(43,78,218,0.12), 0 8px 24px -8px rgba(43,78,218,0.45)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        blink: {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.35" },
          "40%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        stamp: {
          "0%": { transform: "scale(1.4) rotate(-8deg)", opacity: "0" },
          "100%": { transform: "scale(1) rotate(-3deg)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "page-turn": {
          "0%": { opacity: "0", transform: "perspective(1200px) rotateX(2.5deg) translateY(14px)" },
          "100%": { opacity: "1", transform: "perspective(1200px) rotateX(0deg) translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "ink-fill": {
          from: { width: "0%" },
        },
      },
      animation: {
        rise: "rise 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        pop: "pop 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "fade-in": "fade-in 0.4s ease both",
        stamp: "stamp 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 3.5s linear infinite",
        "page-turn": "page-turn 0.5s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "toast-in": "toast-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "ink-fill": "ink-fill 0.8s cubic-bezier(0.21, 1.02, 0.73, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
