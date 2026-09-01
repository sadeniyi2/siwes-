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
  const [preview, setPreview] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = () => {
      setPreview(reader.result as string);
      setShowComingSoon(true);
    };
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    setShowComingSoon(false);
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
          <span>Take Photo / Choose File</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Coming Soon & Preview Banner */}
      {showComingSoon && (
        <div className="mt-4 pt-4 border-t border-ink/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {preview && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink/15 shadow-card group">
                <img src={preview} alt="Logbook scan preview" className="h-full w-full object-cover" />
                <button
                  onClick={handleRemovePhoto}
                  title="Remove uploaded image"
                  aria-label="Remove image"
                  className="absolute inset-0 bg-ink/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                >
                  ✕ Delete
                </button>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-accent flex items-center gap-1">
                🚀 AI Scan & Auto-Fill is Coming Soon!
              </p>
              <p className="text-[11px] text-ink-faint mt-0.5">
                We are fine-tuning our vision AI for handwritten logbooks. Stay tuned!
              </p>
            </div>
          </div>

          <button
            onClick={handleRemovePhoto}
            className="px-3 py-2 text-xs font-medium text-ink-soft hover:text-red-600 rounded-xl border border-ink/15 hover:border-red-200 transition-all shrink-0 w-full md:w-auto text-center"
          >
            🗑️ Clear Photo
          </button>
        </div>
      )}
    </div>
  );
}
