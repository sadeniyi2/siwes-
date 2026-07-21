"use client";

import { useRef, useState } from "react";
import { exportData, importData } from "@/lib/backup";

/**
 * Free-for-everyone backup & restore. Download a copy of all your logbook data,
 * and re-upload it to recover after clearing your browser or switching devices.
 */
export default function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onExport() {
    const entries = exportData();
    setMsg({
      ok: true,
      text:
        entries > 0
          ? `Backup downloaded — ${entries} logbook ${entries === 1 ? "entry" : "entries"} saved. Keep the file safe.`
          : "Backup downloaded. Keep the file somewhere safe.",
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const res = await importData(file);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Restore failed." });
      return;
    }
    setMsg({
      ok: true,
      text: `Restored ${res.entries} logbook ${res.entries === 1 ? "entry" : "entries"}. Reloading…`,
    });
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card">
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
        Backup &amp; restore
      </h2>
      <p className="mb-4 mt-1 text-sm leading-relaxed text-ink-soft">
        Your logbook lives only in this browser. Download a backup file to keep a
        copy — then you can restore it if you clear your history or move to
        another phone or laptop.{" "}
        <span className="font-medium text-ink">Free for everyone.</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onExport} type="button" className="btn-primary">
          ⭳ Download backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          type="button"
          className="btn-ghost"
        >
          ⭱ Restore from file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="hidden"
        />
      </div>
      {msg && (
        <p
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
            msg.ok
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border border-margin/30 bg-margin/10 text-margin"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
