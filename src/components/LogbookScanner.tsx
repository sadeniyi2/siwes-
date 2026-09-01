"use client";

import { useState } from "react";

interface LogbookEntry {
  date: string;
  description: string;
  hours: number;
}

interface LogbookScannerProps {
  onEntriesExtracted?: (entries: LogbookEntry[]) => void;
}

export default function LogbookScanner({ onEntriesExtracted }: LogbookScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    // Preview the uploaded image
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];

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

        setEntries(data.entries || []);
        if (onEntriesExtracted) {
          onEntriesExtracted(data.entries || []);
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            📷 Scan Physical Logbook Page
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Snap a photo of your handwritten entries to auto-fill your digital logbook.
          </p>
        </div>
      </div>

      {/* Upload Button */}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
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
        {loading && <span className="text-sm text-blue-600 animate-pulse">Reading handwriting...</span>}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg">
          {error}
        </div>
      )}

      {/* Preview Image */}
      {preview && (
        <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
          <img src={preview} alt="Logbook preview" className="w-full object-cover" />
        </div>
      )}

      {/* Extracted Results */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Extracted Entries ({entries.length})
          </h4>
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="p-3 text-sm bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-700 space-y-1"
              >
                <div className="flex justify-between font-medium text-gray-700 dark:text-gray-300">
                  <span>📅 {entry.date || "Unspecified Date"}</span>
                  {entry.hours && <span>⏱️ {entry.hours} hrs</span>}
                </div>
                <p className="text-gray-600 dark:text-gray-400">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
