"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";

export type PalpitesViewTabItem<K extends string> = {
  key: K;
  label: string;
  icon?: LucideIcon;
};

type PalpitesViewTabsProps<K extends string> = {
  items: readonly PalpitesViewTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

/** Abas de texto com indicador verde arredondado abaixo da seleção. */
export function PalpitesViewTabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: PalpitesViewTabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label="Seções de palpites"
      className={cn(
        "flex items-end gap-7 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map(({ key, label, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-2 transition-colors duration-200",
              active ? "text-white" : "text-white/45 hover:text-white/60",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap text-[17px] leading-none",
                active ? "font-bold" : "font-semibold",
              )}
            >
              {Icon ? (
                <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              ) : null}
              {label}
            </span>
            <span
              aria-hidden
              className={cn(
                "h-1 rounded-full bg-primary transition-all duration-200",
                active ? "w-full min-w-[calc(100%-2px)] opacity-100" : "w-0 opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
