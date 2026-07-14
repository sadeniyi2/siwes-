"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Assistant" },
  { href: "/logbook", label: "Logbook" },
  { href: "/setup", label: "⚙ Profile" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop / tablet: inline pill nav */}
      <nav className="hidden gap-1 rounded-full border border-ink/10 bg-paper p-1 text-sm sm:flex">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-all duration-200 ${
                active
                  ? "bg-accent text-white shadow-lift"
                  : "text-ink-soft hover:bg-accent-soft hover:text-accent-dark"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: hamburger (stack lines) button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-ink/10 bg-paper transition-colors hover:border-accent/40 sm:hidden"
      >
        <span
          className={`h-0.5 w-5 rounded-full bg-ink transition-all duration-300 ${
            open ? "translate-y-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`h-0.5 w-5 rounded-full bg-ink transition-all duration-200 ${
            open ? "scale-x-0 opacity-0" : ""
          }`}
        />
        <span
          className={`h-0.5 w-5 rounded-full bg-ink transition-all duration-300 ${
            open ? "-translate-y-[7px] -rotate-45" : ""
          }`}
        />
      </button>

      {/* Mobile: slide-down sheet */}
      <div
        className={`fixed inset-0 z-40 sm:hidden ${
          open ? "" : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          className={`absolute inset-x-0 top-0 origin-top border-b border-ink/10 bg-paper-sheet px-4 pb-4 pt-20 shadow-sheet transition-all duration-300 ${
            open
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0"
          }`}
        >
          <div className="stagger flex flex-col gap-1.5">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 ${
                    active
                      ? "bg-accent text-white shadow-lift"
                      : "bg-paper text-ink-soft hover:bg-accent-soft hover:text-accent-dark"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
