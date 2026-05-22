import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  hint?: boolean;
};

/** Rolagem horizontal de tabelas largas no mobile, com dica visual */
export function AdminTableScroll({ children, className = "", hint = true }: Props) {
  return (
    <div className={className}>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {children}
      </div>
      {hint ? (
        <p className="mt-2 px-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white/28 lg:hidden">
          Deslize para ver mais colunas →
        </p>
      ) : null}
    </div>
  );
}
