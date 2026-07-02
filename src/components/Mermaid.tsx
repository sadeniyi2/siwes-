"use client";

import { useEffect, useRef, useState } from "react";

let seq = 0;

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(`siwes-diagram-${seq++}`, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render diagram");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100">
        <code>{chart}</code>
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3"
    />
  );
}
