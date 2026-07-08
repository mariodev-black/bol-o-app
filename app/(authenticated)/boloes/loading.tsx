export default function BoloesLoading() {
  return <BoloesLoadingSkeleton />;
}

/** Loader mínimo para streamar quase instantaneamente sem skeleton pesado. */
export function BoloesLoadingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="size-11 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          aria-hidden
        />
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.22em] text-primary">
            Carregando bolão
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
            Preparando seus cards
          </p>
        </div>
      </div>
    </div>
  );
}
