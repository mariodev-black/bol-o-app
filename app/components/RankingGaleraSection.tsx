"use client";

import Image from "next/image";
import { Minus, Triangle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Trofeu from "@/app/assets/icon-trofeu.svg";
import bgRankStadium from "@/app/assets/bg-home-desk.png";
import avatarMatheus from "@/app/assets/fred.png";
import avatarKauan from "@/app/assets/benjamin.png";
import avatarGabriel from "@/app/assets/caze.png";
import avatarLucas from "@/app/assets/dest.png";

/** Variação de pontos no último passo — todos os badges mostram ícone. */
type PointsTrend = "up" | "down" | "stable";

function trendFromPointDelta(prev: number, next: number): PointsTrend {
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "stable";
}

const STABLE_TRENDS: PointsTrend[] = ["stable", "stable", "stable", "stable"];

const RANK_CARD_BG =
  "rounded-[999px] border-emerald-950/20 bg-[#004C3D] shadow-[0_6px_22px_rgba(0,0,0,0.22)]";

const PLAYERS = [
  {
    name: "Matheus Silva",
    avatar: avatarMatheus,
  },
  {
    name: "Kauan Lucas",
    avatar: avatarKauan,
  },
  {
    name: "Gabriel Vieira",
    avatar: avatarGabriel,
  },
  {
    name: "Lucas Mendes",
    avatar: avatarLucas,
  },
];

const STAT_BOXES = [
  { headline: "+52.000", sub: "Jogadores ativos" },
  { headline: "+500.000", sub: "Palpites enviados" },
  { headline: "+200.000", sub: "Lances confirmados" },
];

const INITIAL_POINTS: [number, number, number, number] = [82, 72, 70, 62];

/** Pontuações após cada atualização (sempre ordenamos por maior = topo). */
const POINTS_AFTER_STEP_1: [number, number, number, number] = [82, 89, 72, 62];
const POINTS_AFTER_STEP_2: [number, number, number, number] = [82, 89, 98, 62];
const POINTS_AFTER_STEP_3: [number, number, number, number] = [105, 89, 98, 62];
/** Lucas sobe ao topo — sai do 4º lugar (deixa de ficar sob o blur). */
const POINTS_AFTER_STEP_4: [number, number, number, number] = [
  105, 89, 98, 118,
];

function rankByPoints(pts: readonly number[]): number[] {
  const idx = pts.map((_, i) => i);
  return idx.sort((a, b) => {
    const d = pts[b]! - pts[a]!;
    if (d !== 0) return d;
    return a - b;
  });
}

/** Duração do deslize (FLIP) — um pouco mais lento = leitura mais “real”. */
const FLIP_MS = 920;
const FLIP_EASE = "cubic-bezier(0.18, 0.88, 0.22, 1)";
/** Pausa entre uma troca e a próxima (além do tempo da animação). */
const GAP_BETWEEN_SHUFFLES_MS = 2800;
const SHUFFLE_FIRST_DELAY_MS = 800;

function useAnimatedPoints(target: number) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = fromRef.current;
    if (start === target) return;

    const t0 = performance.now();
    const dur = 520;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 3;
      const next = Math.round(start + (target - start) * eased);
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

function PointsBadge({
  target,
  trend,
  flash,
}: {
  target: number;
  trend: PointsTrend;
  flash: boolean;
}) {
  const shown = useAnimatedPoints(target);

  const trendIcon =
    trend === "up" ? (
      <Triangle
        className={`size-3 shrink-0 fill-primary text-primary sm:size-[14px] ${flash ? "animate-bounce" : ""}`}
        style={{ animationDuration: "0.6s" }}
        aria-hidden
      />
    ) : trend === "down" ? (
      <Triangle
        className="size-3 shrink-0 rotate-180 fill-red-400 text-red-400 sm:size-[14px]"
        aria-hidden
      />
    ) : (
      <Minus
        className="size-3 shrink-0 stroke-[2.5px] text-white/55 sm:size-[14px]"
        aria-hidden
      />
    );

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 pl-2.5 pr-1 transition-[box-shadow,transform,border-color] duration-300 sm:gap-1.5 sm:px-2.5 sm:py-1.5 ${
        flash
          ? "scale-[1.03] border-primary/50 bg-[#020806] shadow-[0_0_22px_rgba(177,235,11,0.45)]"
          : "border-black/40 bg-[#030806]/95 shadow-inner"
      }`}
    >
      <span className="min-w-[3.25rem] text-right text-[10px] font-bold tabular-nums tracking-tight text-white sm:min-w-[3.5rem] sm:text-xs">
        {shown}
        <span className="text-[0.7em] font-semibold text-white/80"> pts</span>
      </span>
      {trendIcon}
    </div>
  );
}

export function RankingGaleraSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [points, setPoints] = useState<[number, number, number, number]>(() => [
    ...INITIAL_POINTS,
  ]);
  const [flashRow, setFlashRow] = useState<number | null>(null);
  const [badgeTrends, setBadgeTrends] = useState<PointsTrend[]>(
    () => STABLE_TRENDS,
  );

  const rankedPlayerIds = useMemo(() => rankByPoints(points), [points]);

  const reducedMotion = useRef(false);
  const shuffleTimersRef = useRef<number[]>([]);
  const hasPlayedInViewRef = useRef(false);
  /** Refs por jogador (0–3) para FLIP — mesma identidade, slot muda. */
  const rowRefs = useRef<(HTMLDivElement | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  /** Rects antes de atualizar pontos (capturados no mesmo tick). */
  const flipBeforeRef = useRef<Map<number, DOMRect> | null>(null);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /** Destaca quem ficou em 1º após a nova pontuação (só efeito visual). */
  const flashTopAfterPoints = useCallback((nextPoints: readonly number[]) => {
    const top = rankByPoints(nextPoints)[0]!;
    window.setTimeout(() => {
      setFlashRow(top);
      window.setTimeout(() => setFlashRow(null), 780);
    }, 220);
  }, []);

  const captureFlipSnapshot = useCallback(() => {
    if (reducedMotion.current) return;
    const snap = new Map<number, DOMRect>();
    for (let pid = 0; pid < 4; pid++) {
      const el = rowRefs.current[pid];
      if (el) snap.set(pid, el.getBoundingClientRect());
    }
    if (snap.size === 4) flipBeforeRef.current = snap;
  }, []);

  useLayoutEffect(() => {
    if (reducedMotion.current) return;

    const before = flipBeforeRef.current;
    flipBeforeRef.current = null;
    if (!before || before.size < 4) return;

    const els: HTMLDivElement[] = [];
    const dx: number[] = [];
    const dy: number[] = [];
    let anyMove = false;

    for (let pid = 0; pid < 4; pid++) {
      const el = rowRefs.current[pid];
      const a = before.get(pid);
      if (!el || !a) continue;
      const b = el.getBoundingClientRect();
      const x = a.left - b.left;
      const y = a.top - b.top;
      if (Math.abs(x) > 0.6 || Math.abs(y) > 0.6) anyMove = true;
      els.push(el);
      dx.push(x);
      dy.push(y);
    }

    if (!anyMove) return;

    for (let i = 0; i < els.length; i++) {
      const el = els[i]!;
      el.style.transition = "none";
      el.style.transform = `translate3d(${dx[i]}px,${dy[i]}px,0)`;
      el.style.willChange = "transform";
      el.style.zIndex = "30";
      const moved = Math.abs(dx[i]!) > 8 || Math.abs(dy[i]!) > 8;
      if (moved) {
        el.style.boxShadow = "0 18px 40px rgba(0,0,0,0.45)";
      }
    }

    void els[0]?.offsetHeight;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (let i = 0; i < els.length; i++) {
          const el = els[i]!;
          el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`;
          el.style.transform = "translate3d(0,0,0)";
        }

        window.setTimeout(() => {
          for (const el of els) {
            el.style.transition = "";
            el.style.transform = "";
            el.style.willChange = "";
            el.style.zIndex = "";
            el.style.boxShadow = "";
          }
        }, FLIP_MS + 40);
      });
    });
  }, [points]);

  const clearShuffleTimers = () => {
    shuffleTimersRef.current.forEach((t) => clearTimeout(t));
    shuffleTimersRef.current = [];
  };

  const scheduleShuffle = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    shuffleTimersRef.current.push(id);
  };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reducedMotion.current) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (!entry.isIntersecting) {
          hasPlayedInViewRef.current = false;
          clearShuffleTimers();
          setPoints([...INITIAL_POINTS]);
          setBadgeTrends(STABLE_TRENDS);
          return;
        }

        if (hasPlayedInViewRef.current) return;
        hasPlayedInViewRef.current = true;
        clearShuffleTimers();

        const t1 = SHUFFLE_FIRST_DELAY_MS;
        const t2 = SHUFFLE_FIRST_DELAY_MS + GAP_BETWEEN_SHUFFLES_MS;
        const t3 = SHUFFLE_FIRST_DELAY_MS + GAP_BETWEEN_SHUFFLES_MS * 2;
        const t4 = SHUFFLE_FIRST_DELAY_MS + GAP_BETWEEN_SHUFFLES_MS * 3;

        // 1 — Kauan ultrapassa (pontos sobem só aqui)
        scheduleShuffle(() => {
          captureFlipSnapshot();
          setPoints((prev) => {
            const next = [...POINTS_AFTER_STEP_1] as [
              number,
              number,
              number,
              number,
            ];
            setBadgeTrends(
              next.map((p, i) => trendFromPointDelta(prev[i]!, p)),
            );
            return next;
          });
          flashTopAfterPoints(POINTS_AFTER_STEP_1);
        }, t1);

        // 2 — Gabriel assume a liderança
        scheduleShuffle(() => {
          captureFlipSnapshot();
          setPoints((prev) => {
            const next = [...POINTS_AFTER_STEP_2] as [
              number,
              number,
              number,
              number,
            ];
            setBadgeTrends(
              next.map((p, i) => trendFromPointDelta(prev[i]!, p)),
            );
            return next;
          });
          flashTopAfterPoints(POINTS_AFTER_STEP_2);
        }, t2);

        // 3 — Matheus volta ao topo
        scheduleShuffle(() => {
          captureFlipSnapshot();
          setPoints((prev) => {
            const next = [...POINTS_AFTER_STEP_3] as [
              number,
              number,
              number,
              number,
            ];
            setBadgeTrends(
              next.map((p, i) => trendFromPointDelta(prev[i]!, p)),
            );
            return next;
          });
          flashTopAfterPoints(POINTS_AFTER_STEP_3);
        }, t3);

        // 4 — Lucas (4º com blur) sobe e troca de posição com quem estava acima
        scheduleShuffle(() => {
          captureFlipSnapshot();
          setPoints((prev) => {
            const next = [...POINTS_AFTER_STEP_4] as [
              number,
              number,
              number,
              number,
            ];
            setBadgeTrends(
              next.map((p, i) => trendFromPointDelta(prev[i]!, p)),
            );
            return next;
          });
          flashTopAfterPoints(POINTS_AFTER_STEP_4);
        }, t4);
      },
      { threshold: 0.36, rootMargin: "-6% 0px -8% 0px" },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      clearShuffleTimers();
    };
  }, [captureFlipSnapshot, flashTopAfterPoints]);

  return (
    <section
      ref={sectionRef}
      id="ranking-galera"
      className="font-helvetica-now-display relative isolate overflow-hidden bg-[#040a08] py-14 text-white sm:py-16 lg:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.32]"
        style={{
          backgroundImage: `url(${bgRankStadium.src})`,
          filter: "blur(12px)",
          transform: "scale(1.08)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(5,14,11,0.94)_0%,rgba(4,10,8,0.88)_45%,rgba(3,8,6,0.96)_100%)]"
      />

      <div className="relative z-[1] mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-14 xl:gap-20">
          {/* Coluna estreita (fundo escuro); cards “saltam” pra fora nas laterais — como no mockup */}
          {/* Base (#368F5B) mais estreita; cards saltam mais para os lados */}
          <div className="relative isolate mx-auto w-full max-w-[min(100%,268px)] lg:mx-0 lg:max-w-[min(100%,288px)]">
            {/* Troféu acima de tudo no bloco */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[40%]">
              <Image
                src={Trofeu}
                alt=""
                width={240}
                height={240}
                className="h-[5.75rem] w-[5.75rem] object-contain sm:h-[6.25rem] sm:w-[6.25rem]"
              />
            </div>

            <div className="relative overflow-visible rounded-[18px] border border-emerald-950/25 shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:rounded-[22px]">
              {/* Base verde atrás; conteúdo e cards na frente (destaque nas laterais) */}
              <div
                className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-[#368F5B]"
                aria-hidden
              />
              <div className="relative z-10 px-3 pb-5 pt-[5.25rem] sm:px-4 sm:pb-6 sm:pt-24">
                <div className="grid w-full grid-cols-[minmax(0,2.75rem)_1fr_auto] items-end gap-x-1 border-b border-white/[0.07] pb-2.5 text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/70 sm:grid-cols-[minmax(0,3.25rem)_1fr_auto] sm:gap-x-2 sm:pb-3 sm:text-[10px]">
                  <span className="text-left">Classificação</span>
                  <span className="text-center">Investidor</span>
                  <span className="text-right">Pontuação</span>
                </div>

                <div className="relative z-20 -mx-9 mt-4 sm:-mx-11 sm:mt-5">
                  <div className="relative flex flex-col gap-2.5 sm:gap-3">
                    {rankedPlayerIds.map((playerIdx, slotIdx) => {
                      const row = PLAYERS[playerIdx]!;
                      const isFourthPlace = slotIdx === 3;
                      return (
                        <div
                          key={playerIdx}
                          ref={(el) => {
                            rowRefs.current[playerIdx] = el;
                          }}
                          className={`relative flex shrink-0 items-center gap-2 overflow-hidden border px-3 py-2.5 transition-[box-shadow] duration-300 sm:gap-3 sm:px-4 sm:py-3 ${RANK_CARD_BG} ${
                            flashRow === playerIdx
                              ? "z-[1] shadow-[0_12px_36px_rgba(177,235,11,0.22)] ring-2 ring-primary/35"
                              : ""
                          }`}
                        >
                          <span className="relative z-[1] w-9 shrink-0 text-center text-lg font-black tabular-nums leading-none text-white sm:w-11 sm:text-xl">
                            {slotIdx + 1}º
                          </span>
                          <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                            <span className="relative block size-10 shrink-0 overflow-hidden rounded-full ring-[1.5px] ring-white/35 ring-offset-[3px] ring-offset-[#004C3D] sm:size-11">
                              <Image
                                src={row.avatar}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            </span>
                            <span className="truncate text-[13px] font-bold tracking-tight text-white sm:text-[15px]">
                              {row.name}
                            </span>
                          </div>
                          <div className="relative z-[1] shrink-0">
                            <PointsBadge
                              target={points[playerIdx] ?? 0}
                              trend={badgeTrends[playerIdx] ?? "stable"}
                              flash={flashRow === playerIdx}
                            />
                          </div>
                          {isFourthPlace ? (
                            <div
                              className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit] bg-[#368F5B]/10 backdrop-blur-[3px] backdrop-saturate-110 sm:backdrop-blur-[5px]"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center text-center lg:text-left">
            <div className="inline-flex items-center justify-center gap-2 lg:justify-start">
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                Tempo real
              </span>
            </div>
            <h2 className="mt-4 text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.05] tracking-tight">
              <span className="text-primary">Ranking</span>
              <span className="text-white"> da Galera</span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-white/88 sm:text-[20px] lg:mx-0 lg:max-w-[520px] lg:text-[22px]">
              <span className="font-light">
                Acompanhe em tempo real quem está no topo do bolão. Cada
                palpite conta para sua posição na classificação geral.{" "}
              </span>
              <strong className="font-bold text-white">
                Sua posição no ranking é a prova do seu conhecimento e da sua
                estratégia.
              </strong>
            </p>

            <div className="mx-auto mt-10 grid w-full max-w-xl grid-cols-1 gap-3 sm:mx-0 sm:mt-12 sm:max-w-none sm:grid-cols-3 sm:gap-4 lg:mt-14">
              {STAT_BOXES.map(({ headline, sub }) => (
                <div
                  key={sub}
                  className="rounded-2xl border border-white/[0.09] bg-black/30 px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition hover:border-white/15 sm:px-5 sm:py-5"
                >
                  <p className="text-xl font-bold tabular-nums text-primary sm:text-2xl">
                    {headline}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug font-light text-white/85 sm:text-sm">
                    {sub}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mx-auto mt-10 w-full max-w-xl rounded-2xl bg-primary px-6 py-4 text-center text-[13px] font-bold uppercase leading-snug tracking-wide text-[#0E141B] shadow-[0_14px_44px_rgba(177,235,11,0.28)] transition hover:brightness-110 active:scale-[0.99] sm:mx-0 sm:mt-12 sm:max-w-none sm:py-[1.125rem] sm:text-[14px] lg:mt-14 lg:text-[15px]"
            >
              PRÊMIOS MILIONÁRIOS PARA OS 10 PRIMEIROS
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
