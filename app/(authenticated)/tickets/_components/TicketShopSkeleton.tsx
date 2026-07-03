const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.1)";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-white/10 ${className}`} />;
}

function ProductRowSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[16px] border"
      style={{ borderColor: BORDER, background: CARD }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:p-3.5">
        <SkeletonBlock className="h-14 w-14 rounded-[10px]" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
          <div className="min-w-0">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="mt-2 h-3 w-40" />
            <SkeletonBlock className="mt-3 h-8 w-24 rounded-[10px]" />
          </div>
          <div className="self-center text-right">
            <SkeletonBlock className="ml-auto h-2.5 w-16" />
            <SkeletonBlock className="ml-auto mt-1.5 h-3.5 w-14" />
          </div>
        </div>
      </div>
      <div
        className="border-t px-3.5 py-2.5"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <SkeletonBlock className="h-3 w-44" />
      </div>
    </div>
  );
}

/**
 * Skeleton da loja de tickets — mesma linguagem visual (blocos cinza
 * pulsantes) usada nas outras telas autenticadas, no lugar do spinner
 * `AppScreenLoading` que destoava do resto do app.
 */
export function TicketShopSkeleton() {
  return (
    <div className="min-h-screen w-full animate-pulse bg-black pb-10">
      <SkeletonBlock className="h-[150px] w-full rounded-b-[22px]" />

      <div className="mx-auto w-full max-w-[430px] space-y-3 px-4 pt-5">
        <ProductRowSkeleton />
        <ProductRowSkeleton />
        <ProductRowSkeleton />

        <div
          className="rounded-[16px] border p-4"
          style={{ borderColor: BORDER, background: CARD }}
        >
          <SkeletonBlock className="h-4 w-36" />
          <div
            className="mt-4 space-y-2.5 border-b pb-3"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
          <SkeletonBlock className="mt-3 h-10 w-full rounded-[10px]" />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[12px] border px-2 py-3 text-center"
              style={{ borderColor: BORDER, background: CARD }}
            >
              <SkeletonBlock className="mx-auto size-4 rounded-full" />
              <SkeletonBlock className="mx-auto mt-2 h-2.5 w-14" />
              <SkeletonBlock className="mx-auto mt-2 h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
