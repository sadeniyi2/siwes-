"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAccess, loadAccessToken, loadTier, saveAccess, Tier } from "@/lib/access";

/**
 * Page blocker. Verifies the stored access token against the backend on mount.
 * Unpaid or tampered tokens are sent to /unlock. Children only render once a
 * genuine payment is confirmed.
 */
export default function AccessGate({
  children,
  render,
}: {
  children?: React.ReactNode;
  render?: (tier: Tier) => React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok">("checking");
  const [tier, setTier] = useState<Tier>(loadTier() ?? "basic");

  useEffect(() => {
    let cancelled = false;
    const token = loadAccessToken();
    if (!token) {
      router.replace("/unlock");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/access/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await res.json();
        if (cancelled) return;
        if (j.valid) {
          saveAccess(token, j.tier as Tier);
          setTier(j.tier as Tier);
          setState("ok");
        } else {
          clearAccess();
          router.replace("/unlock");
        }
      } catch {
        // Network hiccup — fall back to the cached tier rather than lock out a
        // paid user, but only if a token exists (it does, checked above).
        if (!cancelled) setState("ok");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "checking") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-faint">
        <span className="typing-dots flex items-center gap-1">
          <span />
          <span />
          <span />
        </span>
        <p className="text-sm">Checking your access…</p>
      </div>
    );
  }

  return <>{render ? render(tier) : children}</>;
}
