"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadAccessToken,
  saveLogin,
  setMustResetPassword,
  Kind,
  Tier,
} from "@/lib/access";
import { loadProfile } from "@/lib/store";

type Mode = "login" | "signup";

const inputCls =
  "w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow";

interface AuthResponse {
  ok?: boolean;
  message?: string;
  token?: string;
  tier?: Tier | null;
  kind?: Kind | null;
  hasAccess?: boolean;
  mustReset?: boolean;
  recovered?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Skip the form. Prefill matric/name from any local profile.
  useEffect(() => {
    if (loadAccessToken()) router.replace("/");
    const p = loadProfile();
    if (p) {
      if (p.matricNumber) setMatric((m) => m || p.matricNumber || "");
      if (p.fullName) setName((n) => n || p.fullName || "");
    }
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const mat = matric.trim();
    if (mat.length < 4) {
      setError("Please enter your matric / registration number.");
      return;
    }
    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matric: mat,
          password,
          name: name.trim(),
          email: email.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as AuthResponse;
      if (!res.ok || !j.ok || !j.token) {
        setError(
          j.message ||
            (mode === "login"
              ? "Couldn't sign you in. Check your matric number and password."
              : "Couldn't create your account. Please try again."),
        );
        setBusy(false);
        return;
      }
      // Store the session. tier/kind are null when the account has no plan yet.
      saveLogin(j.token, j.tier ?? null, j.kind ?? null);
      setMustResetPassword(!!j.mustReset);
      if (j.mustReset) {
        router.replace("/account/password");
        return;
      }
      // Into the app — the access gate routes to /setup (no profile) or /unlock
      // (no plan), and the home page syncs the logbook to/from the account.
      router.replace("/");
    } catch {
      setError("Couldn't reach the server. Please check your connection.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="stagger mb-6 text-center">
        <p className="animate-float mx-auto mb-3 w-fit text-4xl" aria-hidden>
          📓
        </p>
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-soft">
          Sign in with your matric number. Your logbook is saved to your account,
          so it stays safe even if you clear your browser or switch phones.
        </p>
      </div>

      <div className="mb-5 flex rounded-full border border-ink/10 bg-paper p-1 text-sm">
        {(["login", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full px-4 py-2 font-medium transition-all duration-200 ${
              mode === m
                ? "bg-accent text-white shadow-lift"
                : "text-ink-soft hover:text-accent-dark"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

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

        {mode === "signup" && (
          <>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Your name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ada Obi"
                autoComplete="name"
                className={inputCls}
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Email{" "}
                <span className="font-normal normal-case tracking-normal text-ink-faint">
                  (optional — for your receipt)
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
          </>
        )}

        <label className="mb-1 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={inputCls}
          />
        </label>

        {mode === "login" && (
          <div className="mt-2 text-right">
            <a
              href="/forgot"
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password?
            </a>
          </div>
        )}

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
          {busy
            ? mode === "login"
              ? "Signing you in…"
              : "Creating your account…"
            : mode === "login"
              ? "Log in →"
              : "Create account →"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        {mode === "login" ? (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="font-medium text-accent underline underline-offset-2"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="font-medium text-accent underline underline-offset-2"
            >
              Log in
            </button>
          </>
        )}
      </p>

      <p className="mt-5 text-center text-xs text-ink-faint">
        By continuing you agree to our{" "}
        <a href="/terms" className="text-accent underline">
          Terms
        </a>{" "}
        &{" "}
        <a href="/privacy" className="text-accent underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
