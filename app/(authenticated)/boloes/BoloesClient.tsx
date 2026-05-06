
"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ActivePrincipalBolao = {
  id: string;
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo";
  statusLabel: string;
  sent: number;
  total: number;
  progress: number;
  position: number | null;
  points: number;
};

export type ActiveDailyBolao = {
  id: string;
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo" | "aguardando" | "usado";
  statusLabel: string;
  gamesCount: number;
  countdownLabel: string;
  countdownTargetMs: number | null;
  position: number | null;
  points: number;
};

export type ActiveBolaoListItem = {
  id: string;
  type: "principal" | "diario";
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo" | "aguardando" | "usado";
  statusLabel: string;
  sent?: number;
  total?: number;
  progress?: number;
  gamesCount?: number;
  countdownLabel?: string;
  countdownTargetMs?: number | null;
  position: number | null;
  points: number;
};

export type BoloesScreenData = {
  summary: {
    activeCount: number;
    pendingPredictions: number;
    bestPosition: number | null;
  };
  active: {
    principal: ActivePrincipalBolao | null;
    diario: ActiveDailyBolao | null;
    all: ActiveBolaoListItem[];
  };
  upcoming: {
    daily: {
      href: string;
      gamesCount: number;
      closesAtMs: number | null;
      priceLabel: string;
    };
    principal: {
      href: string;
      priceLabel: string;
      closesAtMs: number | null;
    };
  };
};

const GREEN = "#B1EB0B";
const GREEN_SOFT = "#0AC96B";
const YELLOW = "#E6B726";
const CARD = "#111111";
const CARD_ALT = "#0F0F0F";
const BORDER = "rgba(255,255,255,0.06)";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}

