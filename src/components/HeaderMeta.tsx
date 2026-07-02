"use client";

import { useEffect, useState } from "react";
import { loadProfile } from "@/lib/store";
import { formatLongDate } from "@/lib/types";

export default function HeaderMeta() {
  const [meta, setMeta] = useState("Your industrial training companion");

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setMeta(`${p.firmName} · since ${formatLongDate(p.startDate)}`);
    }
    const onStorage = () => {
      const np = loadProfile();
      if (np) setMeta(`${np.firmName} · since ${formatLongDate(np.startDate)}`);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <p className="max-w-[180px] truncate text-xs leading-tight text-ink-faint sm:max-w-[280px]">
      {meta}
    </p>
  );
}
