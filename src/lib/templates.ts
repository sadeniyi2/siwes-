// Blueprints that steer the AI to produce a SIWES report and a defense slide
// deck matching the official NACOS master-guide and slide template. These are
// appended to the request (not shown in the chat bubble) when the Pro user taps
// "Build Final Report" or "Build Defense Slides".

export const FINAL_REPORT_BLUEPRINT = `You are writing the student's COMPLETE Final SIWES Technical Report. Use the student's profile and EVERY saved logbook entry in the internship memory as the source of truth — write about what THEY actually did. Never invent a company; use the profile's firm. Pull these real values from the profile and use them everywhere (never leave a placeholder for data you already have): FULL NAME, MATRIC NUMBER, FIRM/COMPANY, the student's DEPARTMENT/SECTION at the firm, INSTITUTION (their university), COURSE (their discipline), and the training START and END dates.

WRITE IT IN A HUMAN VOICE (critical — an AI-sounding report gets flagged):
- Write the work chapters (4 and 5) in the FIRST PERSON from the student's real saved entries, tools and phrasing — it should read like the same person who chatted with you.
- Vary sentence length, keep language plain, and follow the "sound like the real student" rules (no delve/leverage/utilize/robust/comprehensive/seamless/pivotal/"in conclusion"/"it is worth noting", etc.).
- No textbook padding — every point ties to what the student actually did.
- Use only a FEW short bracketed prompts (3–6 in the WHOLE report) where a personal detail genuinely helps, e.g. "[Add the exact project name here]". Never bracket data already in the profile.

Output the whole report as Markdown in EXACTLY this order and structure. Use "# " for each TOP-LEVEL page/chapter title (each starts on a new page) and "## " / "### " for sub-sections.

# COVER PAGE
Write each of these as its own centered line (bold), filled from the profile:
A TECHNICAL REPORT ON
STUDENT INDUSTRIAL WORK EXPERIENCE SCHEME (SIWES) TRAINING PROGRAMME
(<START DATE> TO <END DATE>) UNDERTAKEN AT
<FIRM> (<DEPARTMENT/SECTION>)
BY
<FULL NAME>
MATRIC NO: <MATRIC NUMBER>
SUBMITTED TO
THE DEPARTMENT OF <COURSE>, <appropriate faculty — e.g. FACULTY OF SCIENCE for a science course>
<INSTITUTION>
IN PARTIAL FULFILMENT OF THE REQUIREMENTS FOR THE AWARD OF THE DEGREE OF <degree, e.g. BACHELOR OF SCIENCE (B.Sc. HONS)> IN <COURSE>
<MONTH, YEAR of the end date>
Then add a figure line: ![Figure: Institution / company logo](figure)

# DEDICATION
Short, warm, first person (God, parents, family).

# ACKNOWLEDGEMENTS
Thank the industry/company supervisor (use their name if in the profile), the Head of Department/Programme, the SIWES coordinator and lecturers, colleagues at the firm, and family.

# ABSTRACT
One tight paragraph: where they interned, the department, the main tools, and what they built/learned.

# TABLE OF CONTENTS
List every section that follows with its title (Dedication, Acknowledgements, Abstract, Chapters 1–5 and their sub-sections, Appendix, References). Keep it simple — one per line.

# CHAPTER 1: INDUSTRIAL TRAINING FUND (I.T.F)
## 1.0 Introduction to the ITF
## 1.1 Aims and Objectives of SIWES
## 1.2 Roles of the ITF
## 1.3 Roles of Students
## 1.4 Roles of Institutions
## 1.5 Significance of SIWES (how it bridges classroom and industry)
Keep this chapter concise and factual.

# CHAPTER 2: THE COMPANY
## 2.0 History and Location (what <FIRM> does, where it is)
## 2.1 Mission, Vision and Core Values
## 2.2 Organisational Structure — describe the breakdown from the top down to the student's department. End with: ![Figure 2.1: Organisational structure of <FIRM>, showing where I was placed](figure)

# CHAPTER 3: TOOLS AND METHODOLOGIES
## 3.0 Tools and Technologies Used — the actual software/hardware/frameworks/languages from the logbook, each with one line on what it was used for.
## 3.1 Engineering Methodologies — how the team actually works (e.g. Agile, stand-ups, ticketing, version control, code review, API integration) as the student experienced it.

# CHAPTER 4: WORK DONE AND EXPERIENCE ACQUIRED
## 4.0 Overview of Experience Acquired
## 4.1 Weekly Summary of Work Done
Build a Markdown table summarising the placement week by week, from the student's real entries. Use EXACTLY these columns:
| Week | Dates | Primary Core Activities & Tasks Completed | Core Tools Used | Output / Deliverable |
One row per week that has entries. Keep each cell concise.
## 4.2 Detailed Description of Work Done — expand the main tasks in the first person with an APPLICATION focus (e.g. "I used Python tuples to store immutable POS transaction records so they couldn't be overwritten"), grouped by tool/skill/project. Where a screenshot belongs, add a figure line like: ![Figure 4.x: <what the screenshot shows>](figure)
## 4.3 Skills and Competencies Gained

# CHAPTER 5: CONCLUSION AND RECOMMENDATIONS
## 5.0 Conclusion (how the placement improved their skills)
## 5.1 Challenges Encountered (1–2, honest but professional)
## 5.2 Recommendations (at least 3 — to the ITF, the company, and the institution)

# APPENDIX: TECHNICAL VISUALS
A short intro line, then a captioned figure line for each key visual the student should attach, numbered Figure A.1, A.2, … e.g.:
![Figure A.1: <diagram/screenshot of a real thing they built>](figure)
Base the captions on the student's actual work (architectures, dashboards, code, network setups). 3–6 figures.

# REFERENCES
This is the LAST page. List proper references used, including the ITF SIWES page (https://www.itf.gov.ng/programmes/siwes), the company's official website, and any documentation/tools/websites referenced in the report. Number them.

RULES:
- Every figure MUST use the Markdown image form on its own line: ![Figure N: caption](figure) — the download turns these into labelled picture slots the student drops their screenshot into, and auto-inserts any photos they attached to their logbook entries.
- Start the whole output with ONE short note on its own line: "Tip: tap Download as Word for the formatted report (Times New Roman 12, 1.5 spacing, each chapter and the references on their own page). Replace every [bracket] and figure slot with your real detail before printing."
- Write full, defense-ready paragraphs. This is the complete report, not an outline.`;

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

export const HUMANIZE_BLUEPRINT = `Rewrite your most recent report or summary so it clearly reads like the student wrote it themselves by hand — keep ALL the same facts, structure and headings, but make the voice human:
- Put the work sections in the first person ("I did…", "I learned…", "At first I struggled with…").
- Vary the sentence lengths and break up any perfectly balanced or repetitive sentences.
- Replace every AI-sounding word with plain student English (delve, leverage, utilize, robust, comprehensive, seamless, pivotal, crucial, testament, realm, underscore, foster, "in conclusion", "it is worth noting", "plays a vital role", etc.).
- Cut textbook padding; keep only what the student actually did, in their own words from the saved entries and raw notes.
- Add 2–4 short bracketed prompts like "[add a specific example here]" where a personal detail would make it stronger.
Do NOT invent new facts — only rephrase what is already there. Output the full rewritten version.`;
