"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadApiKey, loadProfile, saveApiKey, saveProfile } from "@/lib/store";
import { Profile, dayNameFromISO, formatLongDate } from "@/lib/types";

const EMPTY: Profile = {
  fullName: "",
  matricNumber: "",
  institution: "",
  course: "",
  firmName: "",
  firmAddress: "",
  department: "",
  supervisorName: "",
  startDate: "",
  durationWeeks: 24,
  worksSaturday: true,
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
        {required && <span className="text-margin"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow";

export default function SetupPage() {
  const router = useRouter();
  const [p, setP] = useState<Profile>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setP({ ...EMPTY, ...existing });
      setIsEdit(true);
    }
    setApiKey(loadApiKey());
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.fullName.trim() || !p.firmName.trim() || !p.startDate) {
      setError("Please fill your name, your firm, and your start date.");
      return;
    }
    if (dayNameFromISO(p.startDate) === "Sunday") {
      setError("Your start date falls on a Sunday — please double-check it.");
      return;
    }
    saveProfile({
      ...p,
      fullName: p.fullName.trim(),
      firmName: p.firmName.trim(),
      durationWeeks: p.durationWeeks ? Number(p.durationWeeks) : undefined,
    });
    if (apiKey.trim()) saveApiKey(apiKey);
    router.push("/");
  }

  return (
    <div className="stagger mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <p className="animate-float mx-auto mb-3 w-fit text-4xl" aria-hidden>
          🎓
        </p>
        <h1 className="mb-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {isEdit ? "Your internship details" : "Welcome! Let's set up your logbook."}
        </h1>
        <p className="text-sm text-ink-soft">
          These details personalize your logbook, summaries, and final SIWES
          report. Only the starred fields are required — you can edit
          everything later.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="sheet-paper rounded-2xl border border-ink/15 p-6 shadow-sheet sm:p-8"
      >
        <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
          About you
        </h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <input
              className={inputCls}
              value={p.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Adeola Sadeniyi"
              autoFocus
            />
          </Field>
          <Field label="Matric / Reg number">
            <input
              className={inputCls}
              value={p.matricNumber}
              onChange={(e) => set("matricNumber", e.target.value)}
              placeholder="e.g. 20/52HA093"
            />
          </Field>
          <Field label="Institution">
            <input
              className={inputCls}
              value={p.institution}
              onChange={(e) => set("institution", e.target.value)}
              placeholder="e.g. University of Ilorin"
            />
          </Field>
          <Field label="Course of study">
            <input
              className={inputCls}
              value={p.course}
              onChange={(e) => set("course", e.target.value)}
              placeholder="e.g. Computer Science"
            />
          </Field>
        </div>

        <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
          Your placement
        </h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Field label="Firm / Organization" required>
            <input
              className={inputCls}
              value={p.firmName}
              onChange={(e) => set("firmName", e.target.value)}
              placeholder="e.g. TechNova Solutions Ltd"
            />
          </Field>
          <Field label="Firm address">
            <input
              className={inputCls}
              value={p.firmAddress}
              onChange={(e) => set("firmAddress", e.target.value)}
              placeholder="e.g. 12 Adeyemi Street, Ikeja, Lagos"
            />
          </Field>
          <Field label="Department / Section attached">
            <input
              className={inputCls}
              value={p.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="e.g. Software Development"
            />
          </Field>
          <Field label="Industry supervisor">
            <input
              className={inputCls}
              value={p.supervisorName}
              onChange={(e) => set("supervisorName", e.target.value)}
              placeholder="e.g. Mr. J. Okafor"
            />
          </Field>
        </div>

        <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
          Your schedule
        </h2>
        <div className="mb-2 grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required>
            <input
              type="date"
              className={inputCls}
              value={p.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
          <Field label="Duration (weeks)">
            <input
              type="number"
              min={1}
              max={52}
              className={inputCls}
              value={p.durationWeeks ?? ""}
              onChange={(e) =>
                set(
                  "durationWeeks",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="e.g. 24"
            />
          </Field>
        </div>
        {p.startDate && dayNameFromISO(p.startDate) !== "Sunday" && (
          <p className="animate-fade-in mb-3 text-xs text-accent-dark">
            ✓ Starting {dayNameFromISO(p.startDate)}, {formatLongDate(p.startDate)}
          </p>
        )}
        <label className="mb-6 flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={p.worksSaturday}
            onChange={(e) => set("worksSaturday", e.target.checked)}
            className="h-4 w-4 accent-[#2b4eda]"
          />
          I also work on Saturdays
        </label>

        <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
          Your AI key
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-ink-soft">
          This app runs on your own free Google Gemini key, so your usage is
          yours alone and stays private to this browser. Get one free (no card)
          at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            aistudio.google.com/apikey
          </a>
          . You can also add it later.{" "}
          <a
            href="/SIWES-Logbook-Assistant-Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            Download the step-by-step guide (PDF)
          </a>
          .
        </p>
        <div className="mb-6">
          <Field label="Gemini API key">
            <input
              type="password"
              className={inputCls}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza…"
            />
          </Field>
        </div>

        {error && (
          <p className="animate-rise mb-4 rounded-xl border border-margin/30 bg-margin/10 px-4 py-2.5 text-sm text-margin">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            {isEdit ? "Save changes" : "Start my logbook →"}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-ghost"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Your details are stored only in this browser — nothing is uploaded
        anywhere except to generate your entries.
      </p>
    </div>
  );
}
