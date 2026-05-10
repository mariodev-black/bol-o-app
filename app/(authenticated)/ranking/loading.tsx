export default function RankingLoading() {
  return (
    <main className="min-h-screen bg-black px-3.5 pb-24 text-white">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="h-[188px] animate-pulse rounded-[16px] border border-white/10 bg-[#111]" />

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2">
          <div className="h-14 animate-pulse rounded-[14px] border border-white/10 bg-[#111]" />
          <div className="h-14 animate-pulse rounded-[14px] border border-primary/20 bg-primary/10" />
        </div>

        <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-[14px] border border-white/10 bg-[#111]">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[86px] animate-pulse border-r border-white/8 last:border-r-0" />
          ))}
        </div>

        <div className="mt-3 h-[78px] animate-pulse rounded-[14px] border border-primary/30 bg-primary/10" />
        <div className="mt-4 h-[352px] animate-pulse rounded-[14px] border border-white/10 bg-[#111]" />
      </div>
    </main>
  );
}
