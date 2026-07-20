"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AssistantMessage, { ParsedEntry } from "@/components/AssistantMessage";
import AccessGate from "@/components/AccessGate";
import KeyModal from "@/components/KeyModal";
import Toast from "@/components/Toast";
import {
  Tier,
  isTrial,
  loadAccessToken,
  trialExpired,
  trialExpiry,
} from "@/lib/access";
import {
  buildMemory,
  clearChat,
  loadApiKey,
  loadChat,
  loadEntries,
  loadProfile,
  saveChat,
  saveEntry,
} from "@/lib/store";
import { ChatMessage, formatLongDate, weekNumberOf } from "@/lib/types";

const QUICK_ACTIONS = [
  { label: "Generate Weekly Summary", icon: "🗓", pro: false },
  { label: "Generate Monthly Summary", icon: "🗂", pro: true },
  { label: "Build Final Report", icon: "📄", pro: true },
];

export default function AssistantPage() {
  return <AccessGate render={(tier) => <Assistant tier={tier} />} />;
}

/** Live countdown like "2d 05h 31m 09s"; null once the trial has ended. */
function formatCountdown(ms: number): string | null {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
  if (h > 0) return `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
  return `${pad(m)}m ${pad(sec)}s`;
}

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

function Assistant({ tier }: { tier: Tier }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [lastUserText, setLastUserText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [keyModal, setKeyModal] = useState<
    null | "setup" | "invalid_key" | "quota"
  >(null);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const [onTrial, setOnTrial] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    const sync = () => {
      setHasKey(!!loadApiKey());
      setOnTrial(isTrial());
    };
    sync();
    window.addEventListener("siwes-key-change", sync);
    window.addEventListener("siwes-access-change", sync);
    return () => {
      window.removeEventListener("siwes-key-change", sync);
      window.removeEventListener("siwes-access-change", sync);
    };
  }, [router]);

  // Live trial countdown — ticks every second while on a trial.
  useEffect(() => {
    if (!onTrial) return;
    const tick = () => {
      const exp = trialExpiry();
      setCountdown(formatCountdown(exp ? exp - Date.now() : 0));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [onTrial]);

  // Keep the latest message in view by scrolling ONLY the chat container —
  // never the whole page (which was jumping the view to the top).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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

    // Trial expired? Send them to unlock instead of generating.
    if (isTrial() && trialExpired()) {
      setToast("Your free trial has ended — unlock to keep going.");
      setTimeout(() => router.push("/unlock"), 900);
      return;
    }

    // No key yet? Remember what they wanted to send and ask for a key first.
    const key = loadApiKey();
    if (!key) {
      setPendingRetry(trimmed);
      setKeyModal("setup");
      return;
    }

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
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": key,
          "x-access-token": loadAccessToken(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          // Send the conversation without the empty assistant placeholder
          messages: history.slice(0, -1).slice(-20),
          memory: buildMemory(),
        }),
      });

      // Access expired/invalid → back to the unlock page.
      if (res.status === 402) {
        router.replace("/unlock");
        return;
      }
      // Pro-only feature attempted on Basic → nudge to upgrade.
      if (res.status === 403) {
        setMessages((prev) => prev.slice(0, -2));
        setToast("That's a Pro feature — upgrade to unlock it.");
        setTimeout(() => router.push("/unlock"), 900);
        return;
      }

      // Auth / quota problems come back as JSON with a machine-readable reason.
      if (res.status === 401 || res.status === 429) {
        let reason: "invalid_key" | "quota" = "invalid_key";
        try {
          const j = await res.json();
          reason = j.reason === "quota" ? "quota" : "invalid_key";
        } catch {
          /* ignore */
        }
        // Drop the empty assistant bubble, restore the input, open the modal.
        setMessages((prev) => prev.slice(0, -2));
        setInput(trimmed);
        setPendingRetry(trimmed);
        setKeyModal(reason);
        return;
      }

      if (!res.ok || !res.body) {
        // Server sends a clean { message } for busy/maintenance/other errors.
        let msg = "The assistant is unavailable right now. Please try again shortly.";
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {
          /* keep the default friendly message */
        }
        throw new Error(msg);
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
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 7.5rem)" }}
    >
      <Toast message={toast} onDone={() => setToast(null)} />
      <KeyModal
        open={keyModal !== null}
        reason={keyModal ?? "setup"}
        onClose={() => {
          setKeyModal(null);
          setHasKey(!!loadApiKey());
          // If a key is now present and a message was waiting, send it.
          if (loadApiKey() && pendingRetry) {
            const t = pendingRetry;
            setPendingRetry(null);
            setInput("");
            setTimeout(() => send(t), 0);
          }
        }}
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="-mx-3 flex flex-1 gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {QUICK_ACTIONS.filter((a) => tier === "pro" || !a.pro).map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={() => send(a.label)}
              className="chip shrink-0 disabled:opacity-50"
            >
              <span aria-hidden>{a.icon}</span> {a.label}
            </button>
          ))}
          {tier === "basic" && (
            <button
              onClick={() => router.push("/unlock")}
              className="chip shrink-0 border-accent/40 bg-accent-wash font-semibold text-accent-dark"
              title="Unlock monthly summaries, the final report builder, and diagrams"
            >
              ⭐ Upgrade to Pro
            </button>
          )}
        </div>
        <button
          onClick={() => setKeyModal("setup")}
          title={hasKey ? "Your Gemini key is connected" : "Add your Gemini key"}
          className={`chip shrink-0 ${
            hasKey
              ? "border-emerald-300 text-emerald-700"
              : "border-margin/40 text-margin"
          }`}
        >
          🔑 {hasKey ? "Key" : "Add key"}
        </button>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="shrink-0 rounded-full px-2 py-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-margin"
          >
            Clear
          </button>
        )}
      </div>

      {onTrial && (
        <div className="animate-rise mb-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-wash px-4 py-2.5">
          <span aria-hidden className="text-lg">
            {countdown ? "⏳" : "🔒"}
          </span>
          <p className="flex-1 text-sm text-accent-deep">
            {countdown ? (
              <>
                <strong>Free trial</strong> —{" "}
                <span className="font-mono tabular-nums font-semibold tracking-tight">
                  {countdown}
                </span>{" "}
                left
              </>
            ) : (
              <>
                <strong>Your free trial has ended.</strong> Unlock to keep using
                the assistant.
              </>
            )}
          </p>
          <button
            onClick={() => router.push("/unlock")}
            className="btn shrink-0 bg-accent px-3.5 py-1.5 text-xs text-white hover:bg-accent-dark"
          >
            Unlock
          </button>
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-sheet"
      >
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
