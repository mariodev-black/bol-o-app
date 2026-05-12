export default function PremiacaoLoading() {
  return (
    <main className="min-h-screen bg-black px-3 pb-24 text-white sm:pb-28">
      <div className="mx-auto w-full max-w-full sm:max-w-lg md:max-w-xl sm:px-2">
        <div className="h-[min(38svh,220px)] animate-pulse rounded-none bg-[#111] sm:h-[min(48svh,300px)] md:h-[200px] md:rounded-xl" />
        <div className="mt-2 overflow-hidden rounded-xl border border-white/14 bg-[#0a0a0a] p-2.5 sm:mt-4 sm:rounded-2xl sm:p-3">
          <div className="flex gap-1 border-b border-white/8 bg-[#0c0c0c] pb-2">
            <div className="h-11 flex-1 animate-pulse rounded-tl-lg bg-[#131313] sm:h-[52px] sm:rounded-tl-xl" />
            <div className="h-11 flex-1 animate-pulse rounded-tr-lg bg-[#131313] sm:h-[52px] sm:rounded-tr-xl" />
          </div>
          <div className="mt-2 space-y-2">
            <div className="h-16 animate-pulse rounded-lg bg-[#121212] sm:h-20" />
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-11 animate-pulse rounded-md border border-white/8 bg-white/5 sm:h-12"
              />
            ))}
          </div>
        </div>
        <div className="mt-3 h-24 animate-pulse rounded-xl border border-primary/20 bg-primary/25 sm:mt-4 sm:h-28" />
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-[#101010] px-2 py-3 sm:mt-4 sm:gap-2 sm:py-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-lg bg-white/5 sm:h-20" />
          ))}
        </div>
      </div>
    </main>
  );
}
