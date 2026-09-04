"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AssistantMessage, { ParsedEntry } from "@/components/AssistantMessage";
import AccessGate from "@/components/AccessGate";
import Toast from "@/components/Toast";
import Tour, { TourStep } from "@/components/Tour";
import OnboardingProgress from "@/components/OnboardingProgress";
import ProInsights from "@/components/ProInsights";
import VoiceInput from "@/components/VoiceInput";
import WritingPrefs, {
  DEFAULT_PREFS,
  Prefs,
  loadPrefs,
  prefsDirective,
} from "@/components/WritingPrefs";
import { pushCloudBackup, syncCloudOnLoad } from "@/lib/cloud";
import {
  Tier,
  clientId,
  isTrial,
  loadAccessToken,
  trialExpired,
  trialExpiry,
} from "@/lib/access";
import {
  buildMemory,
  clearChat,
  loadChat,
  loadEntries,
  loadProfile,
  saveChat,
  saveEntry,
} from "@/lib/store";
import { ChatImage, ChatMessage, formatLongDate, weekNumberOf } from "@/lib/types";
import { compressImage } from "@/lib/image";
import {
  DEFENSE_SLIDES_BLUEPRINT,
  FINAL_REPORT_BLUEPRINT,
  HUMANIZE_BLUEPRINT,
} from "@/lib/templates";

