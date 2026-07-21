"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile } from "@/lib/store";
import { PLANS, TRIAL_DAYS, Tier, loadTier, saveAccess, saveTrial, trialUsed } from "@/lib/access";
import { downloadReceipt, ReceiptData } from "@/lib/receipt";
import Tour, { TourStep } from "@/components/Tour";

const UNLOCK_TOUR: TourStep[] = [
  {
    selector: '[data-tour="trial"]',
    title: "Start here — it's free",
    body: `Tap this to try everything free for ${TRIAL_DAYS} days. No card, no payment. You can decide to pay later.`,
  },
  {
    selector: '[data-tour="plans"]',
    title: "Or pick a plan",
    body: "Basic covers your daily entries and weekly summaries. Pro adds monthly summaries, the full final report, and diagrams.",
  },
];

// Minimal typing for the Flutterwave inline checkout global.
declare global {
  interface Window {
    FlutterwaveCheckout?: (config: Record<string, unknown>) => { close: () => void };
  }
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY || "";
const FLW_SRC = "https://checkout.flutterwave.com/v3.js";

/** Load the Flutterwave inline script and resolve once the global is ready.
 *  Robust against slow networks, an already-loaded script, and re-mounts. */
function loadFlutterwave(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.FlutterwaveCheckout) return resolve(true);

    const done = () => resolve(typeof window.FlutterwaveCheckout === "function");
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${FLW_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = FLW_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });

    // Fallback: poll for the global in case 'load' already fired or is missed.
    const started = Date.now();
    const poll = setInterval(() => {
      if (window.FlutterwaveCheckout) {
        clearInterval(poll);
        resolve(true);
      } else if (Date.now() - started > 8000) {
        clearInterval(poll);
        resolve(false);
      }
    }, 150);
  });
}

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
  const [paying, setPaying] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Preload the payment script as soon as the page opens.
  useEffect(() => {
    loadFlutterwave();
  }, []);

  // Invisible safety net: if one of the invited names lands here, unlock them
  // silently by their profile name. There is no visible free-access UI.
  const claimFreeSilently = useCallback(
    async (candidate: string) => {
      if (!candidate.trim()) return;
      try {
        const res = await fetch("/api/access/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: candidate }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          saveAccess(j.token, j.tier, "free");
          router.replace("/");
        }
      } catch {
        /* stay on the plans page */
      }
    },
    [router],
  );

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setName(p.fullName);
      if (!loadTier()) claimFreeSilently(p.fullName);
    }
    setCurrentTier(loadTier());
    setShowEnded(trialUsed() && !loadTier());
  }, [claimFreeSilently]);

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
    // Show a success screen with a downloadable receipt (instead of redirecting
    // straight away, so the student can save their receipt).
    setReceipt({
      receiptNo: String(j.txRef || `siwes-${j.tier}`).replace(/^siwes-/, "").slice(0, 24).toUpperCase(),
      date: new Date().toISOString(),
      name: name.trim() || j.email || "SIWES student",
      email: (j.email || email).trim(),
      plan: PLANS[(j.tier as Tier) ?? "basic"].name,
      amount: Number(j.amount) || PLANS[(j.tier as Tier) ?? "basic"].price,
      transactionId: j.transactionId ?? transactionId,
      reference: j.txRef || "—",
    });
    setPaying(null);
  }

  async function redeem() {
    if (!code.trim()) return;
    setError(null);
    setRedeeming(true);
    try {
      const res = await fetch("/api/access/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, email }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        saveAccess(j.token, j.tier, "free");
        router.replace("/");
        return;
      }
      setError(j.message || "That code isn't valid.");
    } catch {
      setError("Couldn't check that code right now. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  const [trialBusy, setTrialBusy] = useState(false);
  async function startTrial() {
    setError(null);
    setTrialBusy(true);
    try {
      const res = await fetch("/api/access/trial", { method: "POST" });
      const j = await res.json();
      if (res.ok && j.ok) {
        saveTrial(j.token, j.exp);
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

  async function pay(tier: Tier) {
    setError(null);
    if (!PUBLIC_KEY) {
      setError("Payments aren't set up yet. Please try again later.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email so we can send your receipt.");
      return;
    }
    const plan = PLANS[tier];
    setPaying(tier);

    // Wait for the payment script to be ready (loads it if needed).
    const ok = await loadFlutterwave();
    if (!ok || typeof window.FlutterwaveCheckout !== "function") {
      setError(
        "Couldn't load the payment window. Check your internet connection (or disable any ad-blocker) and try again.",
      );
      setPaying(null);
      return;
    }

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

  if (receipt) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="stagger">
          <p className="animate-pop mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white shadow-lift">
            ✓
          </p>
          <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
            Payment successful
          </h1>
          <p className="mb-1 text-sm text-ink-soft">
            You now have full <strong>{receipt.plan}</strong> access for your
            whole placement. A receipt has been prepared for your records.
          </p>
          <div className="my-5 rounded-2xl border border-ink/10 bg-paper-sheet p-4 text-left text-sm shadow-card">
            <div className="flex justify-between py-1">
              <span className="text-ink-faint">Plan</span>
              <span className="font-medium">{receipt.plan}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-faint">Amount paid</span>
              <span className="font-medium">
                ₦{receipt.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-faint">Receipt #</span>
              <span className="font-mono text-xs">{receipt.receiptNo}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => downloadReceipt(receipt)}
              className="btn-ghost"
            >
              ⭳ Download receipt (PDF)
            </button>
            <button
              onClick={() => router.replace("/")}
              className="btn-primary"
            >
              Enter the app →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
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

      {showEnded && (
        <div className="animate-rise mb-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-margin/40 bg-margin/10 p-5 text-center sm:flex-row sm:text-left">
          <span className="text-3xl" aria-hidden>
            ⌛
          </span>
          <div className="flex-1">
            <p className="font-display text-base font-semibold text-margin">
              Your free trial has ended
            </p>
            <p className="text-sm text-ink-soft">
              Your logbook entries are safe. Choose a plan below to keep writing
              entries, summaries and your final report — it&apos;s a one-time
              payment for the whole placement.
            </p>
          </div>
          <a
            href="#plans"
            className="btn-primary shrink-0"
          >
            See plans ↓
          </a>
        </div>
      )}

      {!currentTier && !showEnded && (
        <div className="animate-rise mb-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-accent-wash p-5 text-center sm:flex-row sm:text-left">
          <span className="text-3xl" aria-hidden>
            ✨
          </span>
          <div className="flex-1">
            <p className="font-display text-base font-semibold text-accent-deep">
              Not sure yet? Try it free for {TRIAL_DAYS} days.
            </p>
            <p className="text-sm text-ink-soft">
              Full access to daily entries and your logbook for {TRIAL_DAYS}{" "}
              days — no payment, no card. Pay only if you like it.
            </p>
          </div>
          <button
            data-tour="trial"
            onClick={startTrial}
            disabled={trialBusy}
            className="btn-primary shrink-0 disabled:opacity-60"
          >
            {trialBusy ? "Starting…" : `Start ${TRIAL_DAYS}-day trial →`}
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
              className="w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none focus:border-accent focus:shadow-glow"
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
              className="w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none focus:border-accent focus:shadow-glow"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Access code <span className="font-normal normal-case tracking-normal text-ink-faint">(optional)</span>
          </span>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  redeem();
                }
              }}
              placeholder="Have a code? Enter it here"
              className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm shadow-card outline-none focus:border-accent focus:shadow-glow"
            />
            <button
              type="button"
              onClick={redeem}
              disabled={redeeming || !code.trim()}
              className="btn shrink-0 border border-ink/15 bg-paper-sheet px-4 text-ink-soft hover:border-accent/50 hover:text-accent-dark disabled:opacity-50"
            >
              {redeeming ? "Checking…" : "Apply"}
            </button>
          </div>
        </label>
      </div>

      {error && (
        <p className="animate-rise mb-4 rounded-xl border border-margin/30 bg-margin/10 px-4 py-2.5 text-sm text-margin">
          {error}
        </p>
      )}

      <div id="plans" data-tour="plans" className="grid items-start gap-4 sm:grid-cols-2">
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
                        : "border border-ink/15 bg-paper-sheet text-ink hover:border-accent/50 hover:text-accent-dark"
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
      <p className="mt-1 text-center text-xs text-ink-faint">
        By starting a trial or paying you agree to our{" "}
        <a href="/terms" className="text-accent underline">
          Terms
        </a>{" "}
        &{" "}
        <a href="/privacy" className="text-accent underline">
          Privacy Policy
        </a>
        .
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

      <Tour steps={UNLOCK_TOUR} storageKey="siwes.tour.unlock.v2" />
    </div>
  );
}
