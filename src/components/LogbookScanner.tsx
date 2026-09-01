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
  const [pendingEntries, setPendingEntries] = useState<LogbookEntryExtracted[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setPendingEntries([]);

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
          setPendingEntries(data.entries);
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

  const handleAcknowledge = () => {
    if (onEntriesExtracted && pendingEntries.length > 0) {
      onEntriesExtracted(pendingEntries);
      setPendingEntries([]);
      setPreview(null);
    }
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    setPendingEntries([]);
    setError(null);
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

      {/* Preview, Delete & Acknowledge Section */}
      {preview && (
        <div className="mt-4 pt-4 border-t border-ink/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink/15 shadow-card group">
              <img src={preview} alt="Logbook scan preview" className="h-full w-full object-cover" />
              {/* Delete Overlay Button */}
              <button
                onClick={handleRemovePhoto}
                title="Remove uploaded image"
                aria-label="Remove image"
                className="absolute inset-0 bg-ink/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
              >
                ✕ Delete
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">
                {pendingEntries.length > 0
                  ? `AI read ${pendingEntries.length} entries from this image.`
                  : "Processing image..."}
              </p>
              <p className="text-[11px] text-ink-faint mt-0.5">
                Review your scan before adding to your chart.
              </p>
              <button
                onClick={handleRemovePhoto}
                className="text-xs text-red-500 hover:text-red-700 font-medium underline mt-1 block md:hidden"
              >
                Remove photo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleRemovePhoto}
              className="hidden md:inline-flex px-3 py-2 text-xs font-medium text-ink-soft hover:text-red-600 rounded-xl border border-ink/15 hover:border-red-200 transition-all shrink-0"
            >
              🗑️ Delete Photo
            </button>

            {pendingEntries.length > 0 && (
              <button
                onClick={handleAcknowledge}
                className="flex-1 md:flex-initial px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lift shrink-0"
              >
                ✓ Acknowledge &amp; Populate Logbook
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
