export default function PremiacaoLoading() {
  return (
    <main className="min-h-screen bg-black px-3 pb-24 text-white">
      <div className="mx-auto w-full max-w-[430px] sm:max-w-[960px] sm:px-6 lg:px-8">
        <div className="h-[208px] animate-pulse rounded-[18px] border border-primary/15 bg-[#111] sm:h-[420px] sm:rounded-[24px]" />
        <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 overflow-hidden rounded-[16px] border border-white/10 bg-[#101010] p-3">
          <div className="h-[84px] animate-pulse rounded-[14px] bg-white/8" />
          <div className="mt-3 space-y-0 overflow-hidden rounded-[15px] border border-white/10">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[72px] animate-pulse border-b border-white/7 bg-white/5 last:border-b-0" />
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[132px] animate-pulse rounded-[16px] border border-white/10 bg-[#101010]" />
          ))}
        </div>
      </div>
    </main>
  );
}
