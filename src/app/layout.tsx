import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Instrument_Sans } from "next/font/google";
import HeaderMeta from "@/components/HeaderMeta";
import Nav from "@/components/Nav";
import TutorialTab from "@/components/TutorialTab";
import "./globals.css";

// Runs before first paint so the correct theme is applied with no flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('siwes.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SIWES Logbook Assistant",
  description:
    "Turn messy daily notes into professional SIWES logbook entries, weekly and monthly summaries, and a final SIWES report.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans text-ink antialiased">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper-sheet/90 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="group flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep font-display text-lg font-bold text-white shadow-lift transition-transform duration-300 group-hover:-rotate-6">
                S
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold leading-tight tracking-tight sm:text-[15px]">
                  SIWES Logbook Assistant
                </p>
                <HeaderMeta />
              </div>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
        <TutorialTab />
        <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-ink-faint print:hidden">
          <Link href="/terms" className="hover:text-accent hover:underline">
            Terms of Use
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-accent hover:underline">
            Privacy Policy
          </Link>
          <p className="mt-1">Your logbook data stays in your browser.</p>
        </footer>
      </body>
    </html>
  );
}
