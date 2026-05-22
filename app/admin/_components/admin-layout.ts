/** Grid de cards de métricas — 2 colunas no celular, 4 no desktop */
export const adminStatGridClass = "mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4";

/** Valor numérico em card de métrica */
export const adminStatValueClass =
  "mt-3 text-[22px] font-black leading-none text-primary sm:text-[24px]";

/** Container de abas com rolagem horizontal no mobile */
export const adminTabBarClass =
  "flex gap-2 overflow-x-auto overscroll-x-contain border-b border-white/8 p-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Botão de aba (não encolhe no scroll horizontal) */
export const adminTabButtonClass =
  "h-10 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.1em] transition-colors sm:text-[12px] sm:tracking-[0.12em]";
