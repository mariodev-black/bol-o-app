export function AdminPageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5 min-w-0 lg:mb-7">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-[11px] sm:tracking-[0.22em]">
        Painel administrativo
      </p>
      <h1 className="mt-2 text-[26px] font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-[32px] lg:text-[44px]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-white/80 sm:mt-3 sm:text-[14px]">
        {subtitle}
      </p>
    </div>
  );
}
