"use client";

function Sk({ className }: { className: string }) {
  return <div className={`animate-pulse bg-white/8 ${className}`} aria-hidden />;
}

/** Pódio + tabela (+ faixa de stats e resumo no modo detalhes) enquanto carrega o board. */
export function RankingBoardSkeleton({
  showStatsStrip,
}: {
  showStatsStrip: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      {showStatsStrip ? (
        <div
          className="grid grid-cols-4 overflow-hidden rounded-2xl border"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "#101010",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-2 border-r border-white/8 px-1 py-3 last:border-r-0"
            >
              <Sk className="size-4 rounded-md" />
              <Sk className="h-3 w-10 rounded-lg" />
              <Sk className="h-2.5 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end justify-center gap-2 px-0.5">
        <Sk className="h-32 w-[30%] max-w-[118px] rounded-2xl" />
        <Sk className="h-36 w-[34%] max-w-[132px] rounded-2xl" />
        <Sk className="h-32 w-[30%] max-w-[118px] rounded-2xl" />
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          background: "#101010",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="grid grid-cols-[40px_minmax(0,1fr)_64px_56px] gap-2 border-b border-white/8 px-3 py-2.5">
          <Sk className="h-2.5 w-4 rounded-md" />
          <Sk className="h-2.5 w-16 rounded-md" />
          <Sk className="h-2.5 w-12 justify-self-end rounded-md" />
          <Sk className="h-2.5 w-10 justify-self-end rounded-md" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_minmax(0,1fr)_64px_56px] items-center gap-2 border-b border-white/4 px-3 py-2.5 last:border-b-0"
          >
            <Sk className="h-4 w-6 rounded-md" />
            <div className="flex items-center gap-2">
              <Sk className="size-8 shrink-0 rounded-full" />
              <Sk className="h-3 max-w-[120px] flex-1 rounded-md" />
            </div>
            <Sk className="h-3 w-8 justify-self-end rounded-md" />
            <Sk className="h-3 w-8 justify-self-end rounded-md" />
          </div>
        ))}
      </div>

      {showStatsStrip ? (
        <div
          className="grid grid-cols-3 overflow-hidden rounded-2xl border"
          style={{
            background: "#101010",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center border-r border-white/8 py-3 last:border-r-0"
            >
              <Sk className="h-2.5 w-20 rounded-md" />
              <Sk className="mt-2 h-7 w-10 rounded-lg" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Página inteira enquanto carrega bolões / escopos (primeira carga). */
export function RankingFullPageSkeleton() {
  return (
    <div className="mt-1 space-y-4 pb-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/9 bg-[#0a0a0a] px-4 pb-5 pt-4">
        <div className="pointer-events-none absolute -right-6 top-6 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-2">
          <Sk className="h-8 w-48 rounded-lg" />
          <Sk className="h-8 w-36 rounded-lg" />
          <Sk className="mt-3 h-3 w-full max-w-[280px] rounded-md" />
          <Sk className="h-3 w-full max-w-[260px] rounded-md" />
          <Sk className="h-3 w-full max-w-[220px] rounded-md" />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] px-5 pb-5 pt-5">
        <div className="flex gap-3.5">
          <Sk className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Sk className="h-2.5 w-32 rounded-md" />
            <Sk className="h-4 w-full max-w-[220px] rounded-lg" />
          </div>
        </div>
        <Sk className="mt-5 h-13 w-full rounded-xl" />
        <Sk className="mt-5 h-3 w-full max-w-[260px] rounded-md" />
      </section>

      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0a0a0a] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex gap-1">
          <Sk className="h-11 flex-1 rounded-xl" />
          <Sk className="h-11 flex-1 rounded-xl" />
        </div>
        <div className="mt-2 border-t border-white/8 px-3.5 pb-3 pt-3">
          <div className="flex gap-3">
            <Sk className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Sk className="h-2.5 w-28 rounded-md" />
              <Sk className="h-3 w-full rounded-md" />
              <Sk className="h-3 w-[85%] rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <RankingBoardSkeleton showStatsStrip />

      <div className="mt-6 space-y-3.5">
        <Sk className="h-22 w-full rounded-2xl" />
        <Sk className="h-22 w-full rounded-2xl" />
      </div>
    </div>
  );
}
