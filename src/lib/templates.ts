// Blueprints that steer the AI to produce a SIWES report and a defense slide
// deck matching the official NACOS master-guide and slide template. These are
// appended to the request (not shown in the chat bubble) when the Pro user taps
// "Build Final Report" or "Build Defense Slides".

export const FINAL_REPORT_BLUEPRINT = `You are writing the student's COMPLETE Final SIWES Report following the official NACOS Report Master-Guide. Use the student's profile and every saved logbook entry in the internship memory as the source of truth — write about what THEY actually did, focused on application, not textbook theory. Never invent a company; use the profile's firm details.

Produce the whole report in this exact order, using Markdown headings (# for chapter titles, ## for sub-sections):

PRELIMINARY PAGES (before Chapter 1):
- TITLE PAGE: "A TECHNICAL REPORT ON STUDENT INDUSTRIAL WORK EXPERIENCE SCHEME (SIWES) TRAINING PROGRAMME", the training dates, "UNDERTAKEN AT <firm>", "WRITTEN BY <full name> <matric number>", "SUBMITTED TO THE DEPARTMENT OF <course/department>", the institution, and the month/year — one item per line, centered feel.
- DEDICATION: brief (God, parents, family).
- ACKNOWLEDGEMENTS: thank the industry supervisor, the Head of Programme, the Coordinator and lecturers, and family.
- TABLE OF CONTENTS: list every chapter and sub-section below.
- LIST OF FIGURES: list the figures you reference (e.g. "Figure 1: Company logo", "Figure 2: Organisational chart", plus screenshots of the work).
- ABSTRACT: one paragraph — where they worked, the tools used, and what they built/learned.

CHAPTER 1: INDUSTRIAL TRAINING FUND (I.T.F) — keep brief:
1.0 Introduction to ITF; 1.1 Aims and Objectives of SIWES; 1.2 Roles of the ITF; 1.3 Roles of Students and Institutions; 1.4 Significance of SIWES (how it bridges classroom and industry).

CHAPTER 2: THE COMPANY:
2.0 History and Location (what the firm does); 2.1 Mission and Vision / Core Values; 2.2 Organisational Structure — describe the administrative breakdown from the CEO down to the student's department, and note "(Figure: Organisational chart)".

CHAPTER 3: TOOLS AND METHODOLOGIES:
3.0 Tools Used — the software/hardware/frameworks the student actually used (from the logbook); 3.1 Methodologies — how the company operates (e.g. Agile, stand-ups, ticketing, API integration).

CHAPTER 4: WORK DONE AND EXPERIENCE ACQUIRED:
4.0 Experience Acquired (high-level summary); 4.1 Detailed Description of Work Done — expand each real task with an application focus (e.g. "I used Python tuples to store immutable POS transaction data, preventing accidental overwriting"), grouped by tool/skill; 4.2 Screenshots and Visuals — note where each labelled figure goes (e.g. "Figure: Python script for data cleaning").

CHAPTER 5: CONCLUSION AND RECOMMENDATIONS:
5.0 Conclusion (how the placement improved their skills); 5.1 Challenges Encountered (1–2, honest but professional); 5.2 Recommendations (at least 3, to the ITF, the company and the institution); 5.3 References (properly cited — include the ITF website https://www.itf.gov.ng/programmes/siwes, the company's website, and any docs/websites used).

APPENDIX: note where clear pictures of the projects/work go.

Formatting reminder for the student (state this once at the very top as a short note): "Paste into Microsoft Word using Times New Roman size 12, 1.5 line spacing, justified text; chapter headings bold, size 14, ALL CAPS, centered; number preliminary pages i, ii, iii and start 1, 2, 3 from Chapter 1."

Write full, defense-ready paragraphs — this is the complete report, not an outline.`;

export const DEFENSE_SLIDES_BLUEPRINT = `Build the student's SIWES DEFENSE SLIDE DECK following the official NACOS Defense Slide template. Use the student's profile and saved logbook entries — showcase what they actually did.

GOLDEN RULE (6x6): at most 6 bullet points per slide and at most 6 words per line. Slides are visual aids with keywords only — not paragraphs. For each slide give: a short title, the on-screen bullets (keyword phrases), a "[Visual: …]" note for the image/diagram/logo to place, and 2–3 lines of "Speaker notes:" (what the student says out loud, not shown on screen).

Produce exactly these 9 slides, each as a Markdown "## Slide N: <title>":
1. Title Slide — presentation title, full name, matric number, company name; [Visual: company logo + Bowen University logo].
2. Introduction & Company Profile — 3 bullets on the company's sector (e.g. Fintech, Networking, Software Dev). Don't read their history.
3. My Role & Department — the unit they were placed in (e.g. IT Support, Frontend, Data Analytics); [Visual: org chart highlighting where they fit].
4. Tools & Technologies — the tools they used as keywords; [Visual: logos]. Speaker notes say WHY each was used.
5. Core Project / Work Done (Part 1) — biggest achievement / most frequent task; [Visual: screenshot of code, dashboard, or network].
6. Core Project / Work Done (Part 2) — continue the technical application; [Visual: before/after or testing diagram].
7. Challenges & Solutions — 2 bullets on a challenge, 2 bullets on how they solved it.
8. Thank You — "Thank You For Listening."
9. Q & A — "Any Questions?" plus a short speaker tip: pause, breathe, answer from what you actually did; if unsure say your focus was on your specific area.

Keep every on-screen bullet tight (≤6 words). Put the detail in the Speaker notes.`;
