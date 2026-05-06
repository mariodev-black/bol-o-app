const CARD = "#111111";
const BORDER = "rgba(255,255,255,0.06)";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-white/10 ${className}`} />;
}

export default function BoloesLoading() {
  return (
    <div className="min-h-screen bg-black px-[18px] pb-8 pt-[14px] text-white">
      <div className="mx-auto w-full max-w-[390px] animate-pulse">
        <header className="flex flex-col items-center text-center">
          <SkeletonBlock className="h-2.5 w-20" />
          <SkeletonBlock className="mt-3 h-7 w-44" />
          <SkeletonBlock className="mt-4 h-3 w-72" />
          <SkeletonBlock className="mt-2 h-3 w-56" />
        </header>

        <section className="mt-[47px] grid grid-cols-3 gap-[7px]">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[121px] rounded-[13px] border p-3" style={{ background: CARD, borderColor: BORDER }}>
              <SkeletonBlock className="mx-auto mt-2 size-[25px]" />
              <SkeletonBlock className="mx-auto mt-4 h-3 w-14" />
              <SkeletonBlock className="mx-auto mt-2 h-6 w-8" />
              <SkeletonBlock className="mx-auto mt-3 h-2.5 w-16" />
            </div>
          ))}
        </section>

        <div className="my-[26px] h-px bg-white/6" />

        <section>
          <div className="mb-[26px] flex items-center justify-between">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
          <div className="h-[220px] rounded-[15px] border" style={{ background: "#0F0F0F", borderColor: BORDER }}>
            <div className="grid h-1/2 grid-cols-[58px_minmax(0,1fr)_72px]">
              <div className="border-r p-3" style={{ borderColor: BORDER }}><SkeletonBlock className="mt-6 size-9" /></div>
              <div className="p-3"><SkeletonBlock className="h-3 w-36" /><SkeletonBlock className="mt-3 h-3 w-20" /><SkeletonBlock className="mt-5 h-2 w-full" /></div>
              <div className="border-l p-3" style={{ borderColor: BORDER }}><SkeletonBlock className="mt-7 h-4 w-10" /></div>
            </div>
            <div className="h-px bg-white/6" />
            <div className="grid h-1/2 grid-cols-[58px_minmax(0,1fr)_72px]">
              <div className="border-r p-3" style={{ borderColor: BORDER }}><SkeletonBlock className="mt-6 size-9" /></div>
              <div className="p-3"><SkeletonBlock className="h-3 w-28" /><SkeletonBlock className="mt-3 h-3 w-20" /><SkeletonBlock className="mt-5 h-3 w-32" /></div>
              <div className="border-l p-3" style={{ borderColor: BORDER }}><SkeletonBlock className="mt-7 h-4 w-10" /></div>
            </div>
          </div>
        </section>

        <section className="mt-[55px]">
          <div className="mb-[26px] flex items-center justify-between">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
          <div className="grid grid-cols-2 gap-[18px]">
            {[0, 1].map((item) => (
              <div key={item} className="h-[255px] rounded-[14px] border p-4" style={{ background: CARD, borderColor: BORDER }}>
                <SkeletonBlock className="h-5 w-full" />
                <SkeletonBlock className="mx-auto mt-5 size-9" />
                <SkeletonBlock className="mx-auto mt-5 h-3 w-24" />
                <SkeletonBlock className="mx-auto mt-4 h-3 w-20" />
                <SkeletonBlock className="mx-auto mt-8 h-4 w-20" />
                <SkeletonBlock className="mt-5 h-8 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