interface QuickAction {
  label: string;
  icon: string;
  pro: boolean;
  /** Extra instruction sent to the AI without cluttering the chat bubble. */
  augment?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Generate Weekly Summary", icon: "🗓", pro: false },
  { label: "Generate Monthly Summary", icon: "🗂", pro: true },
  { label: "Build Final Report", icon: "📄", pro: true, augment: FINAL_REPORT_BLUEPRINT },
  { label: "Build Defense Slides", icon: "🎤", pro: true, augment: DEFENSE_SLIDES_BLUEPRINT },
  { label: "Make it more human", icon: "🧑", pro: true, augment: HUMANIZE_BLUEPRINT },
  { label: "Improve my last entry", icon: "✨", pro: true },
  { label: "Generate Table of Contents", icon: "🔖", pro: true },
  { label: "Summarize skills gained", icon: "🏷", pro: true },
  { label: "Suggest a diagram", icon: "📊", pro: true },
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

const ASSISTANT_TOUR: TourStep[] = [
  {
    selector: '[data-tour="composer"]',
    title: "Tell me your day here",
    body: "Type everything you did at work — rough and messy is fine. Press Send and I'll turn it into a neat 35–70 word logbook entry.",
  },
  {
    selector: '[data-tour="actions"]',
    title: "One-tap summaries & report",
    body: "When you're ready, generate your weekly summary, monthly summary, or the full final SIWES report from here.",
  },
  {
    selector: '[data-tour="nav-logbook"]',
    title: "Your logbook",
    body: "Open the Logbook tab to see your Weekly Progress Chart, edit entries, and print or download them.",
  },
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

function Assistant({ tier }: { tier: Tier }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [lastUserText, setLastUserText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(true);
  const [onTrial, setOnTrial] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  // Images attached to the NEXT message. `url` is a data URL for the preview;
  // `mimeType`/`data` are what we send to Gemini (base64, no prefix).
  const [attachments, setAttachments] = useState<
    { url: string; mimeType: string; data: string }[]
  >([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Refs let the message callbacks stay referentially stable, so the (memoized)
  // chat messages don't re-render on every keystroke in the composer.
  const lastUserTextRef = useRef("");
  lastUserTextRef.current = lastUserText;
  const sendRef = useRef<(t: string, a?: string) => void>(() => {});

  useEffect(() => {
    const profile = loadProfile();
    if (!profile) {
      router.replace("/setup");
      return;
    }
    setFirstName(profile.fullName.split(/\s+/)[0]);
    setMessages(loadChat());
    setSavedDates(new Set(loadEntries().map((e) => e.date)));
    setPrefs(loadPrefs());

    // Reconcile this device with the account automatically (no manual upload,
    // and switching phones never loses work — see syncCloudOnLoad).
    syncCloudOnLoad().then((n) => {
      if (n > 0) {
        setSavedDates(new Set(loadEntries().map((e) => e.date)));
        setMessages(loadChat());
        window.dispatchEvent(new Event("siwes-entry-saved"));
        setToast(
          `Welcome back — restored ${n} logbook ${n === 1 ? "entry" : "entries"} from your account.`,
        );
      }
    });
    const sync = () => setOnTrial(isTrial());
    sync();
    // The owner provides the AI key(s) centrally; students never handle keys.
    // We only check whether the assistant is ready so we can show a gentle note
    // if the owner hasn't added a key yet.
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((j) => setAiReady(!!j.serverKey))
      .catch(() => setAiReady(true));
    const focusComposer = () => textareaRef.current?.focus();
    window.addEventListener("siwes-access-change", sync);
    window.addEventListener("siwes-focus-composer", focusComposer);
    return () => {
      window.removeEventListener("siwes-access-change", sync);
      window.removeEventListener("siwes-focus-composer", focusComposer);
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

  // Compress and attach picked image files (up to 6 total).
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const room = 6 - attachments.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setAttachError("You can attach up to 6 images.");
      return;
    }
    const added: { url: string; mimeType: string; data: string }[] = [];
    for (const file of picked) {
      try {
        const url = await compressImage(file, 1280, 0.7); // data:image/jpeg;base64,…
        const comma = url.indexOf(",");
        const mimeType = url.slice(5, url.indexOf(";")) || "image/jpeg";
        added.push({ url, mimeType, data: url.slice(comma + 1) });
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : "Couldn't add that image.");
      }
    }
    if (added.length) setAttachments((prev) => [...prev, ...added]);
  }

  async function send(text: string, augment?: string) {
    const trimmed = text.trim();
    // Images captured for THIS message; allow sending an image with no text.
    const imgs: ChatImage[] = attachments.map((a) => ({
      mimeType: a.mimeType,
      data: a.data,
    }));
    if ((!trimmed && imgs.length === 0) || busy) return;

    // Trial expired? Send them to unlock instead of generating.
    if (isTrial() && trialExpired()) {
      setToast("Your free trial has ended — unlock to keep going.");
      setTimeout(() => router.push("/unlock"), 900);
      return;
    }

    setInput("");
    setAttachments([]);
    setAttachError(null);
    requestAnimationFrame(autoGrow);
    setLastUserText(trimmed);
    setBusy(true);

    // A default instruction for image-only turns, so the model has direction.
    const sendContent =
      trimmed || "Please look at the attached image(s) and help me with my SIWES logbook.";

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed, images: imgs.length ? imgs : undefined },
      { role: "assistant", content: "" },
    ];
    setMessages(history);

    // What we SEND to the model: same conversation, but the last user turn may
    // carry an extra instruction (e.g. the report/slides blueprint) plus any
    // attached images. The extra instruction never clutters the visible bubble.
    const sentUser: ChatMessage = {
      role: "user",
      content: augment ? `${sendContent}\n\n${augment}` : sendContent,
      images: imgs.length ? imgs : undefined,
    };
    const sentMessages: ChatMessage[] = [...messages, sentUser];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": loadAccessToken(),
          "x-client-id": clientId(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          // Send the conversation without the empty assistant placeholder
          messages: sentMessages.slice(-20),
          memory: (() => {
            const base = buildMemory();
            const dir = tier === "pro" ? prefsDirective(prefs) : "";
            return dir
              ? `${base}\n\n<writing_preferences>\n${dir}\n</writing_preferences>`
              : base;
          })(),
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

      // Key / quota / rate-limit problems come back as JSON. Students don't
      // manage keys, so these are always shown as a friendly message.
      if (res.status === 401 || res.status === 429) {
        let message = "";
        try {
          const j = await res.json();
          message = j.message || "";
        } catch {
          /* ignore */
        }
        setMessages((prev) => prev.slice(0, -2));
        setInput(trimmed);
        setToast(message || "The AI is busy right now. Please try again shortly.");
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
      // Don't persist image bytes in the saved chat (keeps localStorage / cloud
      // sync small) — they stay visible for the current session only.
      saveChat(finalMessages.map((m) => ({ role: m.role, content: m.content })));
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
  sendRef.current = send;

  // Stable callbacks (via refs) so memoized messages don't re-render while typing.
  const handleSaveEntry = useCallback((entry: ParsedEntry) => {
    saveEntry({
      date: entry.date,
      day: entry.day,
      description: entry.text,
      rawNotes: lastUserTextRef.current || undefined,
      savedAt: new Date().toISOString(),
    });
    setSavedDates(new Set(loadEntries().map((e) => e.date)));
    window.dispatchEvent(new Event("siwes-entry-saved"));
    pushCloudBackup();
    const profile = loadProfile();
    const week = profile ? weekNumberOf(entry.date, profile.startDate) : 1;
    setToast(
      `Saved to logbook — Week ${week}, ${entry.day} ${formatLongDate(entry.date)}`,
    );
  }, []);

  const handleSuggestion = useCallback((label: string) => {
    sendRef.current(label);
  }, []);

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
      <Tour steps={ASSISTANT_TOUR} storageKey="siwes.tour.assistant.v2" />

      {!aiReady && (
        <div className="animate-rise mb-3 flex items-center gap-2.5 rounded-xl border border-amber-300/70 bg-amber-400/10 px-4 py-2.5 text-sm text-ink-soft">
          <span aria-hidden className="text-lg">
            ⚙️
          </span>
          <p>The assistant is being set up. Please check back shortly.</p>
        </div>
      )}

      <OnboardingProgress />
      {tier === "pro" && <ProInsights />}

      <div className="mb-3 flex items-center gap-2">
        <div data-tour="actions" className="-mx-3 flex flex-1 gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {QUICK_ACTIONS.filter((a) => tier === "pro" || !a.pro).map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={() => send(a.label, a.augment)}
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
        {tier === "pro" && <WritingPrefs value={prefs} onChange={setPrefs} />}
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
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-accent to-accent-dark px-4 py-2.5 text-sm text-white shadow-lift">
                {m.images && m.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.images.map((img, k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={k}
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt={`Attached ${k + 1}`}
                        className="h-24 w-24 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
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
                      onSuggestion={handleSuggestion}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 pb-[env(safe-area-inset-bottom)]">
        {(attachments.length > 0 || attachError) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="relative h-16 w-16 overflow-hidden rounded-xl border border-ink/15 shadow-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={`Attachment ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-xs leading-none text-white hover:bg-ink"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
            {attachError && <span className="text-xs text-margin">{attachError}</span>}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
        <textarea
          data-tour="composer"
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
        {tier === "pro" && !busy && (
          <VoiceInput
            onText={(t) => {
              setInput((prev) => (prev ? `${prev} ${t}` : t));
              requestAnimationFrame(autoGrow);
              textareaRef.current?.focus();
            }}
          />
        )}
        {!busy && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Attach an image"
            aria-label="Attach an image"
            className="btn shrink-0 border border-ink/15 bg-paper-sheet px-3 py-3 text-ink-soft shadow-card hover:border-accent/50 hover:text-accent-dark"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
              <path
                d="M4.5 18l4.5-5 3.5 4 3-3 4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
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
            disabled={!input.trim() && attachments.length === 0}
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
    </div>
  );
}
