"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [matric, setMatric] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matric: matric.trim(), email: email.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      setSent(
        j.message ||
          "If that matric number has an account, we've sent a reset link to the email on file.",
      );
    } catch {
      setSent(
        "We've noted your request. If you don't hear back soon, please contact the owner directly.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="stagger mb-6 text-center">
        <p className="animate-float mx-auto mb-3 w-fit text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Forgot your password?
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-soft">
          Enter your matric number and we&apos;ll email you a link to set a new
          password. No email on your account? Your coordinator can reset it for you.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <p className="mb-4 text-sm text-ink-soft">{sent}</p>
          <button
            onClick={() => router.replace("/login")}
            className="btn-primary w-full py-3"
          >
            Back to log in
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card"
        >
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Matric / Reg number
            </span>
            <input
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              placeholder="e.g. 20/52HA093"
              autoComplete="username"
              className={inputCls}
            />
          </label>
          <label className="mb-1 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Email{" "}
              <span className="font-normal normal-case tracking-normal text-ink-faint">
                (only if none is saved on your account yet)
              </span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={busy || matric.trim().length < 4}
            className="btn-primary mt-4 w-full py-3 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Request a reset →"}
          </button>
          <p className="mt-4 text-center text-sm">
            <a href="/login" className="font-medium text-accent underline underline-offset-2">
              Back to log in
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
