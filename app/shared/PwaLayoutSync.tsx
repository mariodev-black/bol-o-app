"use client";

import { useEffect } from "react";
import { syncPwaStandaloneLayoutCss } from "@/app/shared/install-app-banner";
import { useStandalonePwa } from "@/app/shared/useStandalonePwa";

/** Garante variáveis CSS corretas quando o header principal está oculto no PWA. */
export function PwaLayoutSync() {
  const isPwa = useStandalonePwa();

  useEffect(() => {
    if (isPwa) syncPwaStandaloneLayoutCss();
  }, [isPwa]);

  return null;
}
