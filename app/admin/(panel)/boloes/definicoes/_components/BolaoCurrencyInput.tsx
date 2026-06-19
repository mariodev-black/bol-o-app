"use client";

import { useCallback, useEffect, useState } from "react";

type BolaoCurrencyInputProps = {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  disabled?: boolean;
  className?: string;
};

/** Input monetário BRL — armazena centavos, exibe máscara pt-BR. */
export function BolaoCurrencyInput({
  valueCents,
  onChangeCents,
  disabled = false,
  className = "",
}: BolaoCurrencyInputProps) {
  const [display, setDisplay] = useState(() => formatCentsToDisplay(valueCents));

  useEffect(() => {
    setDisplay(formatCentsToDisplay(valueCents));
  }, [valueCents]);

  const handleChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "");
      const cents = digits === "" ? 0 : Number.parseInt(digits, 10);
      if (!Number.isFinite(cents) || cents < 0) return;
      onChangeCents(cents);
      setDisplay(formatCentsToDisplay(cents));
    },
    [onChangeCents],
  );

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-white/40">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="0,00"
        className="w-full rounded-[12px] border border-white/8 bg-[#080808] py-3.5 pl-11 pr-4 text-[18px] font-semibold tabular-nums text-white outline-none transition-colors focus:border-white/20 disabled:opacity-50"
      />
    </div>
  );
}

function formatCentsToDisplay(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCentsBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}
