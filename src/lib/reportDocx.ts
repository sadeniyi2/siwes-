"use client";

// Convert the AI's Markdown output (report, slides, or a summary) into a real
// downloadable .docx. The heavy `docx` library is imported lazily so it only
// loads when the student clicks download.

/* eslint-disable @typescript-eslint/no-explicit-any */

function stripTags(md: string): string {
  return md
    .replace(/<logbook_entry[\s\S]*?<\/logbook_entry>/g, "")
    .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "")
    .trim();
}

/** Does this look like a full document worth a Word download? */
export function looksLikeDocument(md: string): boolean {
  const t = stripTags(md);
  return /^#{1,4}\s/m.test(t) || t.length > 600;
}

/** Split a line of inline Markdown into styled runs (bold/italic/code). */
function inlineRuns(TextRun: any, text: string): any[] {
  const runs: any[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index) }));
    }
    if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true }));
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], italics: true }));
    else if (m[4] !== undefined)
      runs.push(new TextRun({ text: m[4], font: "Consolas", size: 20 }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  return runs.length ? runs : [new TextRun({ text: "" })];
}

/** A real image the student attached, to drop into the report's figure slots. */
export interface ReportPhoto {
  /** data: URL (jpeg/png) */
  src: string;
  caption?: string;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function imageType(dataUrl: string): "jpg" | "png" | "gif" | "bmp" {
  const m = /^data:image\/(\w+)/.exec(dataUrl);
  const t = (m?.[1] || "").toLowerCase();
  if (t === "png") return "png";
  if (t === "gif") return "gif";
  if (t === "bmp") return "bmp";
  return "jpg";
}

export async function exportMarkdownDocx(
  markdown: string,
  fileBase = "siwes-document",
  photos: ReportPhoto[] = [],
): Promise<void> {
  const d = await import("docx");
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = d;

  // An image placeholder slot (when there's no real picture to drop in yet).
  const captionPara = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text, italics: true, bold: true })],
    });
  const slotPara = () =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "[ insert your image here ]", italics: true, color: "888888" }),
      ],
    });
  const imagePara = (src: string) => {
    try {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: imageType(src),
            data: dataUrlToBytes(src),
            transformation: { width: 420, height: 300 },
          }),
        ],
      });
    } catch {
      return slotPara();
    }
  };

  const lines = stripTags(markdown).split(/\r?\n/);
  const children: any[] = [];
  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
  ];

  let i = 0;
  let inFence = false;
  let inCover = false; // centre the cover page block
  let seenTopHeading = false; // first top-level heading gets no page break
  let photosInserted = false;

  // Build the "photos from my logbook" appendix (their real attached images),
  // placed just before References so References stays the last page.
  const pushPhotoAppendix = () => {
    if (photosInserted || photos.length === 0) return;
    photosInserted = true;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: "APPENDIX: PHOTOS FROM MY LOGBOOK", bold: true })],
      }),
    );
    photos.forEach((p, n) => {
      children.push(imagePara(p.src));
      children.push(captionPara(p.caption || `Figure B.${n + 1}`));
    });
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Code fences — keep contents as monospace, skip mermaid diagrams.
    if (/^```/.test(line.trim())) {
      const isMermaid = /mermaid/i.test(line);
      inFence = !inFence;
      if (inFence && isMermaid) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "[Diagram]", italics: true })],
          }),
        );
        // skip to closing fence
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) i++;
        inFence = false;
      }
      i++;
      continue;
    }
    if (inFence) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: raw, font: "Consolas", size: 20 })],
        }),
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].replace(/\*\*/g, "").trim();
      if (level === 1) {
        const upper = text.toUpperCase();
        // The cover page is centred and shows no literal "COVER PAGE" title.
        if (/^COVER PAGE$/.test(upper)) {
          inCover = true;
          seenTopHeading = true;
          i++;
          continue;
        }
        inCover = false;
        // The student's real photos go in just before References → References
        // remains the final page.
        if (/^REFERENCES\b/.test(upper)) pushPhotoAppendix();
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            pageBreakBefore: seenTopHeading, // every chapter/section on a new page
            spacing: { before: 160, after: 120 },
            children: [new TextRun({ text: upper, bold: true })],
          }),
        );
        seenTopHeading = true;
        i++;
        continue;
      }
      children.push(
        new Paragraph({
          heading: HEADINGS[level - 1],
          spacing: { before: 160, after: 60 },
          children: inlineRuns(TextRun, text),
        }),
      );
      i++;
      continue;
    }

    // Image / figure line: ![caption](src)
    const img = line.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/);
    if (img) {
      const caption = img[1].trim();
      const src = img[2].trim();
      if (/^data:image\//.test(src)) {
        children.push(imagePara(src));
        if (caption) children.push(captionPara(caption));
      } else {
        if (caption) children.push(captionPara(caption));
        children.push(slotPara());
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      children.push(new Paragraph({ text: "" }));
      i++;
      continue;
    }

    // Markdown table (a header row followed by a |---| separator)
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]*\|[\s:|-]*$/.test(lines[i + 1])
    ) {
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        if (!/^\s*\|?[\s:-]*\|[\s:|-]*$/.test(lines[j])) {
          rows.push(
            lines[j]
              .trim()
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((c) => c.trim()),
          );
        }
        j++;
      }
      if (rows.length) {
        const cols = Math.max(...rows.map((r) => r.length));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              (r, ri) =>
                new TableRow({
                  children: Array.from({ length: cols }, (_, ci) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children:
                            ri === 0
                              ? [new TextRun({ text: r[ci] ?? "", bold: true })]
                              : inlineRuns(TextRun, r[ci] ?? ""),
                        }),
                      ],
                    }),
                  ),
                }),
            ),
          }),
        );
      }
      i = j;
      continue;
    }

    // Bullet list
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: inlineRuns(TextRun, bullet[1]) }),
      );
      i++;
      continue;
    }

    // Numbered list
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (num) {
      children.push(
        new Paragraph({
          numbering: { reference: "num", level: 0 },
          children: inlineRuns(TextRun, num[1]),
        }),
      );
      i++;
      continue;
    }

    // Plain paragraph (centred + bold while on the cover page)
    children.push(
      new Paragraph({
        alignment: inCover ? AlignmentType.CENTER : undefined,
        spacing: { after: inCover ? 40 : 100 },
        children: inCover
          ? [new TextRun({ text: line.trim().replace(/\*\*/g, ""), bold: true })]
          : inlineRuns(TextRun, line.trim()),
      }),
    );
    i++;
  }

  // If the model never wrote a References heading, still add the photo appendix.
  pushPhotoAppendix();

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "num",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
      },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}-${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
