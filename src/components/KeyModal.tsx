"use client";

import { useEffect, useState } from "react";
import { clearApiKey, loadApiKey, saveApiKey } from "@/lib/store";

export default function KeyModal({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  /** Why the modal opened: first-time, invalid key, or exhausted quota. */
  reason: "setup" | "invalid_key" | "quota";
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [existing, setExisting] = useState("");

  useEffect(() => {
    if (open) {
      const k = loadApiKey();
      setExisting(k);
      setValue("");
    }
  }, [open]);

  if (!open) return null;

  const heading =
    reason === "quota"
      ? "Your key's free quota is used up"
      : reason === "invalid_key"
        ? "That key didn't work"
        : "Connect your free Gemini key";

  const blurb =
    reason === "quota"
      ? "Google's free tier resets each day — you can wait, or paste a different key to keep going now. Your logbook, profile, and history stay exactly as they are."
      : reason === "invalid_key"
        ? "The key was rejected. Double-check you copied the whole key, then paste it again."
        : "This app runs on your own free Google Gemini key, so your usage is yours alone. It's stored only in this browser and never sent anywhere except Google.";

  function save() {
    const v = value.trim();
    if (!v) return;
    saveApiKey(v);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="animate-pop relative w-full max-w-md rounded-2xl border border-ink/10 bg-paper-sheet p-6 shadow-sheet">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-lg">
              🔑
            </span>
            <h2 className="font-display text-lg font-semibold leading-tight">
              {heading}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-ink-soft">{blurb}</p>

        <ol className="mb-4 space-y-1.5 rounded-xl bg-accent-wash px-4 py-3 text-xs text-ink-soft">
          <li>
            1. Open{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              aistudio.google.com/apikey
            </a>
          </li>
          <li>2. Click “Create API key” (it&apos;s free, no card needed)</li>
          <li>3. Copy the key and paste it below</li>
        </ol>

        <a
          href="/SIWES-Logbook-Assistant-Guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 block text-center text-xs font-medium text-accent underline underline-offset-2"
        >
          📄 New to this? Download the simple picture guide (PDF)
        </a>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Gemini API key
        </label>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={existing ? "•••••••••• (replace current key)" : "AIza…"}
          className="mb-4 w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow"
        />

        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!value.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {existing ? "Update key" : "Save key & continue"}
          </button>
          {existing && (
            <button
              onClick={() => {
                clearApiKey();
                setExisting("");
              }}
              className="btn-ghost"
              title="Remove the stored key from this browser"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
