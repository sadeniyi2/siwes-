"use client";

import Link from "next/link";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/setup"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back
        </Link>
      </div>
      <article className="prose-chat rounded-2xl border border-ink/10 bg-paper-sheet p-6 shadow-card sm:p-8">
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="mb-5 text-xs text-ink-faint">Last updated: {updated}</p>
        {children}
      </article>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Questions? Email{" "}
        <a className="text-accent underline" href="mailto:olivesbooks1@gmail.com">
          olivesbooks1@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
