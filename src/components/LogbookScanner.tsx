"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image";
import { clientId, loadAccessToken } from "@/lib/access";

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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    let dataUrl: string;
    try {
      // Larger + higher quality than usual so handwriting stays legible.
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
      onEntriesExtracted?.(entries);
      setPreview(null); // done — clear for the next page
    } catch {
      setError("Couldn't reach the scanner. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-sheet transition-all">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-base font-bold text-ink">
            Auto-Fill Logbook from Photo
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Snap a handwritten physical logbook page and the AI fills in your digital
            entries for that week.
          </p>
        </div>

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
      </div>

      {(preview || error) && (
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
                Reading the handwriting and filling your entries…
              </p>
            ) : error ? (
              <p className="text-xs text-margin">{error}</p>
            ) : null}
            {!busy && (
              <button
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                className="mt-2 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink-soft transition-all hover:border-ink/30 hover:text-ink"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-faint">
        Tip: lay the page flat, fill the frame, avoid shadows. Always double-check the
        filled entries — handwriting isn&apos;t always perfect.
      </p>
    </div>
  );
}
