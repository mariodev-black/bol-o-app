"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseInputDate(value));
}

function monthTitle(date: Date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const blanks = Array.from({ length: first.getDay() }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
  return [...blanks, ...days];
}

function quickRange(range: "today" | "yesterday" | "7d" | "30d" | "month") {
  const now = new Date();
  if (range === "today") return { start: toInputDate(now), end: toInputDate(now) };
  if (range === "yesterday") {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { start: toInputDate(yesterday), end: toInputDate(yesterday) };
  }
  if (range === "7d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start: toInputDate(start), end: toInputDate(now) };
  }
  if (range === "30d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: toInputDate(start), end: toInputDate(now) };
  }
  return {
    start: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function CalendarMonth({
  month,
  draftStart,
  draftEnd,
  onPick,
  onPrev,
  onNext,
}: {
  month: Date;
  draftStart: string;
  draftEnd: string;
  onPick: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const days = buildMonthDays(month);

  return (
    <section className="rounded-[20px] border border-white/8 bg-[#0D1117] p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/3 text-[18px] font-black text-white/80 hover:bg-white/7 hover:text-white"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <h4 className="text-[15px] font-black capitalize text-white/92">{monthTitle(month)}</h4>
        <button
          type="button"
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/3 text-[18px] font-black text-white/80 hover:bg-white/7 hover:text-white"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {WEEK_DAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="text-center text-[11px] font-black text-white/30">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="h-10" />;
          const value = toInputDate(date);
          const selectedStart = value === draftStart;
          const selectedEnd = value === draftEnd;
          const inRange = value > draftStart && value < draftEnd;
          const selected = selectedStart || selectedEnd;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onPick(value)}
              className={[
                "h-10 rounded-full text-[16px] font-black transition-all duration-150",
                selected
                  ? "bg-primary text-black"
                  : inRange
                    ? "bg-primary/12 text-primary"
                    : "bg-transparent text-white/78 hover:bg-white/6 hover:text-white",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AdminDateRangePicker({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(parseInputDate(startDate).getFullYear(), parseInputDate(startDate).getMonth(), 1));

  function pushRange(start: string, end: string) {
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);
    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  }

  function applyRange() {
    setOpen(false);
    pushRange(draftStart, draftEnd);
  }

  function applyQuickRange(range: "today" | "yesterday" | "7d" | "30d" | "month") {
    const next = quickRange(range);
    setDraftStart(next.start);
    setDraftEnd(next.end);
    const parsed = parseInputDate(next.start);
    setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setMenuOpen(false);
    pushRange(next.start, next.end);
  }

  function pickDate(value: string) {
    if (!draftStart || (draftStart && draftEnd && draftStart !== draftEnd)) {
      setDraftStart(value);
      setDraftEnd(value);
      return;
    }
    if (value < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(value);
      return;
    }
    setDraftEnd(value);
  }

  return (
    <>
      <div className="relative w-full lg:w-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-[13px] border border-white/10 bg-[#101010] px-4 text-left transition-colors hover:border-primary/35 hover:bg-white/5 disabled:cursor-wait disabled:border-primary/25 disabled:bg-primary/8 lg:w-auto lg:justify-start"
        >
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-white/32">Período</span>
            <span className="block truncate text-[12px] font-black text-white/86">
              {isPending ? "Carregando dados..." : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`}
            </span>
          </span>
          {isPending ? (
            <span className="ml-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          ) : (
            <span className={["ml-2 text-[13px] text-white/82 transition-transform", menuOpen ? "rotate-180" : ""].join(" ")}>⌄</span>
          )}
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Fechar seleção de período"
              className="fixed inset-0 z-110 cursor-default bg-transparent"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-120 overflow-hidden rounded-[18px] border border-white/10 bg-[#0B0E12] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:left-auto sm:right-0 sm:w-[280px]">
              {[
                ["today", "Hoje", "Somente dados de hoje"],
                ["yesterday", "Ontem", "Dia anterior"],
                ["7d", "Últimos 7 dias", "Última semana"],
                ["30d", "Últimos 30 dias", "Último mês móvel"],
                ["month", "Mês atual", "Do dia 1 até o fim do mês"],
              ].map(([range, label, description]) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => applyQuickRange(range as "today" | "yesterday" | "7d" | "30d" | "month")}
                  disabled={isPending}
                  className="block w-full rounded-[14px] px-3.5 py-3 text-left transition-colors hover:bg-white/6 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="block text-[16px] font-black text-white">{label}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-white/32">{description}</span>
                </button>
              ))}
              <div className="my-2 h-px bg-white/8" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen(true);
                }}
                disabled={isPending}
                className="block w-full rounded-[14px] border border-primary/20 bg-primary/8 px-3.5 py-3 text-left transition-colors hover:bg-primary/12"
              >
                <span className="block text-[16px] font-black text-primary">Personalizado</span>
                <span className="mt-1 block text-[11px] font-semibold text-white/38">Selecionar início e final no calendário</span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-120 flex items-end justify-center bg-black/72 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4">
          <style>{`
            @keyframes adminDateFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes adminDatePop { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
          <div className="absolute inset-0" style={{ animation: "adminDateFade 160ms ease-out" }} onClick={() => setOpen(false)} />
          <div
            className="relative max-h-[min(92vh,720px)] w-full max-w-[920px] overflow-y-auto rounded-t-[22px] border border-white/10 bg-[#080B0F] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.58)] sm:rounded-[22px] sm:p-6"
            style={{ animation: "adminDatePop 180ms ease-out" }}
          >
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-primary">Filtrar dashboard</p>
                <h3 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-white sm:mt-3 sm:text-[24px]">Selecione o período</h3>
                <p className="mt-2 text-[13px] font-medium text-white/82">Escolha duas datas para recalcular os indicadores.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CalendarMonth
                month={visibleMonth}
                draftStart={draftStart}
                draftEnd={draftEnd}
                onPick={pickDate}
                onPrev={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                onNext={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              />
              <CalendarMonth
                month={addMonths(visibleMonth, 1)}
                draftStart={draftStart}
                draftEnd={draftEnd}
                onPick={pickDate}
                onPrev={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                onNext={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              />
            </div>

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="rounded-[14px] border border-white/8 bg-white/3 px-4 py-3">
                <p className="text-[12px] font-black uppercase tracking-[0.16em] text-white/30">Selecionado</p>
                <p className="mt-1 text-[16px] font-black text-white/88">
                  {formatDisplayDate(draftStart)} - {formatDisplayDate(draftEnd)}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="h-11 rounded-[12px] border border-white/8 bg-white/3 px-5 text-[12px] font-black uppercase tracking-[0.12em] text-white/68 transition-colors hover:bg-white/7 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyRange}
                  disabled={isPending || !draftStart || !draftEnd || draftStart > draftEnd}
                  className="h-11 rounded-[12px] bg-primary px-5 text-[12px] font-black uppercase tracking-[0.12em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Carregando..." : "Aplicar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isPending ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/18 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-[#0B0E12]/95 px-5 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.36)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            <span className="text-[12px] font-black uppercase tracking-[0.14em] text-primary">Carregando</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
