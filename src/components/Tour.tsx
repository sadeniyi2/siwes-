"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  /** CSS selector of the element to highlight (usually [data-tour="..."]). */
  selector: string;
  title: string;
  body: string;
}

/**
 * Lightweight guided tour. Highlights real elements on the page with a spotlight
 * + tooltip and Next/Back/Skip controls. Auto-starts once per storageKey, and
 * restarts on the global "siwes-start-tour" event (fired by the ? Help button).
 *
 * Rendered through a portal to document.body so the fixed-position spotlight is
 * anchored to the viewport (not to any transformed page wrapper) — this is what
 * keeps the highlight aligned with the real element.
 */
export default function Tour({
  steps,
  storageKey,
}: {
  steps: TourStep[];
  storageKey: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(-1); // -1 = inactive
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(190);

  useEffect(() => setMounted(true), []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      /* ignore */
    }
    setIndex(-1);
    setRect(null);
  }, [storageKey]);

  // Auto-start on first visit; also respond to a manual "start tour" request.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(storageKey);
    } catch {
      /* ignore */
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!seen) t = setTimeout(() => setIndex(0), 800);
    const start = () => setIndex(0);
    window.addEventListener("siwes-start-tour", start);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("siwes-start-tour", start);
    };
  }, [storageKey]);

  const visible = (el: HTMLElement | null) =>
    !!el &&
    el.offsetParent !== null &&
    el.getBoundingClientRect().width > 0 &&
    el.getBoundingClientRect().height > 0;

  // Resolve the current step's element (skipping any that aren't on the page).
  useEffect(() => {
    if (index < 0) return;
    let i = index;
    let el = document.querySelector<HTMLElement>(steps[i]?.selector);
    while (i < steps.length && !visible(el)) {
      i += 1;
      el = i < steps.length ? document.querySelector<HTMLElement>(steps[i].selector) : null;
    }
    if (i >= steps.length || !visible(el)) {
      finish();
      return;
    }
    if (i !== index) {
      setIndex(i);
      return;
    }
    const target = el!;
    // Bring it into view instantly (smooth scrolling makes measuring unreliable).
    target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

    const measure = () => setRect(target.getBoundingClientRect());
    // Measure now and again as layout/scroll settle.
    let raf = requestAnimationFrame(() => {
      measure();
      raf = requestAnimationFrame(measure);
    });
    const timers = [
      setTimeout(measure, 120),
      setTimeout(measure, 300),
      setTimeout(measure, 600),
    ];
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index, steps, finish]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, rect]);

  if (!mounted || index < 0 || !rect) return null;
  const step = steps[index];

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const pad = 6;
  const holeTop = Math.max(4, rect.top - pad);
  const holeLeft = Math.max(4, rect.left - pad);
  const holeW = Math.min(rect.width + pad * 2, vw - holeLeft - 4);
  const holeH = rect.height + pad * 2;

  const cardW = Math.min(320, vw - 24);
  const below = rect.bottom + 14 + cardH < vh;
  const cardTop = below
    ? Math.min(rect.bottom + 12, vh - cardH - 12)
    : Math.max(12, rect.top - cardH - 12);
  const cardLeft = Math.min(
    Math.max(12, rect.left + rect.width / 2 - cardW / 2),
    vw - cardW - 12,
  );

  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9998] print:hidden" aria-live="polite">
      {/* Spotlight: a hole punched through a dark overlay */}
      <div
        className="pointer-events-none fixed rounded-xl ring-[3px] ring-accent transition-all duration-200"
        style={{
          top: holeTop,
          left: holeLeft,
          width: holeW,
          height: holeH,
          boxShadow: "0 0 0 9999px rgba(28,36,52,0.62)",
        }}
      />
      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="animate-pop fixed z-[9999] rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-sheet"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            Step {index + 1} of {steps.length}
          </span>
          <button
            onClick={finish}
            className="text-xs font-medium text-ink-faint hover:text-ink"
          >
            Skip
          </button>
        </div>
        <h3 className="mb-1 font-display text-base font-semibold">{step.title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">{step.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-accent" : "w-1.5 bg-ink/20"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((v) => v - 1)}
                className="btn border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink-soft"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setIndex((v) => v + 1))}
              className="btn bg-accent px-4 py-1.5 text-xs text-white hover:bg-accent-dark"
            >
              {isLast ? "Got it ✓" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
