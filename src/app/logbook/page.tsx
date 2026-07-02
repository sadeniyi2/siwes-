"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteEntry, loadEntries, saveEntry } from "@/lib/store";
import {
  LogEntry,
  SIWES_START_DATE,
  WORK_DAYS,
  addDays,
  dayNameFromISO,
  formatLongDate,
  mondayOf,
  wordCount,
} from "@/lib/types";

export default function LogbookPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [weekStart, setWeekStart] = useState<string>(SIWES_START_DATE);
  const [section, setSection] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEntries(loadEntries());
    const today = new Date().toISOString().slice(0, 10);
    const start =
      today >= SIWES_START_DATE ? mondayOf(today) : SIWES_START_DATE;
    setWeekStart(start);
    setSection(localStorage.getItem("siwes.section") ?? "");
  }, []);

  const byDate = useMemo(
    () => new Map(entries.map((e) => [e.date, e])),
    [entries],
  );

  const weekDates = WORK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekNumber =
    Math.round(
      (new Date(weekStart + "T12:00:00Z").getTime() -
        new Date(SIWES_START_DATE + "T12:00:00Z").getTime()) /
        (7 * 24 * 3600 * 1000),
    ) + 1;
  const weekEntryCount = weekDates.filter((d) => byDate.has(d)).length;

  function startEdit(date: string) {
    setEditingDate(date);
    setDraft(byDate.get(date)?.description ?? "");
  }

  function commitEdit(date: string) {
    const text = draft.trim();
    if (text) {
      saveEntry({
        date,
        day: dayNameFromISO(date),
        description: text,
        rawNotes: byDate.get(date)?.rawNotes,
        savedAt: new Date().toISOString(),
      });
    } else if (byDate.has(date)) {
      if (!confirm("Remove this entry?")) {
        setEditingDate(null);
        return;
      }
      deleteEntry(date);
    }
    setEntries(loadEntries());
    setEditingDate(null);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          disabled={weekStart <= SIWES_START_DATE}
          className="btn-ghost disabled:opacity-40"
        >
          ← Previous
        </button>
        <div className="rounded-xl border border-ink/10 bg-paper-sheet px-4 py-2 text-center shadow-card">
          <p className="font-display text-sm font-semibold leading-tight">
            Week {weekNumber}
          </p>
          <p className="text-xs leading-tight text-ink-faint">
            {formatLongDate(weekDates[0])} – {formatLongDate(weekDates[5])}
          </p>
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="btn-ghost"
        >
          Next →
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="chip cursor-default"
            title="Days filled this week / total saved entries"
          >
            ✍️ {weekEntryCount}/6 this week · {entries.length} total
          </span>
          <button onClick={() => window.print()} className="btn-primary px-4 py-2">
            🖨 Print
          </button>
        </div>
      </div>

      {/* The sheet — mirrors the physical SIWES logbook page */}
      <div className="print-sheet sheet-paper sheet-margin mx-auto max-w-3xl rounded-lg border border-ink/20 p-8 pl-14 shadow-sheet">
        <h1 className="mb-6 font-display text-lg font-bold tracking-wide">
          WEEKLY PROGRESS CHART
        </h1>

        <div className="mb-8 text-center">
          <label className="font-book text-sm tracking-wide">
            SECTION ATTACHED{" "}
            <input
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                localStorage.setItem("siwes.section", e.target.value);
              }}
              placeholder="................................."
              className="w-64 border-b border-dotted border-ink/60 bg-transparent px-1 text-center font-book text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <table className="w-full border-collapse border-2 border-ink">
          <thead>
            <tr>
              <th className="w-28 border-2 border-ink p-3 text-left align-top font-book text-sm font-semibold">
                DAYS
                <br />
                DATE
              </th>
              <th className="border-2 border-ink p-3 text-center font-book text-sm font-semibold">
                DESCRIPTION OF WORKDONE
              </th>
            </tr>
          </thead>
          <tbody>
            {WORK_DAYS.map((day, i) => {
              const date = weekDates[i];
              const entry = byDate.get(date);
              const editing = editingDate === date;
              return (
                <tr key={day}>
                  <td className="border-2 border-ink p-3 align-top font-book text-sm">
                    <span className="font-semibold">{day}.</span>
                    <br />
                    <span className="text-xs text-ink-soft">
                      {new Date(date + "T12:00:00Z").toLocaleDateString(
                        "en-GB",
                        { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" },
                      )}
                    </span>
                  </td>
                  <td
                    className="group relative min-h-[90px] border-2 border-ink p-3 align-top"
                    style={{ height: "90px" }}
                  >
                    {editing ? (
                      <div className="print:hidden">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={4}
                          autoFocus
                          className="w-full rounded-lg border border-accent bg-white p-2 font-book text-sm outline-none ring-4 ring-accent-soft"
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() => commitEdit(date)}
                            className="btn bg-accent px-3 py-1 text-xs text-white hover:bg-accent-dark"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDate(null)}
                            className="btn border border-ink/20 bg-white px-3 py-1 text-xs text-ink-soft"
                          >
                            Cancel
                          </button>
                          <span
                            className={`text-xs ${
                              wordCount(draft) >= 35 && wordCount(draft) <= 70
                                ? "text-emerald-600"
                                : "text-ink-faint"
                            }`}
                          >
                            {wordCount(draft)} words
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap font-book text-sm leading-relaxed">
                          {entry?.description ?? ""}
                        </p>
                        <button
                          onClick={() => startEdit(date)}
                          className="absolute right-2 top-2 hidden rounded-md border border-ink/15 bg-white px-2 py-0.5 text-xs text-ink-soft shadow-card transition-colors hover:border-accent/50 hover:text-accent-dark group-hover:block print:!hidden"
                        >
                          {entry ? "Edit" : "Add"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-ink-faint print:hidden">
        Entries are stored in this browser. Save entries from the Assistant
        tab, or click a box to write one by hand. Use Print for a clean copy to
        transfer into your physical logbook.
      </p>
    </div>
  );
}
