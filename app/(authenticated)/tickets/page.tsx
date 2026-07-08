import Link from "next/link";
import { ArrowRight, Clock3, Construction, ShieldCheck, Ticket } from "lucide-react";
import { BottomNavBilhetesIcon } from "@/app/shared/bottom-nav-icons";

export const dynamic = "force-dynamic";

/** Bilhetes do fluxo de Esportes — a loja de bolões agora abre via modal nos cards. */
export default function TicketsPage() {
  return (
    <main className="overflow-hidden bg-black pb-24 text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-35"
        
        aria-hidden
      />

      <section className="relative mx-auto flex w-full max-w-[430px] flex-col justify-center px-5 py-10">
        <div className="mx-auto flex size-20 items-center justify-center rounded-[24px] border border-primary/25 bg-primary/10">
          <BottomNavBilhetesIcon className="size-11 text-primary" />
        </div>

        <div className="mt-6 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            <Construction className="size-3.5" />
            Em construção
          </div>

          <h1 className="mt-4 text-[34px] font-black uppercase leading-[0.98] tracking-[-0.06em]">
            Bilhetes de <span className="text-primary">esportes</span>
          </h1>

          <p className="mx-auto mt-3 max-w-[320px] text-[14px] font-medium leading-relaxed text-white/58">
            Esta tela será o painel dos seus bilhetes esportivos: seleções, odds,
            status em tempo real e histórico. Estamos preparando essa experiência.
          </p>
        </div>


        <div className="mt-6 grid gap-2.5">
          <Link
            href="/esportes"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_0_28px_rgba(177,235,11,0.2)] transition active:scale-[0.98]"
          >
            Ver esportes
            <ArrowRight className="size-4" strokeWidth={2.8} />
          </Link>
          <Link
            href="/boloes"
            className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[14px] font-black uppercase tracking-wide text-white/70 transition hover:text-white active:scale-[0.98]"
          >
            Ir para bolões
          </Link>
        </div>
      </section>
    </main>
  );
}
