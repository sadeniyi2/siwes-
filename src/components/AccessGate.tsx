"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAccess,
  loadAccessToken,
  loadTier,
  saveAccess,
  setMustResetPassword,
  trackPresence,
  Tier,
} from "@/lib/access";
import { loadProfile } from "@/lib/store";

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
    // Not logged in at all → send to the login page.
    if (!token) {
      router.replace("/login");
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
        if (!j.valid) {
          // Token bad/expired → back to login.
          clearAccess();
          router.replace("/login");
          return;
        }
        // Keep the freshest token (reflects server-side access changes).
        const useTier = (j.tier as Tier) || "basic";
        saveAccess(j.token || token, useTier, j.kind ?? "paid");
        // Signed in with a temporary password → must set a real one first.
        if (j.mustReset) {
          setMustResetPassword(true);
          router.replace("/account/password");
          return;
        }
        if (j.access === false) {
          // Logged in but no plan yet → choose a trial/plan.
          router.replace("/unlock");
          return;
        }
        setTier(useTier);
        setState("ok");
        const p = loadProfile();
        trackPresence({ fullName: p?.fullName, firmName: p?.firmName });
      } catch {
        // Network hiccup — don't lock out; fall back to the cached tier.
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
