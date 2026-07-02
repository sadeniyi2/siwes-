"use client";

import { useEffect, useRef, useState } from "react";
import AssistantMessage, { ParsedEntry } from "@/components/AssistantMessage";
import {
  buildMemory,
  clearChat,
  loadChat,
  loadEntries,
  saveChat,
  saveEntry,
} from "@/lib/store";
import { ChatMessage } from "@/lib/types";

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

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [lastUserText, setLastUserText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(loadChat());
    setSavedDates(new Set(loadEntries().map((e) => e.date)));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
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
  }

  function handleClear() {
    if (confirm("Clear this conversation? Saved logbook entries are kept.")) {
      clearChat();
      setMessages([]);
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 8.5rem)" }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            disabled={busy}
            onClick={() => send(a.label)}
            className="chip disabled:opacity-50"
          >
            <span aria-hidden>{a.icon}</span> {a.label}
          </button>
        ))}
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-margin"
          >
            Clear chat
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-sheet">
        {messages.length === 0 && (
          <div className="animate-fade-in mx-auto max-w-lg py-10 text-center">
            <p className="mb-3 text-4xl" aria-hidden>
              📓
            </p>
            <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
              Tell me everything you did today —{" "}
              <em className="text-accent">messy is fine.</em>
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-ink-soft">
              I&apos;ll turn it into a clean 35–70 word entry that fits the
              &ldquo;Description of Work Done&rdquo; box in your SIWES logbook,
              and keep the record for your weekly summaries and final report.
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Try an example
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-xl border border-ink/10 bg-paper px-4 py-2.5 text-left text-xs leading-relaxed text-ink-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:text-ink hover:shadow-card"
                >
                  &ldquo;{p}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="animate-rise flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-accent to-accent-dark px-4 py-2.5 text-sm text-white shadow-lift">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="animate-rise flex">
              <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-ink/5 bg-paper px-4 py-3">
                {m.content === "" && busy && i === messages.length - 1 ? (
                  <span className="typing-dots flex items-center gap-1 py-1" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <AssistantMessage
                    content={m.content}
                    streaming={busy && i === messages.length - 1}
                    savedDates={savedDates}
                    onSaveEntry={handleSaveEntry}
                    onSuggestion={(label) => send(label)}
                  />
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Describe your day… (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none rounded-2xl border border-ink/15 bg-paper-sheet px-4 py-3 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="btn bg-ink/10 px-5 py-3 text-ink-soft hover:bg-ink/20"
          >
            ■ Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary disabled:opacity-50 disabled:hover:shadow-none"
          >
            Send ↑
          </button>
        )}
      </form>
    </div>
  );
}
