"use client";

// Turn the AI's Markdown defense-slide output into a designed .pptx deck.
// pptxgenjs is imported lazily so it only loads when the student clicks
// "Download as PowerPoint".

/* eslint-disable @typescript-eslint/no-explicit-any */

const ACCENT = "2B4EDA";
const DEEP = "16296E";
const INK = "1C2434";
const SOFT = "46506B";
const WASH = "EAF0FF";
const WHITE = "FFFFFF";

interface Slide {
  title: string;
  bullets: string[];
  visual?: string;
  notes: string;
}

function stripTags(md: string): string {
  return md
    .replace(/<logbook_entry[\s\S]*?<\/logbook_entry>/g, "")
    .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Does this output look like a slide deck? */
export function looksLikeSlides(md: string): boolean {
  return /(^|\n)\s*#{1,4}\s*slide\s*\d/i.test(md) || /defense slide/i.test(md);
}

function parseSlides(md: string): Slide[] {
  const lines = stripTags(md).split(/\r?\n/);
  const slides: Slide[] = [];
  let cur: Slide | null = null;
  let inNotes = false;

  const push = () => {
    if (cur) slides.push(cur);
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      push();
      const title = heading[1].replace(/^slide\s*\d+\s*[:\-–]\s*/i, "").trim();
      cur = { title: title || `Slide ${slides.length + 1}`, bullets: [], visual: undefined, notes: "" };
      inNotes = false;
      continue;
    }
    if (!cur) continue;
    if (line === "") {
      if (inNotes) cur.notes += "\n";
      continue;
    }
    const visual = line.match(/^\[?\s*visual\s*:\s*(.*?)\]?\s*$/i);
    if (visual) {
      cur.visual = visual[1].trim();
      continue;
    }
    const notesStart = line.match(/^speaker\s*notes?\s*:\s*(.*)$/i);
    if (notesStart) {
      inNotes = true;
      if (notesStart[1]) cur.notes += notesStart[1] + " ";
      continue;
    }
    if (inNotes) {
      cur.notes += line.replace(/^[-*]\s+/, "") + " ";
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    cur.bullets.push((bullet ? bullet[1] : line).replace(/[`*]/g, "").trim());
  }
  push();
  return slides;
}

function isTitle(s: Slide, index: number): boolean {
  return index === 0 || /title slide/i.test(s.title);
}
function isClosing(s: Slide): boolean {
  return /thank you|any question|q\s*&\s*a|questions/i.test(s.title);
}

export async function exportSlidesPptx(
  markdown: string,
  fileBase = "siwes-defense-slides",
): Promise<void> {
  const { default: pptxgen } = await import("pptxgenjs");
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  const W = 13.333;

  const slides = parseSlides(markdown);
  if (slides.length === 0) return;

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();

    // ---- Title slide ----
    if (isTitle(s, idx)) {
      slide.background = { color: ACCENT };
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 3.15, w: W, h: 0.06, fill: { color: WHITE },
      } as any);
      const heading = s.bullets[0] && !/^presentation title/i.test(s.bullets[0])
        ? s.bullets[0]
        : s.title.replace(/title slide/i, "SIWES Defense Presentation") || "SIWES Defense Presentation";
      slide.addText(heading, {
        x: 0.8, y: 1.7, w: W - 1.6, h: 1.4, align: "center",
        fontFace: "Georgia", fontSize: 34, bold: true, color: WHITE,
      });
      const subs = s.bullets.slice(heading === s.bullets[0] ? 1 : 0);
      slide.addText(subs.length ? subs.join("\n") : "Student Industrial Work Experience Scheme", {
        x: 0.8, y: 3.5, w: W - 1.6, h: 2.5, align: "center",
        fontFace: "Arial", fontSize: 18, color: "DCE4FF", lineSpacingMultiple: 1.3,
      });
      if (s.notes.trim()) slide.addNotes(s.notes.trim());
      return;
    }

    // ---- Closing slides (Thank You / Q&A) ----
    if (isClosing(s)) {
      slide.background = { color: DEEP };
      slide.addText(s.title, {
        x: 0.8, y: 2.6, w: W - 1.6, h: 1.6, align: "center",
        fontFace: "Georgia", fontSize: 40, bold: true, color: WHITE,
      });
      const extra = s.bullets.join("  ·  ");
      if (extra)
        slide.addText(extra, {
          x: 1, y: 4.3, w: W - 2, h: 1.5, align: "center",
          fontFace: "Arial", fontSize: 16, color: "C7D2FF",
        });
      if (s.notes.trim()) slide.addNotes(s.notes.trim());
      return;
    }

    // ---- Content slides ----
    slide.background = { color: WHITE };
    // Title bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: 1.15, fill: { color: ACCENT },
    } as any);
    slide.addText(s.title, {
      x: 0.6, y: 0, w: W - 1.2, h: 1.15, align: "left", valign: "middle",
      fontFace: "Georgia", fontSize: 26, bold: true, color: WHITE,
    });
    slide.addText(String(idx + 1), {
      x: W - 1.1, y: 0, w: 0.8, h: 1.15, align: "right", valign: "middle",
      fontFace: "Arial", fontSize: 12, color: "C7D2FF",
    });

    const hasVisual = !!s.visual;
    const colW = hasVisual ? (W - 1.2) * 0.56 : W - 1.2;

    // Bullets
    if (s.bullets.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })) as any,
        {
          x: 0.6, y: 1.55, w: colW, h: 5.4, valign: "top",
          fontFace: "Arial", fontSize: 18, color: INK, lineSpacingMultiple: 1.35,
          paraSpaceAfter: 10,
        },
      );
    }

    // Visual placeholder box
    if (hasVisual) {
      const vx = 0.6 + colW + 0.4;
      const vw = W - vx - 0.6;
      slide.addShape(pptx.ShapeType.rect, {
        x: vx, y: 1.6, w: vw, h: 5.1,
        fill: { color: WASH },
        line: { color: ACCENT, width: 1.25, dashType: "dash" },
      } as any);
      slide.addText(
        [
          { text: "🖼  VISUAL\n", options: { fontSize: 12, color: ACCENT, bold: true } },
          { text: s.visual || "", options: { fontSize: 14, color: DEEP } },
          { text: "\n\n(Add your image / screenshot here)", options: { fontSize: 11, color: SOFT, italic: true } },
        ] as any,
        { x: vx + 0.25, y: 1.8, w: vw - 0.5, h: 4.7, align: "center", valign: "middle" },
      );
    }

    if (s.notes.trim()) slide.addNotes(s.notes.trim());
  });

  await pptx.writeFile({ fileName: `${fileBase}-${new Date().toISOString().slice(0, 10)}.pptx` });
}
