"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

const GOLD = "#B1EB0B";
const GOLD_LIGHT = "#E8FF8A";
const CARD = "#101010";

function TicketObrigadoContent() {
  const params = useSearchParams();
  const principal = Number.parseInt(params.get("principal") ?? "0", 10) || 0;
  const diario = Number.parseInt(params.get("diario") ?? "0", 10) || 0;
  const extra = Number.parseInt(params.get("extra") ?? "0", 10) || 0;
  const total = principal + diario + extra;

  const resumo = useMemo(() => {
    const parts: string[] = [];
    if (principal > 0) parts.push(`${principal} geral`);
    if (diario > 0) parts.push(`${diario} diário`);
    if (extra > 0) parts.push(`${extra} bolão extra`);
    return parts.join(" + ");
  }, [principal, diario, extra]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      <div className="mx-auto max-w-lg">
        <section
          className="rounded-2xl border p-6 sm:p-7"
          style={{ background: CARD, borderColor: "rgba(177,235,11,0.3)" }}
        >
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.45)" }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: "#86EFAC" }} />
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-center mb-2" style={{ color: GOLD_LIGHT }}>
            Pagamento confirmado
          </p>
          <h1 className="text-[30px] font-black leading-none text-white text-center">Obrigado!</h1>
          <p className="text-[14px] mt-3 text-center text-white/65 leading-relaxed">
            Seu pagamento foi aprovado e os tickets já foram creditados na sua conta.
          </p>

          <div
            className="mt-5 rounded-xl px-4 py-3 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p className="text-[12px] text-white/50">Tickets recebidos</p>
            <p className="text-[20px] font-black mt-1" style={{ color: GOLD }}>
              {total} ticket{total === 1 ? "" : "s"}
            </p>
            {resumo && <p className="text-[12px] text-white/55 mt-1">{resumo}</p>}
          </div>

          <div className="mt-5 grid gap-2">
            <Link
              href="/boloes?fromPurchase=1"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[13px] font-bold"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`, color: "#0E141B" }}
            >
              Ver meus tickets
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/palpites"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[12px] font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
            >
              Ir para palpites
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function TicketObrigadoFallback() {
  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      <div className="mx-auto max-w-lg">
        <section
          className="rounded-2xl border p-6 sm:p-7 animate-pulse"
          style={{ background: CARD, borderColor: "rgba(177,235,11,0.3)" }}
        >
          <div className="h-14 w-14 rounded-full mx-auto mb-4 bg-white/10" />
          <div className="h-3 w-32 mx-auto rounded bg-white/10 mb-2" />
          <div className="h-8 w-48 mx-auto rounded bg-white/10 mb-3" />
          <div className="h-12 w-full rounded bg-white/5" />
        </section>
      </div>
    </div>
  );
}

export default function TicketObrigadoPage() {
  return (
    <Suspense fallback={<TicketObrigadoFallback />}>
      <TicketObrigadoContent />
    </Suspense>
  );
}
