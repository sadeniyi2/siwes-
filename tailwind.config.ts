import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Colours are driven by CSS variables (space-separated RGB channels) so
        // the whole app can switch between light and dark themes. The
        // `<alpha-value>` placeholder keeps Tailwind opacity modifiers working
        // (e.g. `border-ink/10`, `bg-ink/30`).
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--c-paper) / <alpha-value>)",
          sheet: "rgb(var(--c-paper-sheet) / <alpha-value>)",
          line: "rgb(var(--c-paper-line) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          dark: "rgb(var(--c-accent-dark) / <alpha-value>)",
          deep: "rgb(var(--c-accent-deep) / <alpha-value>)",
          soft: "rgb(var(--c-accent-soft) / <alpha-value>)",
          wash: "rgb(var(--c-accent-wash) / <alpha-value>)",
        },
        margin: "rgb(var(--c-margin) / <alpha-value>)",
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
        "nudge-x": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-3px)" },
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
        "nudge-x": "nudge-x 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
