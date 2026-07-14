"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AssistantMessage, { ParsedEntry } from "@/components/AssistantMessage";
import Toast from "@/components/Toast";
import {
  buildMemory,
  clearChat,
  loadChat,
  loadEntries,
  loadProfile,
  saveChat,
  saveEntry,
} from "@/lib/store";
import { ChatMessage, formatLongDate, weekNumberOf } from "@/lib/types";

const QUICK_ACTIONS = [
  { label: "Generate Weekly Summary", icon: "🗓" },
  { label: "Generate Monthly Summary", icon: "🗂" },
  { label: "Build Final Report", icon: "📄" },
];

const EXAMPLE_PROMPTS = [
  "Today I set up VS Code and Git, then my supervisor showed me the company database and I practiced writing SQL queries.",
  "Spent the morning debugging a Python script that cleans sales data, afternoon in a meeting about the new API project.",
  "I shadowed the network team, helped crimp LAN cables and learned how the office switches are configured.",
];

function AssistantAvatar() {
  return (
    <span className="mt-1 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-deep font-display text-xs font-bold text-white shadow-lift">
      S
    </span>
  );
}

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [lastUserText, setLastUserText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const profile = loadProfile();
    if (!profile) {
      router.replace("/setup");
      return;
    }
    setFirstName(profile.fullName.split(/\s+/)[0]);
    setMessages(loadChat());
    setSavedDates(new Set(loadEntries().map((e) => e.date)));
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    requestAnimationFrame(autoGrow);
    setLastUserText(trimmed);
    setBusy(true);

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ];
    setMessages(history);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          // Send the conversation without the empty assistant placeholder
          messages: history.slice(0, -1).slice(-20),
          memory: buildMemory(),
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: snapshot };
          return next;
        });
      }
      const finalMessages: ChatMessage[] = [
        ...history.slice(0, -1),
        { role: "assistant", content: acc },
      ];
      setMessages(finalMessages);
      saveChat(finalMessages);
    } catch (err) {
      const msg =
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "Request cancelled.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${msg}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleSaveEntry(entry: ParsedEntry) {
    saveEntry({
      date: entry.date,
      day: entry.day,
      description: entry.text,
      rawNotes: lastUserText || undefined,
      savedAt: new Date().toISOString(),
    });
    setSavedDates(new Set(loadEntries().map((e) => e.date)));
    const profile = loadProfile();
    const week = profile ? weekNumberOf(entry.date, profile.startDate) : 1;
    setToast(
      `Saved to logbook — Week ${week}, ${entry.day} ${formatLongDate(entry.date)}`,
    );
  }

  function handleClear() {
    if (confirm("Clear this conversation? Saved logbook entries are kept.")) {
      clearChat();
      setMessages([]);
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "calc(100dvh - 8.5rem)" }}
    >
      <Toast message={toast} onDone={() => setToast(null)} />

      <div className="mb-3 flex items-center gap-2">
        <div className="-mx-3 flex flex-1 gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={() => send(a.label)}
              className="chip shrink-0 disabled:opacity-50"
            >
              <span aria-hidden>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="shrink-0 rounded-full px-2 py-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-margin"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-sheet">
        {messages.length === 0 && (
          <div className="stagger mx-auto max-w-lg py-10 text-center">
            <div className="relative mx-auto mb-4 w-fit">
              <p className="animate-float text-5xl" aria-hidden>
                📓
              </p>
              <span className="absolute -bottom-2 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-ink/10 blur-sm" />
            </div>
            <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {firstName ? `${firstName}, tell` : "Tell"} me everything you did
              today — <em className="text-ink-gradient">messy is fine.</em>
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-ink-soft">
              I&apos;ll turn it into a clean 35–70 word entry that fits the
              &ldquo;Description of Work Done&rdquo; box in your SIWES logbook,
              and keep the record for your weekly summaries and final report.
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Try an example
            </p>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="mb-2 block w-full rounded-xl border border-ink/10 bg-paper px-4 py-2.5 text-left text-xs leading-relaxed text-ink-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:text-ink hover:shadow-card"
              >
                &ldquo;{p}&rdquo;
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          return m.role === "user" ? (
            <div key={i} className="animate-rise flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-accent to-accent-dark px-4 py-2.5 text-sm text-white shadow-lift">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="animate-rise flex gap-2 sm:gap-2.5">
              <AssistantAvatar />
              <div className="min-w-0 max-w-full flex-1 rounded-2xl rounded-tl-sm border border-ink/5 bg-paper px-3 py-3 sm:px-4">
                {m.content === "" && busy && isLast ? (
                  <span
                    className="typing-dots flex items-center gap-1 py-1"
                    aria-label="Assistant is thinking"
                  >
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <div className={busy && isLast ? "stream-caret" : undefined}>
                    <AssistantMessage
                      content={m.content}
                      streaming={busy && isLast}
                      savedDates={savedDates}
                      onSaveEntry={handleSaveEntry}
                      onSuggestion={(label) => send(label)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex items-end gap-2 pb-[env(safe-area-inset-bottom)]"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Describe your day…"
          className="min-w-0 flex-1 resize-none rounded-2xl border border-ink/15 bg-paper-sheet px-4 py-3 text-base shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow sm:text-sm"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="btn shrink-0 bg-ink/10 px-4 py-3 text-ink-soft hover:bg-ink/20 sm:px-5"
          >
            <span className="hidden sm:inline">■ Stop</span>
            <span className="sm:hidden">■</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary group shrink-0 px-4 disabled:opacity-50 disabled:hover:shadow-none sm:px-5"
          >
            <span className="hidden sm:inline">Send </span>
            <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
              ↑
            </span>
          </button>
        )}
      </form>
    </div>
  );
}
