const CARD = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.08)";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-white/10 ${className}`} />;
}

/** Espelha a forma real de `UpcomingBolaoCard` (badge + logo + título + stats + box de premiação + CTA). */
function BolaoCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] border" style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex justify-center pt-4">
        <SkeletonBlock className="h-[22px] w-20 rounded-full" />
      </div>

      <div className="flex flex-col items-center px-4 pt-3">
        <SkeletonBlock className="h-14 w-14 rounded-full" />
        <SkeletonBlock className="mt-2.5 h-4 w-32" />
        <SkeletonBlock className="mt-1.5 h-3 w-20" />
      </div>

      <div className="mt-3.5 flex items-start gap-2 border-t px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="min-w-0 flex-1 text-center">
            <SkeletonBlock className="mx-auto size-4 rounded-full" />
            <SkeletonBlock className="mx-auto mt-2 h-2.5 w-12" />
            <SkeletonBlock className="mx-auto mt-1.5 h-3.5 w-10" />
          </div>
        ))}
      </div>

      <div className="mx-3 mb-3 rounded-[12px] border p-3 text-center" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)" }}>
        <SkeletonBlock className="mx-auto h-2.5 w-24" />
        <SkeletonBlock className="mx-auto mt-2 h-6 w-20" />
        <SkeletonBlock className="mx-auto mt-3 h-10 w-full rounded-[10px]" />
      </div>
    </div>
  );
}

function CardSection({ titleWidth }: { titleWidth: string }) {
  return (
    <section className="space-y-3">
      <SkeletonBlock className={`h-2.5 ${titleWidth}`} />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <BolaoCardSkeleton />
        <BolaoCardSkeleton />
      </div>
    </section>
  );
}

export default function BoloesLoading() {
  return <BoloesLoadingSkeleton />;
}

/** Mesmo skeleton, reutilizável em <Suspense> dentro da página (streaming). */
export function BoloesLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-black pb-10 text-white">
      <div className="mx-auto w-full max-w-[430px] px-4 animate-pulse">
        <header className="flex items-center gap-2 pt-1">
          <SkeletonBlock className="size-4" />
          <SkeletonBlock className="h-3 w-36" />
        </header>

        <div className="mt-5 space-y-6">
          <CardSection titleWidth="w-32" />
          <CardSection titleWidth="w-28" />
        </div>
      </div>
    </div>
  );
}
