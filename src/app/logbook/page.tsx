"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AccessGate from "@/components/AccessGate";
import Tour, { TourStep } from "@/components/Tour";
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

const LOGBOOK_TOUR: TourStep[] = [
  {
    selector: '[data-tour="sheet"]',
    title: "Your Weekly Progress Chart",
    body: "This mirrors your real SIWES logbook. Entries you save from the assistant show up here. Hover any box and tap Add/Edit to write one by hand.",
  },
  {
    selector: '[data-tour="weeks"]',
    title: "Jump between weeks",
    body: "Each dot is one week of your placement. Green means all days are filled. Tap a dot (or the arrows) to open that week.",
  },
  {
    selector: '[data-tour="print"]',
    title: "Print or download",
    body: "Print one week, every week, or choose weeks — then pick a printer, or “Save as PDF” to download your logbook.",
  },
];

export default function LogbookPage() {
  return <AccessGate>{<LogbookInner />}</AccessGate>;
}

function LogbookInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [weekStart, setWeekStart] = useState<string>("");
  const [section, setSection] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showPrint, setShowPrint] = useState(false);
  const [printSheets, setPrintSheets] = useState<string[] | null>(null);

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

  // When sheets are queued for printing, render them, open the print dialog,
  // then clear so the normal view returns.
  useEffect(() => {
    if (!printSheets) return;
    const done = () => setPrintSheets(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printSheets]);

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
      <div className={printSheets ? "print:hidden" : ""}>
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
          <button data-tour="print" onClick={() => setShowPrint(true)} className="btn-primary px-3 py-2 sm:px-4">
            🖨 <span className="hidden sm:inline">Print / Download</span>
          </button>
        </div>
      </div>

      {/* Week-dot pager: one dot per internship week, filled by progress */}
      <div data-tour="weeks" className="mb-4 flex flex-wrap items-center justify-center gap-1.5 print:hidden">
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
        data-tour="sheet"
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
        tab, or click a box to write one by hand. Use Print / Download for a
        clean copy to transfer into your physical logbook.
      </p>
      </div>

      {/* Print-only container: renders every selected week, one per page */}
      {printSheets && (
        <div className="hidden print:block">
          {printSheets.map((ws) => (
            <PrintSheet
              key={ws}
              profile={profile}
              weekStart={ws}
              byDate={byDate}
              section={section}
            />
          ))}
        </div>
      )}

      {showPrint && (
        <PrintDialog
          profile={profile}
          firstMonday={firstMonday}
          totalWeeks={totalWeeks}
          currentWeekStart={weekStart}
          byDate={byDate}
          onClose={() => setShowPrint(false)}
          onPrint={(weeks) => {
            setShowPrint(false);
            setPrintSheets(weeks);
          }}
        />
      )}

      <Tour steps={LOGBOOK_TOUR} storageKey="siwes.tour.logbook.v1" />
    </div>
  );
}

