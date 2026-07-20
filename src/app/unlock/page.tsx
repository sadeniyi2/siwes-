"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile } from "@/lib/store";
import { PLANS, TRIAL_LIMIT, Tier, loadTier, saveAccess, saveTrial } from "@/lib/access";

// Minimal typing for the Flutterwave inline checkout global.
declare global {
  interface Window {
    FlutterwaveCheckout?: (config: Record<string, unknown>) => { close: () => void };
  }
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY || "";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#10b981" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#e0656b" opacity="0.9" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function UnlockPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [freeName, setFreeName] = useState("");
  const [freeBusy, setFreeBusy] = useState(false);
  const [freeError, setFreeError] = useState<string | null>(null);

  const claimFree = useCallback(
    async (candidate: string, silent = false) => {
      if (!candidate.trim()) {
        if (!silent) setFreeError("Please enter your full name.");
        return;
      }
      setFreeBusy(true);
      setFreeError(null);
      try {
        const res = await fetch("/api/access/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: candidate }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          saveAccess(j.token, j.tier);
          router.replace("/");
          return;
        }
        if (!silent) {
          setFreeError(
            j.message || "That name isn't on the free-access list.",
          );
        }
      } catch {
        if (!silent) setFreeError("Something went wrong. Please try again.");
      } finally {
        setFreeBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setName(p.fullName);
      setFreeName(p.fullName);
      // Silently unlock if this profile name is on the free-access list.
      if (!loadTier()) claimFree(p.fullName, true);
    }
    setCurrentTier(loadTier());
  }, [claimFree]);

  async function verify(transactionId: string | number) {
    const res = await fetch("/api/pay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      setError(j.message || "We couldn't confirm your payment. Please contact support.");
      setPaying(null);
      return;
    }
    saveAccess(j.token, j.tier, "paid");
    router.replace("/");
  }

  const [trialBusy, setTrialBusy] = useState(false);
  async function startTrial() {
    setError(null);
    setTrialBusy(true);
    try {
      const res = await fetch("/api/access/trial", { method: "POST" });
      const j = await res.json();
      if (res.ok && j.ok) {
        saveTrial(j.token);
        router.replace("/");
        return;
      }
      setError(j.message || "Couldn't start the trial. Please try again.");
    } catch {
      setError("Couldn't start the trial. Please try again.");
    } finally {
      setTrialBusy(false);
    }
  }

  function pay(tier: Tier) {
    setError(null);
    if (!PUBLIC_KEY) {
      setError("Payments aren't set up yet. Please try again later.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email so we can send your receipt.");
      return;
    }
    if (!ready || !window.FlutterwaveCheckout) {
      setError("Payment is still loading — give it a second and try again.");
      return;
    }
    const plan = PLANS[tier];
    setPaying(tier);
    window.FlutterwaveCheckout({
      public_key: PUBLIC_KEY,
      tx_ref: `siwes-${tier}-${Date.now()}`,
      amount: plan.price,
      currency: "NGN",
      payment_options: "card,banktransfer,ussd",
      customer: { email: email.trim(), name: name.trim() || email.trim() },
      customizations: {
        title: "SIWES Logbook Assistant",
        description: `${plan.name} plan — one-time access`,
      },
      callback: (data: { transaction_id?: string | number; status?: string }) => {
        if (data?.transaction_id) {
          verify(data.transaction_id);
        } else {
          setError("Payment was not completed.");
          setPaying(null);
        }
      },
      onclose: () => setPaying((p) => (p === tier ? null : p)),
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Script
        src="https://checkout.flutterwave.com/v3.js"
        onLoad={() => setReady(true)}
      />

      <div className="stagger mb-6 text-center">
        <p className="animate-float mx-auto mb-3 w-fit text-4xl" aria-hidden>
          🔓
        </p>
        <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Unlock your SIWES assistant
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-ink-soft">
          A one-time payment gives you full access for your whole placement — no
          subscription. Choose the plan that fits, pay securely with
          Flutterwave, and you&apos;re in.
        </p>
      </div>

      {!currentTier && (
        <div className="animate-rise mb-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-accent-wash p-5 text-center sm:flex-row sm:text-left">
          <span className="text-3xl" aria-hidden>
            ✨
          </span>
          <div className="flex-1">
            <p className="font-display text-base font-semibold text-accent-deep">
              Not sure yet? Try it free first.
            </p>
            <p className="text-sm text-ink-soft">
              Turn {TRIAL_LIMIT} of your real work days into professional
              logbook entries — no payment, no card. Pay only if you like it.
            </p>
          </div>
          <button
            onClick={startTrial}
            disabled={trialBusy}
            className="btn-primary shrink-0 disabled:opacity-60"
          >
            {trialBusy ? "Starting…" : `Start free trial →`}
          </button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-card sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm shadow-card outline-none focus:border-accent focus:shadow-glow"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Email <span className="text-margin">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com — for your receipt"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm shadow-card outline-none focus:border-accent focus:shadow-glow"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="animate-rise mb-4 rounded-xl border border-margin/30 bg-margin/10 px-4 py-2.5 text-sm text-margin">
          {error}
        </p>
      )}

      {/* Free access for invited names */}
      <details className="group mb-5 rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-4 shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-800">
          <span aria-hidden>🎟️</span>
          Have free access? Enter your name
          <span className="ml-auto text-emerald-600 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-3">
          <p className="mb-2 text-xs leading-relaxed text-emerald-800/80">
            If you&apos;ve been given free access, type your full name exactly as
            you were told and tap unlock — no payment needed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && claimFree(freeName)}
              placeholder="Your full name"
              className="flex-1 rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              onClick={() => claimFree(freeName)}
              disabled={freeBusy}
              className="btn shrink-0 bg-emerald-600 px-5 py-2.5 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {freeBusy ? "Checking…" : "Unlock free"}
            </button>
          </div>
          {freeError && (
            <p className="animate-rise mt-2 text-xs font-medium text-margin">
              {freeError}
            </p>
          )}
        </div>
      </details>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {(["basic", "pro"] as Tier[]).map((id) => {
          const plan = PLANS[id];
          const isPro = id === "pro";
          const owned = currentTier === id || (currentTier === "pro" && id === "basic");
          return (
            <div
              key={id}
              className={`animate-rise relative flex flex-col rounded-2xl border p-6 shadow-sheet ${
                isPro
                  ? "border-accent bg-gradient-to-b from-accent-wash to-paper-sheet"
                  : "border-ink/10 bg-paper-sheet"
              }`}
            >
              {isPro && (
                <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lift">
                  Most complete
                </span>
              )}
              <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
              <p className="mb-3 text-xs text-ink-soft">{plan.tagline}</p>
              <p className="mb-4 font-display text-3xl font-bold text-ink">
                ₦{plan.price.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-ink-faint">
                  once
                </span>
              </p>

              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                What you get
              </p>
              <ul className="mb-4 space-y-1.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex gap-2 text-[13px] leading-snug text-ink-soft">
                    <Check />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {plan.limitations.length > 0 && (
                <>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    {isPro ? "Note" : "Not included"}
                  </p>
                  <ul className="mb-5 space-y-1.5">
                    {plan.limitations.map((l) => (
                      <li key={l} className="flex gap-2 text-[13px] leading-snug text-ink-faint">
                        <Cross />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-auto">
                {owned ? (
                  <button
                    onClick={() => router.replace("/")}
                    className="btn w-full bg-emerald-600 py-3 text-white"
                  >
                    ✓ You have this — Enter app
                  </button>
                ) : (
                  <button
                    onClick={() => pay(id)}
                    disabled={paying !== null}
                    className={`btn w-full py-3 disabled:opacity-60 ${
                      isPro
                        ? "bg-accent text-white hover:bg-accent-dark hover:shadow-lift"
                        : "border border-ink/15 bg-white text-ink hover:border-accent/50 hover:text-accent-dark"
                    }`}
                  >
                    {paying === id
                      ? "Opening payment…"
                      : `Pay ₦${plan.price.toLocaleString()} · Get ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-ink-faint">
        Secure payment by Flutterwave · card, bank transfer & USSD · your receipt
        is emailed to you. Access is tied to this browser.
      </p>
      <p className="mt-2 text-center text-xs text-ink-faint">
        New here?{" "}
        <a
          href="/SIWES-Logbook-Assistant-Guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline underline-offset-2"
        >
          Read the quick start guide
        </a>
        .
      </p>
    </div>
  );
}
