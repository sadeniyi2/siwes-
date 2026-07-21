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
      {/* Keep markup stable until mounted to avoid hydration mismatch */}
      <span className="text-base leading-none" suppressHydrationWarning>
        {ready ? (isDark ? "☀️" : "🌙") : "🌙"}
      </span>
    </button>
  );
}
