# SIWES Logbook & Report Assistant

A personal assistant for the Student Industrial Work Experience Scheme (SIWES). Describe your day in plain, messy English and it produces a professional **35–70 word** entry that fits the small "Description of Work Done" box in the official SIWES logbook — then remembers everything to build your weekly summaries, monthly summaries, and final SIWES report.

Internship: **starts Monday, 13 July 2026 · Monday–Saturday**.

## Features

- **Assistant** — chat page that turns daily notes into concise, professional logbook entries (with a live word-count badge and one-click "Save to logbook" / "Copy text").
- **Logbook** — a digital Weekly Progress Chart that mirrors the physical SIWES page (MON–SAT, Description of Work Done, Section Attached), with week navigation, inline editing, and print-friendly output.
- **Generate Weekly Summary / Monthly Summary / Build Final Report** — one-click buttons that use every saved entry as memory, so summaries and the final report stay consistent with the daily log.
- **Smart visuals** — when your day involves systems, pipelines, or databases, the assistant offers diagram buttons (flowcharts, ER diagrams, architectures…) rendered as Mermaid figures for the report appendix.
- Entries are stored in your browser (localStorage) — no database to set up.

## Deploy to Vercel

1. Push this repository to GitHub (already done if you're reading this there).
2. Get a **free** Gemini API key (no credit card needed) at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Go to [vercel.com/new](https://vercel.com/new) and import the repository. Vercel auto-detects Next.js — no build settings needed.
4. Add one environment variable: `GEMINI_API_KEY`.
5. Deploy.

## Run locally

```bash
npm install
cp .env.example .env.local   # then paste your GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000.

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Google Gemini API (`gemini-2.5-flash`, free tier, streaming) · Mermaid · react-markdown
