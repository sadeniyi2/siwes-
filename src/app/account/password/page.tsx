"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadAccessToken,
  loadKind,
  loadTier,
  mustResetPassword,
  saveLogin,
  setMustResetPassword,
} from "@/lib/access";
import PasswordInput from "@/components/PasswordInput";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [forced, setForced] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadAccessToken()) {
      router.replace("/login");
      return;
    }
    setForced(mustResetPassword());
  }, [router]);

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
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": loadAccessToken(),
        },
        body: JSON.stringify({
          newPassword: next,
          currentPassword: forced ? "" : current,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !j.token) {
        setError(j.message || "Couldn't update your password. Please try again.");
        setBusy(false);
        return;
      }
      // Fresh token, and the reset requirement is now cleared.
      saveLogin(j.token, j.tier ?? loadTier(), j.kind ?? loadKind());
      setMustResetPassword(false);
      router.replace("/");
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
          {forced ? "Set your password" : "Change your password"}
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-soft">
          {forced
            ? "You signed in with a temporary password. Choose your own password now — you'll use it every time from here on."
            : "Pick a new password for your account."}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card"
      >
        {!forced && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Current password
            </span>
            <PasswordInput
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
          </label>
        )}
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
          {busy ? "Saving…" : "Save password →"}
        </button>
      </form>
    </div>
  );
}
