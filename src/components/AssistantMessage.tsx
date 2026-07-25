"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import { wordCount } from "@/lib/types";
import { exportMarkdownDocx, looksLikeDocument } from "@/lib/reportDocx";
import { exportSlidesPptx, looksLikeSlides } from "@/lib/slidesPptx";

function inferFileBase(content: string): string {
  if (/(^|\n)\s*#{1,3}\s*slide\s*\d|defense slide/i.test(content))
    return "siwes-defense-slides";
  if (/chapter|abstract|acknowledgement|references|appendix/i.test(content))
    return "siwes-report";
  return "siwes-summary";
}

export interface ParsedEntry {
  day: string;
  date: string;
  text: string;
}

type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "entry"; entry: ParsedEntry }
  | { kind: "suggestions"; labels: string[] };

const ENTRY_RE =
  /<logbook_entry\s+day="([^"]*)"\s+date="([^"]*)"\s*>([\s\S]*?)<\/logbook_entry>/g;
const SUGGESTIONS_RE = /<suggestions>([\s\S]*?)<\/suggestions>/g;

export function parseAssistantContent(content: string): Segment[] {
  const segments: Segment[] = [];
  const combined = new RegExp(
    `${ENTRY_RE.source}|${SUGGESTIONS_RE.source}`,
    "g",
  );
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "markdown", text: content.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      segments.push({
        kind: "entry",
        entry: { day: m[1], date: m[2], text: m[3].trim() },
      });
    } else if (m[4] !== undefined) {
      segments.push({
        kind: "suggestions",
        labels: m[4]
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    segments.push({ kind: "markdown", text: content.slice(last) });
  }
  return segments;
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children } = props;
            const isMermaid = /language-mermaid/.test(className ?? "");
            if (isMermaid) {
              return <Mermaid chart={String(children).trim()} />;
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function AssistantMessage({
  content,
  streaming,
  savedDates,
  onSaveEntry,
  onSuggestion,
}: {
  content: string;
  streaming: boolean;
  savedDates: Set<string>;
  onSaveEntry: (entry: ParsedEntry) => void;
  onSuggestion: (label: string) => void;
}) {
  const segments = parseAssistantContent(content);
  const [saving, setSaving] = useState(false);
  const [savingPptx, setSavingPptx] = useState(false);
  const isSlides = !streaming && looksLikeSlides(content);
  const showDownload = !streaming && looksLikeDocument(content);

  async function downloadWord() {
    setSaving(true);
    try {
      await exportMarkdownDocx(content, inferFileBase(content));
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function downloadPptx() {
    setSavingPptx(true);
    try {
      await exportSlidesPptx(content);
    } catch {
      /* ignore */
    } finally {
      setSavingPptx(false);
    }
  }

  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.kind === "markdown") {
          return <Markdown key={i} text={seg.text} />;
        }
        if (seg.kind === "entry") {
          const words = wordCount(seg.entry.text);
          const inRange = words >= 35 && words <= 70;
          const saved = savedDates.has(seg.entry.date);
          return (
            <div
              key={i}
              className="animate-pop sheet-paper relative my-3 overflow-hidden rounded-xl border border-ink/15 p-4 shadow-card"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent-dark to-accent" />
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-accent-deep">
                <span className="font-display">Day: {seg.entry.day}</span>
                <span className="text-ink-faint">·</span>
                <span className="font-display">Date: {seg.entry.date}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 font-sans ${
                    inRange
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                  title={inRange ? "Fits the logbook box" : "Outside the 35–70 word target"}
                >
                  {words} words {inRange ? "✓" : "⚠"}
                </span>
              </div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
                Description of Work Done
              </p>
              <p className="font-book text-[15px] leading-relaxed text-ink">
                {seg.entry.text}
              </p>
              {!streaming && (
                <div
                  className="word-meter mt-3"
                  title="Green zone = the 35–70 word logbook target"
                >
                  <span className="zone" />
                  <span
                    className="fill"
                    style={{ width: `${Math.min(100, words)}%` }}
                  />
                </div>
              )}
              {!streaming && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onSaveEntry(seg.entry)}
                    className={`btn px-3.5 py-1.5 text-xs ${
                      saved
                        ? "bg-emerald-600 text-white"
                        : "bg-accent text-white hover:bg-accent-dark hover:shadow-lift"
                    }`}
                  >
                    {saved ? "✓ Saved to logbook" : "Save to logbook"}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(seg.entry.text)}
                    className="btn border border-ink/15 bg-paper-sheet px-3.5 py-1.5 text-xs text-ink-soft hover:border-accent/50 hover:text-accent-dark"
                  >
                    Copy text
                  </button>
                  {saved && (
                    <span className="animate-stamp ml-auto select-none rounded border-2 border-emerald-600/70 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-emerald-700/80">
                      Logged
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        }
        // suggestions
        if (streaming) return null;
        return (
          <div key={i} className="mt-2 flex flex-wrap gap-2">
            {seg.labels.map((label) => (
              <button
                key={label}
                onClick={() => onSuggestion(label)}
                className="chip border-accent/40 text-accent-dark hover:bg-accent-wash"
              >
                {label}
              </button>
            ))}
          </div>
        );
      })}
      {(showDownload || isSlides) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          {isSlides && (
            <button
              onClick={downloadPptx}
              disabled={savingPptx}
              title="Download a designed PowerPoint deck with speaker notes"
              className="btn bg-accent px-3.5 py-1.5 text-xs text-white hover:bg-accent-dark hover:shadow-lift disabled:opacity-60"
            >
              {savingPptx ? "Designing…" : "⬇ Download as PowerPoint"}
            </button>
          )}
          <button
            onClick={downloadWord}
            disabled={saving}
            title="Download this as an editable Word document"
            className={`btn px-3.5 py-1.5 text-xs disabled:opacity-60 ${
              isSlides
                ? "border border-ink/15 bg-paper-sheet text-ink-soft hover:border-accent/50 hover:text-accent-dark"
                : "bg-accent text-white hover:bg-accent-dark hover:shadow-lift"
            }`}
          >
            {saving ? "Preparing…" : "⬇ Download as Word"}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(content)}
            className="btn border border-ink/15 bg-paper-sheet px-3.5 py-1.5 text-xs text-ink-soft hover:border-accent/50 hover:text-accent-dark"
          >
            Copy all
          </button>
        </div>
      )}
    </div>
  );
}
