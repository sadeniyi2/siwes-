"use client";

import { useEffect, useState } from "react";
import { loadEntries, loadProfile } from "@/lib/store";
import { computeStreak, missingRecentWorkdays } from "@/lib/insights";
import { dayNameFromISO } from "@/lib/types";

const NUDGE_DISMISS_KEY = "siwes.nudge.dismissed.v1";

/**
 * Pro-only motivation: a streak counter for consecutive logged working days,
 * plus a gentle weekly reminder when recent working days have no entry yet.
 */
export default function ProInsights() {
  const [streak, setStreak] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [nudgeHidden, setNudgeHidden] = useState(true);

  useEffect(() => {
    const compute = () => {
      const profile = loadProfile();
      if (!profile) return;
      const entries = loadEntries();
      setStreak(computeStreak(entries, profile));
      setMissing(missingRecentWorkdays(entries, profile));
    };
    compute();
    // Re-show the nudge each day: dismissal is stored with today's date.
    const today = new Date().toISOString().slice(0, 10);
    setNudgeHidden(localStorage.getItem(NUDGE_DISMISS_KEY) === today);
    window.addEventListener("siwes-entry-saved", compute);
    return () => window.removeEventListener("siwes-entry-saved", compute);
  }, []);

  function dismissNudge() {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(NUDGE_DISMISS_KEY, today);
    setNudgeHidden(true);
  }

  const showNudge = missing.length > 0 && !nudgeHidden;
  if (streak === 0 && !showNudge) return null;

  const missingDays = missing
    .map((d) => dayNameFromISO(d))
    .slice(0, 3)
    .join(", ");

  return (
    <div className="mb-3 space-y-2">
      {streak > 0 && (
        <div className="animate-pop flex items-center gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5">
          <span className="text-lg" aria-hidden>
            🔥
          </span>
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">
              {streak}-day{streak >= 2 ? "" : ""} streak
            </strong>{" "}
            — {streak >= 3 ? "you're on a roll! " : ""}keep your logbook up to
            date every working day.
          </p>
        </div>
      )}
      {showNudge && (
        <div className="animate-rise flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-wash px-4 py-2.5">
          <span className="text-lg" aria-hidden>
            📌
          </span>
          <p className="flex-1 text-sm text-accent-deep">
            You haven&apos;t logged{" "}
            <strong>
              {missingDays}
              {missing.length > 3 ? " …" : ""}
            </strong>{" "}
            yet. Add {missing.length > 1 ? "them" : "it"} so your logbook stays
            complete.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(new Event("siwes-focus-composer"))
            }
            className="btn shrink-0 bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent-dark"
          >
            Add now
          </button>
          <button
            onClick={dismissNudge}
            className="shrink-0 text-xs font-medium text-accent-deep/70 hover:text-accent-deep"
            aria-label="Dismiss reminder"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