function formatCountdown(targetMs: number | null, now: number): string {
  if (!targetMs) return "--:--:--";
  const seconds = Math.max(0, Math.floor((targetMs - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function positionLabel(position: number | null) {
  return position == null ? "--" : `#${position}`;
}

function pointsLabel(points: number) {
  return `${points} pts`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = GREEN,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <div
      className="flex h-[121px] flex-1 flex-col items-center justify-center rounded-[13px] border px-2 text-center shadow-[0_16px_28px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.98]"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="mb-3 flex size-[25px] items-center justify-center rounded-[7px] border"
        style={{ background: `${tone}18`, borderColor: `${tone}22`, boxShadow: `0 0 14px ${tone}1F` }}
        aria-hidden
      >
        <Icon className="size-[13px]" style={{ color: tone }} strokeWidth={2.1} />
      </div>
      <p className="whitespace-pre-line text-[9px] font-black uppercase leading-[1.12] tracking-[0.08em] text-white/42 min-[380px]:text-[10px]">
        {label}
      </p>
      <p className="mt-1 text-[24px] font-black leading-none tracking-[-0.03em]" style={{ color: tone }}>
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-medium leading-none text-white/55">{helper}</p>
    </div>
  );
}

function SectionTitle({
  title,
  href,
  onClick,
  expanded,
}: {
  title: string;
  href: string;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const content = (
    <>
      {expanded ? "Ocultar" : "Ver todos"} <ChevronRight className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`} strokeWidth={2.6} />
    </>
  );

  return (
    <div className="mb-[26px] flex items-center justify-between">
      <h2 className="text-[17px] font-black leading-none tracking-[-0.03em] text-white">{title}</h2>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          style={{ color: GREEN }}
          aria-expanded={expanded}
        >
          {content}
        </button>
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          style={{ color: GREEN }}
        >
          {content}
        </Link>
      )}
    </div>
  );
}

function BolaoIcon({ type }: { type: "copa" | "dia" }) {
  const Icon = type === "copa" ? Trophy : CalendarDays;
  const label = type === "copa" ? "COPA\n2026" : "BOLÃO\nDO DIA";
  const color = type === "copa" ? GREEN_SOFT : GREEN;

  return (
    <div className="flex w-[58px] shrink-0 flex-col items-center justify-center text-center">
      <div
        className="mb-2 flex size-[38px] items-center justify-center rounded-[11px]"
        style={{ background: `${color}22`, boxShadow: `0 0 20px ${color}24` }}
        aria-hidden
      >
        <Icon className="size-[19px]" style={{ color }} strokeWidth={2.1} />
      </div>
      <p className="whitespace-pre-line text-[11px] font-black uppercase leading-[0.96] tracking-[-0.03em]" style={{ color }}>
        {label}
      </p>
    </div>
  );
}

function StatusPill({ status, label }: { status: ActiveDailyBolao["status"] | "ativo"; label: string }) {
  const isActive = status === "ativo";
  const isUsed = status === "usado";
  const tone = isUsed ? "#F87171" : isActive ? GREEN_SOFT : YELLOW;

  return (
    <span
      className="inline-flex h-[18px] items-center rounded-[5px] border px-2 text-[8px] font-black uppercase tracking-[0.12em]"
      style={{ background: `${tone}1F`, borderColor: `${tone}55`, color: tone }}
    >
      <span className="mr-1 size-[5px] rounded-full" style={{ background: tone }} aria-hidden />
      {label}
    </span>
  );
}

function RankingPanel({ position, points }: { position: number | null; points: number }) {
  return (
    <div className="flex flex-col items-center justify-center border-l px-2 text-center" style={{ borderColor: BORDER }}>
      <p className="text-[8px] font-black uppercase leading-[0.95] tracking-[0.06em] text-white/45">Sua<br />posição</p>
      <p className="mt-1 text-[14px] font-black leading-none text-white">{positionLabel(position)}</p>
      <div className="my-3 h-px w-full bg-white/6" />
      <p className="text-[8px] font-black uppercase leading-none tracking-[0.06em] text-white/45">Pontos</p>
      <p className="mt-1 text-[13px] font-black leading-none" style={{ color: GREEN }}>{pointsLabel(points)}</p>
    </div>
  );
}

function EmptyActiveCard() {
  return (
    <div
      className="rounded-[15px] border px-5 py-6 text-center shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      style={{ background: CARD_ALT, borderColor: BORDER }}
    >
      <p className="text-[14px] font-black text-white">Você ainda não tem bolões ativos</p>
      <p className="mx-auto mt-2 max-w-[250px] text-[11px] leading-normal text-white/48">
        Entre em um dos bolões disponíveis abaixo para começar a palpitar.
      </p>
    </div>
  );
}

function ActiveBoloesCard({
  principal,
  diario,
  now,
}: {
  principal: ActivePrincipalBolao | null;
  diario: ActiveDailyBolao | null;
  now: number;
}) {
  const detailsHref = principal?.href ?? diario?.href ?? "/tickets";

  if (!principal && !diario) return <EmptyActiveCard />;

  return (
    <article
      className="overflow-hidden rounded-[15px] border shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      style={{ background: CARD_ALT, borderColor: BORDER }}
    >
      {principal && (
        <div className="grid grid-cols-[58px_minmax(0,1fr)_72px]">
          <div className="flex items-center justify-center border-r" style={{ borderColor: BORDER }}>
            <BolaoIcon type="copa" />
          </div>
          <Link
            href={principal.href}
            className="min-w-0 px-3 py-[13px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
          >
            <p className="text-[13px] font-black uppercase leading-none text-white">{principal.title}</p>
            <p className="mt-1.5 text-[10px] font-medium leading-none text-white/58">{principal.cotaLabel}</p>
            <div className="mt-3"><StatusPill status="ativo" label={principal.statusLabel} /></div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold leading-none text-white/58">Palpites enviados</span>
              <span className="text-[10px] font-black leading-none text-white">{principal.sent} / {principal.total}</span>
            </div>
            <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full" style={{ width: `${principal.progress}%`, background: GREEN }} />
            </div>
          </Link>
          <RankingPanel position={principal.position} points={principal.points} />
        </div>
      )}

      {principal && diario && <div className="h-px bg-white/6" />}

      {diario && (
        <div className="grid grid-cols-[58px_minmax(0,1fr)_72px]">
          <div className="flex items-center justify-center border-r" style={{ borderColor: BORDER }}>
            <BolaoIcon type="dia" />
          </div>
          <Link
            href={diario.href}
            className="min-w-0 px-3 py-[13px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
          >
            <p className="text-[13px] font-black uppercase leading-none text-white">{diario.title}</p>
            <p className="mt-1.5 text-[10px] font-medium leading-none text-white/58">{diario.cotaLabel}</p>
            <div className="mt-3"><StatusPill status={diario.status} label={diario.statusLabel} /></div>
            <p className="mt-3 text-[10px] font-medium leading-none text-white/58">
              Jogos do dia: <span className="font-black text-white">{diario.gamesCount} jogos</span>
            </p>
            <p className="mt-1.5 text-[10px] font-medium leading-none text-white/58">
              {diario.countdownLabel}: <span className="font-black" style={{ color: GREEN_SOFT }}>{formatCountdown(diario.countdownTargetMs, now)}</span>
            </p>
          </Link>
          <RankingPanel position={diario.position} points={diario.points} />
        </div>
      )}

      <div className="px-3 pb-3 pt-2">
        <Link
          href={detailsHref}
          className="flex h-[36px] w-full items-center justify-center rounded-[8px] border text-[10px] font-black uppercase tracking-[0.04em] text-white/62 transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] active:bg-white/5"
          style={{ borderColor: "rgba(177,235,11,0.18)" }}
        >
          Ver detalhes
        </Link>
      </div>
    </article>
  );
}

function ActiveBoloesList({ items, now }: { items: ActiveBolaoListItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[15px] border px-5 py-6 text-center" style={{ background: CARD_ALT, borderColor: BORDER }}>
        <p className="text-[12px] font-bold text-white/55">Nenhum bolão ativo encontrado.</p>
      </div>
    );
  }

  return (
    <article
      className="overflow-hidden rounded-[15px] border shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      style={{ background: CARD_ALT, borderColor: BORDER }}
    >
      {items.map((item) => {
        const isPrincipal = item.type === "principal";
        const progress = Math.max(0, Math.min(100, item.progress ?? 0));

        return (
          <div key={item.id}>
            <div className="grid grid-cols-[88px_minmax(0,1fr)_72px]">
              <div className="flex items-center justify-center border-r" style={{ borderColor: BORDER }}>
                <BolaoIcon type={isPrincipal ? "copa" : "dia"} />
              </div>

              <Link
                href={item.href}
                className="min-w-0 px-4 py-[18px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
              >
                <p className="text-[19px] font-black uppercase leading-none text-white">{item.title}</p>
                <p className="mt-2 font-mono text-[13px] font-semibold leading-none text-white/52" title={item.id}>
                  {item.cotaLabel.replace("Cota #", "Cota #")}
                </p>

                <div className="mt-7">
                  <StatusPill status={item.status} label={item.statusLabel} />
                </div>

                {isPrincipal ? (
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-semibold leading-none text-white/55">Palpites enviados</span>
                      <span className="text-[14px] font-black leading-none text-white">{item.sent ?? 0} / {item.total ?? 0}</span>
                    </div>
                    <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: GREEN }} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-2">
                    <p className="text-[14px] font-medium leading-none text-white/55">
                      Jogos do dia: <span className="font-black text-white">{item.gamesCount ?? 0} jogos</span>
                    </p>
                    <p className="text-[14px] font-medium leading-none text-white/55">
                      {item.countdownLabel ?? "Fecha em"}:{" "}
                      <span className="font-black" style={{ color: GREEN_SOFT }}>
                        {formatCountdown(item.countdownTargetMs ?? null, now)}
                      </span>
                    </p>
                  </div>
                )}
              </Link>

              <RankingPanel position={item.position} points={item.points} />
            </div>

            {item !== items[items.length - 1] && <div className="h-px bg-white/6" />}
          </div>
        );
      })}
    </article>
  );
}

function AvailableCard({
  href,
  badge,
  badgeTone,
  icon,
  title,
  subtitle,
  bodyLines,
  time,
  price,
  buttonTone,
}: {
  href: string;
  badge: string;
  badgeTone: "lime" | "green";
  icon: "calendar" | "trophy";
  title: string;
  subtitle: string;
  bodyLines: string[];
  time?: string;
  price: string;
  buttonTone: "lime" | "green";
}) {
  const Icon = icon === "calendar" ? CalendarDays : Trophy;
  const badgeColor = badgeTone === "lime" ? GREEN : GREEN_SOFT;
  const buttonColor = buttonTone === "lime" ? GREEN : GREEN_SOFT;

  return (
    <article
      className="relative flex min-h-[255px] flex-1 flex-col items-center rounded-[14px] border px-4 pb-4 pt-[41px] text-center shadow-[0_18px_36px_rgba(0,0,0,0.38)]"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="absolute left-3 right-3 top-[7px] flex h-[20px] items-center justify-center rounded-full text-[8px] font-black uppercase tracking-[0.18em]"
        style={{ background: badgeColor, color: "#0E141B" }}
      >
        {badge}
      </div>
      <div
        className="flex size-[38px] items-center justify-center rounded-[11px]"
        style={{ background: `${buttonColor}18`, boxShadow: `0 0 18px ${buttonColor}20` }}
        aria-hidden
      >
        <Icon className="size-[19px]" style={{ color: buttonColor }} strokeWidth={2.1} />
      </div>
      <h3 className="mt-4 text-[13px] font-black leading-none text-white">{title}</h3>
      <p className="mt-1.5 text-[10px] font-black uppercase leading-none" style={{ color: buttonColor }}>{subtitle}</p>
      <p className="mt-3 min-h-[30px] text-[11px] font-medium leading-tight text-white/48">
        {bodyLines.map((line) => <span key={line} className="block">{line}</span>)}
      </p>
      {time && (
        <p className="mt-1 text-[13px] font-black leading-none" style={{ color: GREEN }}>
          {time}
        </p>
      )}
      <div className="mt-auto w-full border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <p className="text-[14px] font-black leading-none text-white">{price}</p>
        <Link
          href={href}
          className="mt-4 flex h-[34px] w-full items-center justify-center rounded-[7px] text-[11px] font-black uppercase tracking-[0.04em] transition-transform hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97]"
          style={{ background: buttonColor, color: "#0E141B" }}
        >
          Entrar
        </Link>
      </div>
    </article>
  );
}

export function BoloesClient({ data }: { data: BoloesScreenData | null }) {
  const now = useNow();
  const [showAllActive, setShowAllActive] = useState(false);
  const summary = data?.summary ?? { activeCount: 0, pendingPredictions: 0, bestPosition: null };
  const bestPosition = summary.bestPosition == null ? "--" : `#${summary.bestPosition}`;
  const dailyCountdown = useMemo(
    () => formatCountdown(data?.upcoming.daily.closesAtMs ?? null, now),
    [data?.upcoming.daily.closesAtMs, now]
  );

  if (showAllActive) {
    return (
      <div className="min-h-screen bg-black px-[18px] pb-8 pt-[24px] text-white">
        <div className="mx-auto w-full max-w-[390px]">
          <header className="text-center">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.25em]" style={{ color: GREEN }}>
              Copa 2026
            </p>
            <h1 className="mt-2 text-[25px] font-black uppercase leading-none tracking-[-0.055em] text-white">
              Todos os <span style={{ color: GREEN }}>Bolões</span>
            </h1>
            <p className="mx-auto mt-3 max-w-[282px] text-[12px] font-medium leading-[1.45] text-white/58">
              Escolha uma cota para ver detalhes, palpitar ou acompanhar sua posição.
            </p>
          </header>

          <section className="mt-[34px]">
            <div className="mb-[20px] flex items-center justify-between">
              <h2 className="text-[17px] font-black leading-none tracking-[-0.03em] text-white">
                Lista de cotas
              </h2>
              <button
                type="button"
                onClick={() => setShowAllActive(false)}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
                style={{ color: GREEN }}
              >
                Voltar <ChevronRight className="size-3 rotate-180" strokeWidth={2.6} />
              </button>
            </div>
            <ActiveBoloesList items={data?.active.all ?? []} now={now} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-[18px] pb-8 pt-[32px] text-white">
      <div className="mx-auto w-full max-w-[390px]">
        <header className="text-center">
          <p className="text-[10px] font-black uppercase leading-none tracking-[0.25em]" style={{ color: GREEN }}>
            Copa 2026
          </p>
          <h1 className="mt-2 text-[25px] font-black uppercase leading-none tracking-[-0.055em] text-white">
            Meus <span style={{ color: GREEN }}>Bolões</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[282px] text-[12px] font-medium leading-[1.45] text-white/58">
            Acompanhe suas participações, envie seus palpites e entre nos próximos bolões.
          </p>
        </header>

        <section className="mt-[47px] grid grid-cols-3 gap-[7px]" aria-label="Resumo dos bolões">
          <SummaryCard icon={ClipboardList} label="Bolões ativos" value={String(summary.activeCount)} helper="Em andamento" />
          <SummaryCard icon={ClipboardList} label="Palpites pendentes" value={String(summary.pendingPredictions)} helper="Para enviar" tone={YELLOW} />
          <SummaryCard icon={Trophy} label="Sua melhor posição" value={bestPosition} helper="No ranking geral" tone={GREEN_SOFT} />
        </section>

        <div className="my-[26px] h-px bg-white/6" />

        <section>
          <SectionTitle
            title="Meus bolões ativos"
            href="/boloes/tickets"
            expanded={showAllActive}
            onClick={() => setShowAllActive((current) => !current)}
          />
          <ActiveBoloesCard principal={data?.active.principal ?? null} diario={data?.active.diario ?? null} now={now} />
          {showAllActive && <ActiveBoloesList items={data?.active.all ?? []} now={now} />}
        </section>

        <section className="mt-[55px]">
          <SectionTitle title="Próximos bolões disponíveis" href="/tickets" />
          <div className="grid grid-cols-2 gap-[18px]">
            <AvailableCard
              href={data?.upcoming.daily.href ?? "/tickets?bolao=diario"}
              badge="ó mais popular"
              badgeTone="lime"
              icon="calendar"
              title="Bolão do Dia"
              subtitle="Jogos de hoje"
              bodyLines={[`${data?.upcoming.daily.gamesCount ?? 0} jogos disponíveis`, "Fecha em"]}
              time={dailyCountdown}
              price={data?.upcoming.daily.priceLabel ?? "R$ 0,00"}
              buttonTone="lime"
            />
            <AvailableCard
              href={data?.upcoming.principal.href ?? "/tickets"}
              badge="• de 1 milhão"
              badgeTone="green"
              icon="trophy"
              title="Bolão da Copa"
              subtitle="Cota extra"
              bodyLines={["Mais uma chance", "no ranking geral"]}
              price={data?.upcoming.principal.priceLabel ?? "R$ 0,00"}
              buttonTone="green"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
