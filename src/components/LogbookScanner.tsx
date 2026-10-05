"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image";
import { clientId, loadAccessToken, loadTier } from "@/lib/access";

export interface LogbookEntryExtracted {
  date: string;
  description: string;
  hours?: number;
}

interface LogbookScannerProps {
  onEntriesExtracted?: (entries: LogbookEntryExtracted[]) => void;
}

export default function LogbookScanner({ onEntriesExtracted }: LogbookScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Extracted entries awaiting the student's review/confirmation.
  const [draft, setDraft] = useState<LogbookEntryExtracted[] | null>(null);

  const isPro = loadTier() === "pro";

  function reset() {
    setPreview(null);
    setError(null);
    setDraft(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDraft(null);
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file, 1600, 0.85);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
      return;
    }
    setPreview(dataUrl);
    setBusy(true);
    try {
      const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": loadAccessToken(),
          "x-client-id": clientId(),
        },
        body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) {
        setError(j.error || "Couldn't scan that page. Please try again.");
        return;
      }
      const entries = (j.entries ?? []) as LogbookEntryExtracted[];
      if (entries.length === 0) {
        setError(
          "No entries were found. Make sure the whole chart is in frame, well-lit and straight-on.",
        );
        return;
      }
      // Show for review instead of saving straight away.
      setDraft(entries);
    } catch {
      setError("Couldn't reach the scanner. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(i: number, patch: Partial<LogbookEntryExtracted>) {
    setDraft((prev) =>
      prev ? prev.map((e, j) => (j === i ? { ...e, ...patch } : e)) : prev,
    );
  }
  function removeDraft(i: number) {
    setDraft((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
  }
  function confirm() {
    const clean = (draft ?? []).filter(
      (e) => e.date?.trim() && e.description?.trim(),
    );
    if (clean.length === 0) {
      setError("Nothing to add — every entry needs a date and a description.");
      return;
    }
    onEntriesExtracted?.(clean);
    reset();
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-sheet transition-all">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            Auto-Fill Logbook from Photo
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-dark">
              Pro
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Snap a handwritten physical logbook page and the AI fills in your digital
            entries — you review them before they&apos;re saved.
          </p>
        </div>

        {isPro ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-lift transition-all hover:bg-accent-dark disabled:opacity-60"
            >
              {busy ? "Reading your page…" : "Take Photo / Choose File"}
            </button>
          </>
        ) : (
          <a
            href="/unlock"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-wash px-4 py-2.5 text-xs font-semibold text-accent-dark transition-all hover:border-accent"
          >
            Upgrade to Pro to use
          </a>
        )}
      </div>

      {/* Progress / error (while no review list is shown) */}
      {isPro && !draft && (preview || error) && (
        <div className="mt-4 flex items-start gap-3 border-t border-ink/10 pt-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Logbook page"
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            {busy ? (
              <p className="flex items-center gap-2 text-xs font-medium text-accent">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Reading the handwriting…
              </p>
            ) : error ? (
              <p className="text-xs text-margin">{error}</p>
            ) : null}
            {!busy && (
              <button
                onClick={reset}
                className="mt-2 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink-soft transition-all hover:border-ink/30 hover:text-ink"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review & confirm */}
      {isPro && draft && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="mb-2 text-xs font-semibold text-ink">
            Found {draft.length} {draft.length === 1 ? "entry" : "entries"} — check and fix
            anything, then add them to your logbook.
          </p>
          {error && <p className="mb-2 text-xs text-margin">{error}</p>}
          <div className="space-y-2">
            {draft.map((e, i) => (
              <div
                key={i}
                className="rounded-xl border border-ink/10 bg-paper p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) => updateDraft(i, { date: ev.target.value })}
                    className="rounded-lg border border-ink/15 bg-paper-sheet px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => removeDraft(i)}
                    className="ml-auto text-xs font-medium text-margin hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={e.description}
                  onChange={(ev) => updateDraft(i, { description: ev.target.value })}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-ink/15 bg-paper-sheet px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirm}
              className="btn-primary px-4 py-2 text-xs"
            >
              Add {draft.length} to logbook
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-ink/15 px-4 py-2 text-xs font-medium text-ink-soft transition-all hover:border-ink/30 hover:text-ink"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {isPro && (
        <p className="mt-3 text-[11px] text-ink-faint">
          Tip: lay the page flat, fill the frame, avoid shadows. Always double-check the
          filled entries — handwriting isn&apos;t always read perfectly.
        </p>
      )}
    </div>
  );
}
