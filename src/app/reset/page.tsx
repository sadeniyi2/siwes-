"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(j.message || "Couldn't reset your password. Please request a new link.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="stagger mb-6 text-center">
        <p className="animate-float mx-auto mb-3 w-fit text-4xl" aria-hidden>
          🔑
        </p>
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Choose a new password
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-soft">
          Set the password you&apos;ll use to sign in from now on.
        </p>
      </div>

      {!token ? (
        <div className="rounded-2xl border border-margin/30 bg-margin/10 p-5 text-center text-sm text-margin">
          This link is missing its reset code. Please open the most recent reset
          email, or request a new link.
        </div>
      ) : done ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <p className="mb-4 text-sm text-ink-soft">
            Your password has been updated. You can sign in with it now.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="btn-primary w-full py-3"
          >
            Go to log in →
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card"
        >
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              New password
            </span>
            <PasswordInput
              value={next}
              onChange={setNext}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </label>
          <label className="mb-1 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Confirm new password
            </span>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </label>

          {error && (
            <p className="animate-rise mt-3 rounded-xl border border-margin/30 bg-margin/10 px-3.5 py-2.5 text-sm text-margin">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary mt-4 w-full py-3 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save new password →"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
