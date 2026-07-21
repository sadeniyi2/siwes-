"use client";

import { usePathname } from "next/navigation";

/**
 * A prominent, always-visible "Tutorial" handle anchored to the right edge of
 * the screen. Clicking it fires the global "siwes-start-tour" event that the
 * <Tour> component listens for. Hidden off the tour pages and when printing.
 */
export default function TutorialTab() {
  const pathname = usePathname();

  // The guided tour only exists on these pages; hide the handle elsewhere.
  const onTourPage =
    pathname === "/" || pathname === "/logbook" || pathname === "/unlock";
  if (!onTourPage) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new Event("siwes-start-tour"))}
      aria-label="Start the guided tutorial"
      className="group fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-l-2xl bg-accent py-2.5 pl-3 pr-3.5 text-sm font-semibold text-white shadow-lift transition-all duration-200 hover:bg-accent-dark hover:pr-5 print:hidden"
    >
      <span className="animate-nudge-x text-base leading-none">◄</span>
      Tutorial
    </button>
  );
}
