"use client";

import { ChatMessage, LogEntry, Profile, formatLongDate } from "./types";

const ENTRIES_KEY = "siwes.entries.v1";
const CHAT_KEY = "siwes.chat.v1";
const PROFILE_KEY = "siwes.profile.v1";

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p.fullName || !p.firmName || !p.startDate) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadEntries(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LogEntry[];
    return list.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveEntry(entry: LogEntry): LogEntry[] {
  const entries = loadEntries().filter((e) => e.date !== entry.date);
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  return entries;
}

export function deleteEntry(date: string): LogEntry[] {
  const entries = loadEntries().filter((e) => e.date !== date);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  return entries;
}

export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) ?? "[]") as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[]) {
  // Keep the transcript bounded so requests stay small; memory carries history.
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40)));
}

export function clearChat() {
  localStorage.removeItem(CHAT_KEY);
}

/**
 * Compact internship memory the model receives with every request: the
 * student's profile plus every saved logbook entry, so daily entries,
 * summaries, and the final report stay consistent.
 */
export function buildMemory(): string {
  const parts: string[] = [];

  const p = loadProfile();
  if (p) {
    const lines = [
      `Full name: ${p.fullName}`,
      p.matricNumber && `Matric/Reg number: ${p.matricNumber}`,
      p.institution && `Institution: ${p.institution}`,
      p.course && `Course of study: ${p.course}`,
      `Firm/Organization: ${p.firmName}`,
      p.firmAddress && `Firm address: ${p.firmAddress}`,
      p.department && `Department/Section attached: ${p.department}`,
      p.supervisorName && `Industry supervisor: ${p.supervisorName}`,
      `Internship start date: ${p.startDate} (${formatLongDate(p.startDate)})`,
      p.durationWeeks && `Planned duration: ${p.durationWeeks} weeks`,
      `Work days: Monday–${p.worksSaturday ? "Saturday" : "Friday"}`,
    ].filter(Boolean);
    parts.push(`<student_profile>\n${lines.join("\n")}\n</student_profile>`);
  }

  const entries = loadEntries();
  if (entries.length === 0) {
    parts.push("No logbook entries have been saved yet.");
  } else {
    const lines = entries.map((e) => {
      const notes = e.rawNotes ? `\n  Raw notes: ${e.rawNotes}` : "";
      return `- ${e.day}, ${formatLongDate(e.date)} (${e.date}):\n  Logbook entry: ${e.description}${notes}`;
    });
    parts.push(
      `Saved logbook entries (${entries.length} day(s), chronological):\n${lines.join("\n")}`,
    );
  }

  return parts.join("\n\n");
}
