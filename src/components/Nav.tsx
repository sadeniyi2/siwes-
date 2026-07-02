"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Assistant" },
  { href: "/logbook", label: "Logbook" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-full border border-ink/10 bg-paper p-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-4 py-1.5 font-medium transition-all duration-200 ${
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
  );
}
