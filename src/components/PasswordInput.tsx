"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 pr-11 text-sm shadow-card outline-none transition-all duration-200 focus:border-accent focus:shadow-glow";

/** A password field with a show/hide (eye) toggle. */
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        title={show ? "Hide password" : "Show password"}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint transition-colors hover:text-accent-dark"
      >
        {show ? (
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
            <path
              d="M3 3l14 14M8.2 8.3a2.5 2.5 0 003.5 3.5M6.9 5.4A8.2 8.2 0 0110 4.6c4 0 6.9 3 7.8 4.6a1 1 0 010 .8 12 12 0 01-2.2 2.9M4.3 6.9A12.4 12.4 0 002.2 9.6a1 1 0 000 .8C3.1 12 6 15 10 15a8 8 0 002.6-.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
            <path
              d="M2.2 9.6C3.1 8 6 5 10 5s6.9 3 7.8 4.6a1 1 0 010 .8C16.9 12 14 15 10 15s-6.9-3-7.8-4.6a1 1 0 010-.8z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </button>
    </div>
  );
}
