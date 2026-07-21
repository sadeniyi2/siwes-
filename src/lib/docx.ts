"use client";

import {
  LogEntry,
  Profile,
  WORK_DAYS,
  addDays,
  formatLongDate,
  mondayOf,
  weekNumberOf,
} from "./types";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Build and download a real .docx of the student's logbook. The heavy `docx`
 * library is imported lazily so it only loads when the student clicks export.
 */
export async function exportLogbookDocx(
  profile: Profile,
  entries: LogEntry[],
): Promise<number> {
  const d = await import("docx");
  const {
    AlignmentType,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    HeadingLevel,
  } = d;

  const byDate = new Map(entries.map((e) => [e.date, e]));
  const firstMonday = mondayOf(profile.startDate);
  const totalWeeks = profile.durationWeeks ?? 24;

  const profileLines = (): InstanceType<typeof Paragraph>[] => {
    const rows: [string, string | undefined][] = [
      ["Name", profile.fullName],
      ["Matric/Reg No.", profile.matricNumber],
      ["Institution", profile.institution],
      ["Course", profile.course],
      ["Firm/Organization", profile.firmName],
      ["Firm address", profile.firmAddress],
      ["Department/Section", profile.department],
      ["Industry supervisor", profile.supervisorName],
      ["Start date", profile.startDate ? formatLongDate(profile.startDate) : undefined],
      ["Duration", profile.durationWeeks ? `${profile.durationWeeks} weeks` : undefined],
    ];
    return rows
      .filter(([, v]) => !!v)
      .map(
        ([k, v]) =>
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `${k}: `, bold: true }),
              new TextRun({ text: v as string }),
            ],
          }),
      );
  };

  const descriptionCell = (entry: LogEntry | undefined) => {
    if (!entry) return [new Paragraph({ text: "" })];
    const parts = [new Paragraph({ text: entry.description || "" })];
    if (entry.skills && entry.skills.length) {
      parts.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            new TextRun({ text: "Skills: ", bold: true, size: 18 }),
            new TextRun({ text: entry.skills.join(", "), italics: true, size: 18 }),
          ],
        }),
      );
    }
    for (const photo of entry.photos ?? []) {
      try {
        parts.push(
          new Paragraph({
            spacing: { before: 80 },
            children: [
              new ImageRun({
                type: "jpg",
                data: dataUrlToBytes(photo),
                transformation: { width: 200, height: 150 },
              }),
            ],
          }),
        );
      } catch {
        /* skip an image that can't be decoded */
      }
    }
    return parts;
  };

  const weekTable = (weekStart: string) => {
    const header = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({ children: [new TextRun({ text: "DAYS / DATE", bold: true })] }),
          ],
        }),
        new TableCell({
          width: { size: 78, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "DESCRIPTION OF WORK DONE", bold: true })],
            }),
          ],
        }),
      ],
    });
    const rows = WORK_DAYS.map((day, i) => {
      const date = addDays(weekStart, i);
      const entry = byDate.get(date);
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: day, bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: shortDate(date), size: 18 })] }),
            ],
          }),
          new TableCell({
            width: { size: 78, type: WidthType.PERCENTAGE },
            children: descriptionCell(entry),
          }),
        ],
      });
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [header, ...rows],
    });
  };

  // Only weeks that actually have entries.
  const weekStarts: string[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const start = addDays(firstMonday, i * 7);
    if (WORK_DAYS.some((_, dy) => byDate.has(addDays(start, dy)))) weekStarts.push(start);
  }

  const body: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SIWES STUDENT LOGBOOK", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Weekly Progress Chart", italics: true })],
    }),
    ...profileLines(),
    new Paragraph({ text: "", spacing: { after: 120 } }),
  ];

  if (weekStarts.length === 0) {
    body.push(new Paragraph({ text: "No entries have been saved yet." }));
  }

  weekStarts.forEach((start) => {
    const weekNo = weekNumberOf(start, profile.startDate);
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: `WEEK ${weekNo} — ${formatLongDate(start)} to ${formatLongDate(addDays(start, 5))}`,
            bold: true,
          }),
        ],
      }),
    );
    body.push(weekTable(start));
  });

  const doc = new Document({ sections: [{ children: body }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (profile.fullName || "student").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.href = url;
  a.download = `siwes-logbook-${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return weekStarts.length;
}
