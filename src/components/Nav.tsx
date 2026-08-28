"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { loadMatric, logout } from "@/lib/access";

const LINKS = [
  { href: "/", label: "Assistant" },
  { href: "/logbook", label: "Logbook" },
  { href: "/setup", label: "⚙ Profile" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [matric, setMatric] = useState("");

  // Track the signed-in account so we can show it and offer a way out.
  useEffect(() => {
    const sync = () => setMatric(loadMatric());
    sync();
    window.addEventListener("siwes-access-change", sync);
    return () => window.removeEventListener("siwes-access-change", sync);
  }, [pathname]);

  function signOut() {
    setOpen(false);
    logout();
    router.replace("/login");
  }

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
      <nav className="hidden items-center gap-1 rounded-full border border-ink/10 bg-paper p-1 text-sm sm:flex">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              data-tour={href === "/logbook" ? "nav-logbook" : undefined}
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
        <button
          onClick={() => window.dispatchEvent(new Event("siwes-start-tour"))}
          title="Show the tutorial"
          aria-label="Show the tutorial"
          className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent-dark"
        >
          ?
        </button>
        <ThemeToggle className="h-7 w-7 text-ink-faint" />
        {matric && (
          <button
            onClick={signOut}
            title={`Signed in as ${matric} — log out`}
            aria-label="Log out"
            className="ml-0.5 flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink-faint transition-colors hover:bg-margin/10 hover:text-margin"
          >
            <span aria-hidden>⏻</span> Log out
          </button>
        )}
      </nav>

      {/* Mobile: theme toggle sits beside the hamburger, always reachable */}
      <ThemeToggle className="h-10 w-10 border border-ink/10 bg-paper text-ink-soft hover:border-accent/40 sm:hidden" />

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
            <button
              onClick={() => {
                setOpen(false);
                setTimeout(
                  () => window.dispatchEvent(new Event("siwes-start-tour")),
                  350,
                );
              }}
              className="rounded-xl bg-paper px-4 py-3 text-left text-base font-medium text-ink-soft transition-all duration-200 hover:bg-accent-soft hover:text-accent-dark"
            >
              ❓ Show tutorial
            </button>
            {matric && (
              <>
                <p className="truncate px-4 pt-2 text-xs text-ink-faint">
                  Signed in as {matric}
                </p>
                <button
                  onClick={signOut}
                  className="rounded-xl bg-paper px-4 py-3 text-left text-base font-medium text-margin transition-all duration-200 hover:bg-margin/10"
                >
                  ⏻ Log out
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
