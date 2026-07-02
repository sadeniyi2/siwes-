"use client";

import { useEffect } from "react";

export default function Toast({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center print:hidden">
      <div className="animate-toast-in flex items-center gap-2 rounded-full border border-ink/10 bg-ink px-5 py-2.5 text-sm font-medium text-paper-sheet shadow-sheet">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">
          ✓
        </span>
        {message}
      </div>
    </div>
  );
}
