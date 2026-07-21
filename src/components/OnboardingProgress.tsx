"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadApiKey, loadEntries, loadProfile } from "@/lib/store";
import { loadTier } from "@/lib/access";

const DISMISS_KEY = "siwes.onboard.dismissed.v1";

interface Step {
  key: string;
  label: string;
  done: boolean;
  onClick?: () => void;
}

/**
 * A friendly "getting started" progress bar shown to every user until they've
 * completed the four setup steps. Auto-hides once everything is done (or if the
 * user dismisses it). Steps read from localStorage and refresh on the app's
 * key/access change events.
 */
export default function OnboardingProgress() {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(true); // assume hidden until mounted

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener("siwes-key-change", refresh);
    window.addEventListener("siwes-access-change", refresh);
    window.addEventListener("siwes-entry-saved", refresh);
    return () => {
      window.removeEventListener("siwes-key-change", refresh);
      window.removeEventListener("siwes-access-change", refresh);
      window.removeEventListener("siwes-entry-saved", refresh);
    };
  }, []);

  // `tick` intentionally re-reads localStorage each render after an event.
  void tick;
  const steps: Step[] = [
    {
      key: "profile",
      label: "Your details",
      done: !!loadProfile(),
      onClick: () => router.push("/setup"),
    },
    {
      key: "access",
      label: "Unlock or trial",
      done: !!loadTier(),
      onClick: () => router.push("/unlock"),
    },
    {
      key: "key",
      label: "Add AI key",
      done: !!loadApiKey(),
      onClick: () => window.dispatchEvent(new Event("siwes-open-key")),
    },
    {
      key: "entry",
      label: "First entry",
      done: loadEntries().length > 0,
      onClick: () => window.dispatchEvent(new Event("siwes-focus-composer")),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (dismissed || doneCount === steps.length) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="animate-rise mb-3 rounded-2xl border border-ink/10 bg-paper-sheet p-3.5 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Getting started · {doneCount}/{steps.length}
        </p>
        <button
          onClick={dismiss}
          className="text-xs font-medium text-ink-faint hover:text-ink"
        >
          Hide
        </button>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={s.done ? undefined : s.onClick}
            disabled={s.done}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              s.done
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-ink/15 bg-paper text-ink-soft hover:border-accent/50 hover:text-accent-dark"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                s.done ? "bg-emerald-500 text-white" : "bg-ink/15 text-ink-soft"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
