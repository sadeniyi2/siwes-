"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "siwes.theme";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Light / dark theme switch. The initial theme is set before paint by the
 * inline script in layout.tsx (no flash); this button just reads the current
 * value and flips it. Preference persists in localStorage.
 */
export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) ||
      "light";
    setTheme(current);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-center rounded-full transition-colors hover:bg-accent-soft hover:text-accent-dark ${className}`}
    >
      {/* Contrast disc: half-filled circle rotates with the active theme.
          Markup stays stable until mounted to avoid hydration mismatch. */}
      <svg
        viewBox="0 0 20 20"
        width="17"
        height="17"
        aria-hidden="true"
        suppressHydrationWarning
        className="transition-transform duration-300"
        style={{ transform: ready && isDark ? "rotate(180deg)" : "none" }}
      >
        <circle
          cx="10"
          cy="10"
          r="7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M10 2.5a7.5 7.5 0 0 0 0 15z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
