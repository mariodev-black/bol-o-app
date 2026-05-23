"use client";

import { useEffect, useState } from "react";
import { isStandalonePwa } from "@/lib/push/client";

/** Detecta app instalado (standalone) após hidratação. */
export function useStandalonePwa(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sync = () => setStandalone(isStandalonePwa());
    sync();

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return standalone;
}
