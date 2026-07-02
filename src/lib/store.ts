"use client";

import { ChatMessage, LogEntry, formatLongDate } from "./types";

const ENTRIES_KEY = "siwes.entries.v1";
const CHAT_KEY = "siwes.chat.v1";

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
 * Compact internship memory the model receives with every request, so weekly
 * and monthly summaries and the final report stay consistent with every
 * saved daily entry.
 */
export function buildMemory(): string {
  const entries = loadEntries();
  if (entries.length === 0) {
    return "No logbook entries have been saved yet.";
  }
  const lines = entries.map((e) => {
    const notes = e.rawNotes ? `\n  Raw notes: ${e.rawNotes}` : "";
    return `- ${e.day}, ${formatLongDate(e.date)} (${e.date}):\n  Logbook entry: ${e.description}${notes}`;
  });
  return `Saved logbook entries (${entries.length} day(s), chronological):\n${lines.join("\n")}`;
}
