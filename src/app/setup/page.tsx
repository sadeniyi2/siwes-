"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile } from "@/lib/store";
import { loadAccessToken, loadTier, saveAccess } from "@/lib/access";
import { Profile, dayNameFromISO, formatLongDate } from "@/lib/types";
import BackupCard from "@/components/BackupCard";
import { pushCloudBackup } from "@/lib/cloud";

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
  const [code, setCode] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Must be signed in to set up a profile.
    if (!loadAccessToken()) {
      router.replace("/login");
      return;
    }
    const existing = loadProfile();
    if (existing) {
      setP({ ...EMPTY, ...existing });
      setIsEdit(true);
    }
  }, [router]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.fullName.trim() || !p.firmName.trim() || !p.startDate) {
      setError("Please fill your name, your firm, and your start date.");
      return;
    }
    if (dayNameFromISO(p.startDate) === "Sunday") {
      setError("Your start date falls on a Sunday — please double-check it.");
      return;
    }
    const fullName = p.fullName.trim();
    saveProfile({
      ...p,
      fullName,
      firmName: p.firmName.trim(),
      durationWeeks: p.durationWeeks ? Number(p.durationWeeks) : undefined,
    });
    pushCloudBackup();

    // An access code grants (or upgrades to) free access immediately — this is
    // also how a returning user redeems a code by updating their profile.
    if (code.trim()) {
      setChecking(true);
      try {
        const res = await fetch("/api/access/referral", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-token": loadAccessToken(),
          },
          body: JSON.stringify({ code, name: fullName }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ok) {
          saveAccess(j.token, j.tier, "free");
          router.push("/");
          return;
        }
        setChecking(false);
        setError(j.message || "That code isn't valid.");
        return;
      } catch {
        setChecking(false);
        setError("Couldn't check that code right now. Please try again.");
        return;
      }
    }

    // Already unlocked (paid or free) → straight into the app.
    if (loadTier()) {
      router.push("/");
      return;
    }

    // Free-access names skip payment entirely and go straight in.
    setChecking(true);
    try {
      const res = await fetch("/api/access/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        saveAccess(j.token, j.tier, "free");
        router.push("/");
        return;
      }
      // Server not configured yet — tell the user instead of silently paywalling.
      if (res.status === 500) {
        setChecking(false);
        setError(
          j.message ||
            "The app isn't fully set up yet (missing ACCESS_TOKEN_SECRET). Please contact the admin.",
        );
        return;
      }
      // 403 = not on the free list → continue to the plans page below.
    } catch {
      /* network issue — fall through to the plans page */
    }
    setChecking(false);
    // Everyone else chooses a plan (or a free trial there).
    router.push("/unlock");
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

        <div className="mb-6">
          <Field label="Access code (optional)">
            <input
              className={inputCls}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Have a code? Enter it here"
            />
          </Field>
        </div>

        {error && (
          <p className="animate-rise mb-4 rounded-xl border border-margin/30 bg-margin/10 px-4 py-2.5 text-sm text-margin">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={checking} className="btn-primary disabled:opacity-60">
            {checking
              ? "Checking access…"
              : isEdit
                ? "Save changes"
                : "Continue →"}
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

      <div className="mt-4 rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-accent-deep">
          Official NACOS templates
        </h2>
        <p className="mb-3 mt-1 text-sm leading-relaxed text-ink-soft">
          The assistant writes your report and defense slides in this exact
          structure. Download the official guides to format your final document.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/NACOS-SIWES-Report-Guide.docx"
            download
            className="btn-ghost justify-start"
          >
            📄 Report master-guide (Word)
          </a>
          <a
            href="/NACOS-SIWES-Defense-Slides-Template.docx"
            download
            className="btn-ghost justify-start"
          >
            🎤 Defense slides template (Word)
          </a>
        </div>
      </div>

      <div className="mt-4">
        <BackupCard />
      </div>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Your details are stored only in this browser — nothing is uploaded
        anywhere except to generate your entries.
      </p>
    </div>
  );
}
