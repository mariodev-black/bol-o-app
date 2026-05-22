function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[14px] bg-white/6 ${className}`} />;
}

export function AdminLoadingState({ table = false }: { table?: boolean }) {
  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="mt-4 h-10 w-72" />
          <SkeletonBlock className="mt-4 h-4 w-full max-w-xl" />
        </div>
        <SkeletonBlock className="h-11 w-64 rounded-[13px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <SkeletonBlock key={item} className="h-[118px]" />
        ))}
      </div>
      {table ? (
        <>
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
            <SkeletonBlock className="h-[360px] rounded-[22px]" />
            <SkeletonBlock className="h-[360px] rounded-[22px]" />
          </div>
          <div className="mt-6 overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
            <div className="grid grid-cols-5 gap-4 border-b border-white/8 p-4">
              {[0, 1, 2, 3, 4].map((item) => (
                <SkeletonBlock key={item} className="h-3" />
              ))}
            </div>
            <div className="divide-y divide-white/6">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="grid grid-cols-5 gap-4 p-4">
                  {[0, 1, 2, 3, 4].map((cell) => (
                    <SkeletonBlock key={cell} className="h-5" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <SkeletonBlock className="h-[300px] rounded-[22px]" />
          <SkeletonBlock className="h-[300px] rounded-[22px]" />
        </div>
      )}
    </div>
  );
}