/** Static, non-interactive sheet used only for printing. */
function PrintSheet({
  profile,
  weekStart,
  byDate,
  section,
}: {
  profile: Profile;
  weekStart: string;
  byDate: Map<string, LogEntry>;
  section: string;
}) {
  const dates = WORK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekNo = weekNumberOf(weekStart, profile.startDate);
  return (
    <div className="print-page print-sheet sheet-paper sheet-margin sheet-seal relative mx-auto max-w-3xl rounded-lg border border-ink/20 p-8 pl-14">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-lg font-bold tracking-wide">
          WEEKLY PROGRESS CHART
        </h1>
        <span className="font-book text-xs italic text-ink-faint">
          Week {weekNo}
          {profile.durationWeeks ? ` of ${profile.durationWeeks}` : ""} ·{" "}
          {profile.fullName}
          {profile.matricNumber ? ` · ${profile.matricNumber}` : ""}
        </span>
      </div>
      <div className="mb-8 text-center font-book text-sm tracking-wide">
        SECTION ATTACHED{" "}
        <span className="border-b border-dotted border-ink/60 px-8">
          {section || "        "}
        </span>
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
            const date = dates[i];
            const entry = byDate.get(date);
            const offDay = day === "SAT" && !profile.worksSaturday;
            return (
              <tr key={day}>
                <td className="border-2 border-ink p-3 align-top font-book text-sm">
                  <span className="font-semibold">{day}.</span>
                  <br />
                  <span className="text-xs text-ink-soft">
                    {new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      timeZone: "UTC",
                    })}
                  </span>
                </td>
                <td
                  className="border-2 border-ink p-3 align-top"
                  style={{ height: "90px" }}
                >
                  <p className="whitespace-pre-wrap font-book text-sm leading-relaxed">
                    {entry?.description ?? ""}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type PrintMode = "current" | "entries" | "all" | "choose";

function PrintDialog({
  profile,
  firstMonday,
  totalWeeks,
  currentWeekStart,
  byDate,
  onClose,
  onPrint,
}: {
  profile: Profile;
  firstMonday: string;
  totalWeeks: number;
  currentWeekStart: string;
  byDate: Map<string, LogEntry>;
  onClose: () => void;
  onPrint: (weekStarts: string[]) => void;
}) {
  const [mode, setMode] = useState<PrintMode>("entries");

  // Build the list of weeks with metadata.
  const weeks = useMemo(() => {
    const list: { num: number; start: string; filled: number }[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const start = addDays(firstMonday, i * 7);
      const filled = WORK_DAYS.filter((_, d) => byDate.has(addDays(start, d))).length;
      list.push({ num: i + 1, start, filled });
    }
    return list;
  }, [firstMonday, totalWeeks, byDate]);

  const weeksWithEntries = weeks.filter((w) => w.filled > 0);
  const [chosen, setChosen] = useState<Set<number>>(
    () => new Set(weeksWithEntries.map((w) => w.num)),
  );

  function toggle(num: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function confirm() {
    let starts: string[] = [];
    if (mode === "current") starts = [currentWeekStart];
    else if (mode === "entries") starts = weeksWithEntries.map((w) => w.start);
    else if (mode === "all") starts = weeks.map((w) => w.start);
    else
      starts = weeks
        .filter((w) => chosen.has(w.num))
        .map((w) => w.start);
    if (starts.length === 0) return;
    onPrint(starts);
  }

  const count =
    mode === "current"
      ? 1
      : mode === "entries"
        ? weeksWithEntries.length
        : mode === "all"
          ? weeks.length
          : chosen.size;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center print:hidden">
      <div
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="animate-pop relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-ink/10 bg-paper-sheet p-6 shadow-sheet">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Print / Download</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-ink-soft">
          Choose what to print. In the print window, pick your printer — or
          &ldquo;Save as PDF&rdquo; to download.
        </p>

        <div className="space-y-2 overflow-y-auto">
          {(
            [
              { id: "current", label: "This week only" },
              {
                id: "entries",
                label: `All weeks with entries (${weeksWithEntries.length})`,
              },
              { id: "all", label: `Every week (1–${totalWeeks})` },
              { id: "choose", label: "Choose weeks…" },
            ] as { id: PrintMode; label: string }[]
          ).map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                mode === opt.id
                  ? "border-accent bg-accent-wash text-accent-deep"
                  : "border-ink/15 hover:border-accent/40"
              }`}
            >
              <input
                type="radio"
                name="printmode"
                checked={mode === opt.id}
                onChange={() => setMode(opt.id)}
                className="h-4 w-4 accent-[#2b4eda]"
              />
              {opt.label}
            </label>
          ))}

          {mode === "choose" && (
            <div className="mt-1 rounded-xl border border-ink/15 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
                <button
                  onClick={() => setChosen(new Set(weeks.map((w) => w.num)))}
                  className="font-medium text-accent hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setChosen(new Set())}
                  className="font-medium text-ink-faint hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
                {weeks.map((w) => (
                  <button
                    key={w.num}
                    onClick={() => toggle(w.num)}
                    title={`Week ${w.num} · ${w.filled}/6 days`}
                    className={`relative rounded-lg border py-1.5 text-xs font-medium transition-all ${
                      chosen.has(w.num)
                        ? "border-accent bg-accent text-white"
                        : w.filled > 0
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-ink/15 text-ink-faint"
                    }`}
                  >
                    {w.num}
                    {w.filled > 0 && (
                      <span className="absolute right-0.5 top-0.5 text-[8px]">
                        {chosen.has(w.num) ? "✓" : "•"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                Green = has entries · tap to include/exclude.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={confirm}
            disabled={count === 0}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            🖨 Print {count} {count === 1 ? "week" : "weeks"}
          </button>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
