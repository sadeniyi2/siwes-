"use client";

import { useEffect, useRef, useState } from "react";

export type Tone = "formal" | "plain" | "detailed";
export type Length = "short" | "standard" | "long";
export interface Prefs {
  tone: Tone;
  length: Length;
}

export const DEFAULT_PREFS: Prefs = { tone: "formal", length: "standard" };
const PREFS_KEY = "siwes.writeprefs.v1";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Prefs) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** A directive to append to the model's memory, or "" when everything is default. */
export function prefsDirective(p: Prefs): string {
  if (p.tone === DEFAULT_PREFS.tone && p.length === DEFAULT_PREFS.length) return "";
  const tone =
    p.tone === "plain"
      ? "plain, simple English that's easy to read"
      : p.tone === "detailed"
        ? "detailed and descriptive, while staying professional"
        : "formal and professional";
  const length =
    p.length === "short"
      ? "concise — aim for about 40 words per logbook entry"
      : p.length === "long"
        ? "fuller — use closer to the 70-word upper limit per entry"
        : "the standard 35–70 words per entry";
  return `The student prefers their logbook entries and summaries written in a ${tone} tone, and ${length}.`;
}

const TONES: { id: Tone; label: string }[] = [
  { id: "formal", label: "Formal" },
  { id: "plain", label: "Plain" },
  { id: "detailed", label: "Detailed" },
];
const LENGTHS: { id: Length; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "standard", label: "Standard" },
  { id: "long", label: "Long" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-ink/5 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
            value === o.id
              ? "bg-accent text-white shadow-lift"
              : "text-ink-soft hover:text-accent-dark"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Pro-only writing tone & length presets. A chip opens a small popover; the
 * choice is persisted and injected into the model's memory on each request.
 */
export default function WritingPrefs({
  value,
  onChange,
}: {
  value: Prefs;
  onChange: (p: Prefs) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const changed =
    value.tone !== DEFAULT_PREFS.tone || value.length !== DEFAULT_PREFS.length;

  function update(patch: Partial<Prefs>) {
    const next = { ...value, ...patch };
    onChange(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choose the writing tone and length"
        className={`chip shrink-0 ${
          changed ? "border-accent/50 text-accent-dark" : ""
        }`}
      >
        🎚 Style
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-ink/10 bg-paper-sheet p-3 shadow-sheet">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Tone
          </p>
          <Segmented
            options={TONES}
            value={value.tone}
            onChange={(tone) => update({ tone })}
          />
          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Length
          </p>
          <Segmented
            options={LENGTHS}
            value={value.length}
            onChange={(length) => update({ length })}
          />
          <button
            onClick={() => update(DEFAULT_PREFS)}
            className="mt-3 w-full text-center text-xs font-medium text-ink-faint hover:text-ink"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
