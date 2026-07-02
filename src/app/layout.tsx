import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Instrument_Sans } from "next/font/google";
import HeaderMeta from "@/components/HeaderMeta";
import Nav from "@/components/Nav";
import "./globals.css";

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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans text-ink antialiased">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper-sheet/90 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep font-display text-lg font-bold text-white shadow-lift transition-transform duration-300 group-hover:-rotate-6">
                S
              </span>
              <div>
                <p className="font-display text-[15px] font-semibold leading-tight tracking-tight">
                  SIWES Logbook Assistant
                </p>
                <HeaderMeta />
              </div>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
