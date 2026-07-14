"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEntry, loadEntries, loadProfile, saveEntry } from "@/lib/store";
import {
  LogEntry,
  Profile,
  WORK_DAYS,
  addDays,
  dayNameFromISO,
  formatLongDate,
  mondayOf,
  weekNumberOf,
  wordCount,
} from "@/lib/types";

export default function LogbookPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [weekStart, setWeekStart] = useState<string>("");
  const [section, setSection] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setEntries(loadEntries());
    const firstMonday = mondayOf(p.startDate);
    const today = new Date().toISOString().slice(0, 10);
    setWeekStart(today >= firstMonday ? mondayOf(today) : firstMonday);
    setSection(localStorage.getItem("siwes.section") ?? p.department ?? "");
  }, [router]);

  const byDate = useMemo(
    () => new Map(entries.map((e) => [e.date, e])),
    [entries],
  );

  if (!profile || !weekStart) return null;

  const firstMonday = mondayOf(profile.startDate);
  const weekDates = WORK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekNumber = weekNumberOf(weekStart, profile.startDate);
  const weekEntryCount = weekDates.filter((d) => byDate.has(d)).length;
  const totalWeeks = profile.durationWeeks ?? 24;

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
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          disabled={weekStart <= firstMonday}
          className="btn-ghost disabled:opacity-40"
        >
          ←
        </button>
        <div className="rounded-xl border border-ink/10 bg-paper-sheet px-4 py-2 text-center shadow-card">
          <p className="font-display text-sm font-semibold leading-tight">
            Week {weekNumber}
            {profile.durationWeeks ? ` of ${profile.durationWeeks}` : ""}
          </p>
          <p className="text-xs leading-tight text-ink-faint">
            {formatLongDate(weekDates[0])} – {formatLongDate(weekDates[5])}
          </p>
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="btn-ghost"
        >
          →
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="chip cursor-default whitespace-nowrap"
            title="Days filled this week / total saved entries"
          >
            ✍️ {weekEntryCount}/6 · {entries.length} total
          </span>
          <button onClick={() => window.print()} className="btn-primary px-3 py-2 sm:px-4">
            🖨 <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Week-dot pager: one dot per internship week, filled by progress */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 print:hidden">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const start = addDays(firstMonday, i * 7);
          const dates = WORK_DAYS.map((_, d) => addDays(start, d));
          const filled = dates.filter((d) => byDate.has(d)).length;
          const current = start === weekStart;
          return (
            <button
              key={start}
              onClick={() => setWeekStart(start)}
              title={`Week ${i + 1} · ${filled}/6 days logged`}
              aria-label={`Go to week ${i + 1}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                current
                  ? "w-6 bg-accent shadow-lift"
                  : filled === 6
                    ? "w-2.5 bg-emerald-500/80 hover:scale-125"
                    : filled > 0
                      ? "w-2.5 bg-accent/50 hover:scale-125"
                      : "w-2.5 bg-ink/15 hover:scale-125 hover:bg-ink/30"
              }`}
            />
          );
        })}
      </div>

      {/* The sheet — mirrors the physical SIWES logbook page.
          On narrow screens it scrolls horizontally so the table keeps its shape. */}
      <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 print:mx-0 print:overflow-visible print:px-0">
      <div
        key={weekStart}
        className="print-sheet sheet-paper sheet-margin sheet-seal animate-page-turn relative mx-auto min-w-[600px] max-w-3xl rounded-lg border border-ink/20 p-5 pl-12 shadow-sheet sm:min-w-0 sm:p-8 sm:pl-14"
      >
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="font-display text-lg font-bold tracking-wide">
            WEEKLY PROGRESS CHART
          </h1>
          <span className="font-book text-xs italic text-ink-faint">
            {profile.fullName}
            {profile.matricNumber ? ` · ${profile.matricNumber}` : ""}
          </span>
        </div>

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
              const offDay = day === "SAT" && !profile.worksSaturday;
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
                    className={`group relative min-h-[90px] border-2 border-ink p-3 align-top ${
                      offDay ? "bg-ink/[0.03]" : ""
                    }`}
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
                        <p className="animate-fade-in whitespace-pre-wrap font-book text-sm leading-relaxed">
                          {entry?.description ??
                            (offDay ? (
                              <span className="select-none text-xs italic text-ink-faint print:hidden">
                                Off day
                              </span>
                            ) : (
                              ""
                            ))}
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
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-ink-faint print:hidden">
        Entries are stored in this browser. Save entries from the Assistant
        tab, or click a box to write one by hand. Use Print for a clean copy to
        transfer into your physical logbook.
      </p>
    </div>
  );
}
