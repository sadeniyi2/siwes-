"use client";

import { useEffect, useRef, useState } from "react";

let seq = 0;

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

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
        // Validate first so a bad diagram never injects Mermaid's raw
        // "Syntax error" graphic into the page.
        await mermaid.parse(chart);
        const { svg: out } = await mermaid.render(`siwes-diagram-${seq++}`, chart);
        if (!cancelled) {
          setSvg(out);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("unrenderable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  useEffect(() => {
    if (ref.current && svg) ref.current.innerHTML = svg;
  }, [svg]);

  function downloadSVG() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `siwes-diagram-${Date.now()}.svg`);
    URL.revokeObjectURL(url);
  }

  function downloadPNG() {
    const svgEl = ref.current?.querySelector("svg");
    if (!svgEl) return;
    // Rasterize the SVG onto a canvas at 2x for a crisp, report-ready image.
    const rect = svgEl.getBoundingClientRect();
    const vb = svgEl.viewBox?.baseVal;
    const w = Math.ceil((vb && vb.width) || rect.width || 900);
    const h = Math.ceil((vb && vb.height) || rect.height || 600);
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    // Data URL (not blob) so the image reliably loads for rasterizing.
    const dataUrl =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(xml)));
    const scale = 2;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (png) {
          const pngUrl = URL.createObjectURL(png);
          triggerDownload(pngUrl, `siwes-diagram-${Date.now()}.png`);
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        }
      }, "image/png");
    };
    img.src = dataUrl;
  }

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (error) {
    return (
      <div className="mb-3 rounded-lg border border-ink/15 bg-paper px-4 py-3 text-sm text-ink-soft">
        This diagram couldn&apos;t be drawn. Ask the assistant to regenerate it,
        or try a different diagram type.
      </div>
    );
  }

  return (
    <div className="mermaid-block mb-3">
      <div
        ref={ref}
        className="overflow-x-auto rounded-lg border border-ink/15 bg-white p-3"
      />
      {svg && (
        <div className="mt-2 flex gap-2 print:hidden">
          <button
            onClick={downloadPNG}
            className="btn border border-ink/15 bg-paper-sheet px-3 py-1.5 text-xs text-ink-soft hover:border-accent/50 hover:text-accent-dark"
          >
            ⬇ Download PNG
          </button>
          <button
            onClick={downloadSVG}
            className="btn border border-ink/15 bg-paper-sheet px-3 py-1.5 text-xs text-ink-soft hover:border-accent/50 hover:text-accent-dark"
          >
            ⬇ Download SVG
          </button>
        </div>
      )}
    </div>
  );
}
