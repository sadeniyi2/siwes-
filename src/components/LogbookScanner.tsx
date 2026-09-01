"use client";

import { useState } from "react";

export interface LogbookEntryExtracted {
  date: string;
  description: string;
  hours?: number;
}

interface LogbookScannerProps {
  onEntriesExtracted?: (entries: LogbookEntryExtracted[]) => void;
}

export default function LogbookScanner({ onEntriesExtracted }: LogbookScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const result = reader.result as string;
      setPreview(result);
      const base64Data = result.split(",")[1];

      try {
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to scan page.");
        }

        if (data.entries && data.entries.length > 0) {
          if (onEntriesExtracted) {
            onEntriesExtracted(data.entries);
          }
        } else {
          setError("No legible entries found in this picture. Please try a clearer photo.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-sheet transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
            📸 Auto-Fill Logbook from Photo
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Snap a handwritten physical logbook page to auto-populate your digital entries.
          </p>
        </div>

        <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-dark transition-all shadow-lift shrink-0">
          <span>{loading ? "Scanning with AI..." : "Take Photo / Choose File"}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="mt-3 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200/50">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3 relative h-28 w-28 overflow-hidden rounded-xl border border-ink/15 shadow-card">
          <img src={preview} alt="Logbook scan preview" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
