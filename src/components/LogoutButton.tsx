"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadMatric, logout } from "@/lib/access";

/**
 * Compact logout control shown in the header next to the logo/profile, so it's
 * always one tap away. Renders nothing when no one is signed in (e.g. the login
 * or unlock pages), so those pages stay clean.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [matric, setMatric] = useState("");

  useEffect(() => {
    const sync = () => setMatric(loadMatric());
    sync();
    window.addEventListener("siwes-access-change", sync);
    return () => window.removeEventListener("siwes-access-change", sync);
  }, []);

  if (!matric) return null;

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <button
      onClick={signOut}
      title={`Signed in as ${matric} — log out`}
      aria-label="Log out"
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-margin/40 hover:bg-margin/10 hover:text-margin"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16h6a1.5 1.5 0 0 0 1.5-1.5V13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 10h8m0 0-2.5-2.5M17 10l-2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
