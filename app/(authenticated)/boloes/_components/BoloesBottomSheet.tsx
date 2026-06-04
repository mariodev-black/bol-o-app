"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import {
  filterBoloesSheetItems,
  type BoloesSheetChampionshipOption,
  type BoloesSheetItem,
} from "@/app/(authenticated)/boloes/_components/boloes-sheet-items";

function BoloesSheetCard({ item }: { item: BoloesSheetItem }) {
  return (
    <Link
      href={item.href}
      className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] text-left transition-colors hover:border-white/18 active:scale-[0.99]"
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 p-4">
        <div className="flex items-center justify-center">
          <img
            src={item.iconSrc}
            alt=""
            className={
              item.brandedIcon
                ? "h-12 w-12 object-contain"
                : "h-[54px] w-[42px] object-contain"
            }
          />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-black uppercase leading-tight text-white">
            {item.title}
          </p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-white/55">
            {item.subtitle}
          </p>
          <p className="mt-1.5 text-[12px] font-bold leading-snug text-primary/90">
            {item.prizeLine}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Cota
          </p>
          <p className="mt-0.5 max-w-[72px] truncate text-[13px] font-black tabular-nums text-primary">
            {item.priceLabel}
          </p>
          <ChevronRight
            className="ml-auto mt-1 size-4 text-white/55 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            strokeWidth={2.4}
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}

export function BoloesBottomSheet({
  open,
  onClose,
  items,
  championships,
}: {
  open: boolean;
  onClose: () => void;
  items: BoloesSheetItem[];
  championships: BoloesSheetChampionshipOption[];
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState("all");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedChampionship("all");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filteredItems = useMemo(
    () => filterBoloesSheetItems(items, selectedChampionship),
    [items, selectedChampionship],
  );

  if (!open || !portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-120 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boloes-sheet-title"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/78 backdrop-blur-[2px]"
        aria-label="Fechar bolões"
        onClick={onClose}
      />

      <div className="animate-perfil-avatar-sheet-in relative z-10 flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#141414] shadow-[0_-16px_56px_rgba(0,0,0,0.65)] sm:max-h-[min(85vh,720px)] sm:rounded-[22px] sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
          <h2
            id="boloes-sheet-title"
            className="text-[18px] font-black uppercase tracking-wide text-white"
          >
            Bolões ativos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#222] text-white/80 transition hover:bg-[#2a2a2a] hover:text-white"
            aria-label="Fechar bolões"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-3">
          <label htmlFor="boloes-sheet-championship" className="sr-only">
            Campeonato
          </label>
          <div className="relative">
            <select
              id="boloes-sheet-championship"
              value={selectedChampionship}
              onChange={(e) => setSelectedChampionship(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-white/12 bg-[#222] px-4 pr-10 text-[13px] font-bold uppercase tracking-wide text-white outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/20"
            >
              {championships.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#222]">
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronRight
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-white/45"
              strokeWidth={2.4}
              aria-hidden
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[14px] font-bold leading-snug text-white/70">
                Nenhum bolão ativo neste campeonato.
              </p>
              <p className="mt-2 text-[13px] leading-snug text-white/45">
                Quando você tiver uma cota em andamento, ela aparece aqui.
              </p>
            </div>
          ) : (
            <ul className="space-y-3 pb-2">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <BoloesSheetCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
