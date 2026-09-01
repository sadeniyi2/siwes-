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
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = () => {
    setShowComingSoon(true);
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-sheet transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-bold text-ink">
            Auto-Fill Logbook from Photo
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Snap a handwritten physical logbook page to auto-populate your digital entries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-dark transition-all shadow-lift shrink-0"
        >
          <span>Take Photo / Choose File</span>
        </button>
      </div>

      {/* Clean Coming Soon Banner Without Emojis */}
      {showComingSoon && (
        <div className="mt-4 pt-4 border-t border-ink/10 flex items-center justify-between gap-4 animate-fade-in">
          <div>
            <p className="text-xs font-semibold text-accent">
              AI Scan &amp; Auto-Fill is Coming Soon!
            </p>
            <p className="text-[11px] text-ink-faint mt-0.5">
              We are fine-tuning our vision AI for handwritten logbooks. Stay tuned!
            </p>
          </div>

          <button
            onClick={() => setShowComingSoon(false)}
            className="px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink rounded-lg border border-ink/15 hover:border-ink/30 transition-all shrink-0"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
