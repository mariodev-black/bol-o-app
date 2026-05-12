import { ChevronRight } from 'lucide-react'
import { Ticket } from "lucide-react";
import Link from 'next/link';

export const CotaCpa = () => {
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-primary/25 bg-primary p-3 shadow-[0_12px_40px_rgba(177,235,11,0.22)] sm:mt-5 sm:rounded-2xl sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/15 sm:size-10 sm:rounded-xl">
            <Ticket
              className="size-5 text-[#0E141B] sm:size-6"
              strokeWidth={2.2}
            />
          </span>
          <p className="min-w-0 text-[13px] font-black uppercase leading-snug text-[#0E141B] sm:text-sm md:text-[15px]">
            Quer ganhar uma grana?{" "}
            <span className="whitespace-nowrap">Compre sua cota</span> e
            participe do Bolão do Milhão!
          </p>
        </div>
        <Link
          href="/tickets"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1 self-stretch rounded-lg bg-[#0E141B] px-4 text-[11px] font-black uppercase text-white transition-transform active:scale-[0.98] sm:h-11 sm:self-center sm:rounded-xl sm:px-5 sm:text-xs"
        >
          Comprar cota
          <ChevronRight className="size-3.5 sm:size-4" strokeWidth={2.6} />
        </Link>
      </div>
      <p className="mt-1.5 text-center text-[10px] font-semibold text-[#0E141B]/75 sm:mt-2 sm:text-left sm:text-[11px]">
        É rápido, fácil e seguro!
      </p>
    </section>
  );
};
