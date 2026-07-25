"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useRef } from "react";

export type QuantitySelectorProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
};

export function QuantitySelector({
  value,
  min = 1,
  max = 20,
  onChange,
  disabled = false,
  label = "Quantidade",
}: QuantitySelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, Math.trunc(n) || min)),
    [min, max],
  );

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    onChange(clamp(value - 1));
  }, [clamp, disabled, onChange, value]);

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    onChange(clamp(value + 1));
  }, [clamp, disabled, onChange, value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const raw = e.target.value.replace(/[^\d]/g, "");
      if (raw === "") {
        onChange(min);
        return;
      }
      const parsed = Number.parseInt(raw, 10);
      onChange(clamp(parsed));
    },
    [clamp, disabled, min, onChange],
  );

  const handleBlur = useCallback(() => {
    if (disabled) return;
    onChange(clamp(value));
  }, [clamp, disabled, onChange, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(clamp(value - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onChange(clamp(value + 1));
      } else if (e.key === "Enter") {
        inputRef.current?.blur();
      }
    },
    [clamp, disabled, onChange, value],
  );

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/45">{label}</p>
      <div
        className={`inline-flex h-12 items-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.025] transition-colors ${disabled ? "opacity-50" : ""}`}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || atMin}
          aria-label="Diminuir quantidade"
          className="flex h-full w-12 items-center justify-center text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        >
          <Minus className="size-4" strokeWidth={2.5} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Quantidade"
          className="h-full w-16 border-x border-white/10 bg-transparent text-center text-[18px] font-black text-white outline-none transition placeholder:text-white/20 disabled:text-white/40"
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || atMax}
          aria-label="Aumentar quantidade"
          className="flex h-full w-12 items-center justify-center text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
