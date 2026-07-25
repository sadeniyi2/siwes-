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

export async function exportMarkdownDocx(
  markdown: string,
  fileBase = "siwes-document",
): Promise<void> {
  const d = await import("docx");
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = d;

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
      children.push(
        new Paragraph({
          heading: HEADINGS[h[1].length - 1],
          spacing: { before: 160, after: 60 },
          children: inlineRuns(TextRun, h[2]),
        }),
      );
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

    // Plain paragraph
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: inlineRuns(TextRun, line.trim()),
      }),
    );
    i++;
  }

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
