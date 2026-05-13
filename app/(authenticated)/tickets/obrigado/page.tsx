"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Sparkles, Ticket } from "lucide-react";

const PRIMARY = "#B1EB0B";
const PRIMARY_SOFT = "#E8FF8A";
const CARD = "#0c0c0c";
const BORDER = "rgba(177, 235, 11, 0.22)";
const COUNTDOWN_START = 5;
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function TicketObrigadoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const cancelledRef = useRef(false);

  const principal = Number.parseInt(params.get("principal") ?? "0", 10) || 0;
  const diario = Number.parseInt(params.get("diario") ?? "0", 10) || 0;
  const extra = Number.parseInt(params.get("extra") ?? "0", 10) || 0;
  const total = principal + diario + extra;

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_START);

  const resumoLines = useMemo(() => {
    const lines: { label: string; value: string }[] = [];
    if (principal > 0)
      lines.push({
        label: "Bolão principal",
        value: `${principal} ${principal === 1 ? "cota" : "cotas"}`,
      });
    if (diario > 0)
      lines.push({
        label: "Bolão do dia",
        value: `${diario} ${diario === 1 ? "cota" : "cotas"}`,
      });
    if (extra > 0)
      lines.push({
        label: "Bolão extra",
        value: `${extra} ${extra === 1 ? "cota" : "cotas"}`,
      });
    return lines;
  }, [principal, diario, extra]);

  const goBoloes = useCallback(() => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    router.replace("/boloes?fromPurchase=1");
  }, [router]);

  useEffect(() => {
    if (cancelledRef.current) return;
    if (secondsLeft <= 0) {
      goBoloes();
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, goBoloes]);

  const onIrAgora = () => {
    cancelledRef.current = true;
    router.replace("/boloes?fromPurchase=1");
  };

  const progress = Math.max(0, secondsLeft) / COUNTDOWN_START;
  const ringOffset = RING_C * (1 - progress);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(177,235,11,0.55), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(14,185,164,0.35), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-5 py-10 sm:px-6">
        <div className="text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ borderColor: BORDER, color: PRIMARY_SOFT, background: "rgba(177,235,11,0.06)" }}
          >
            <Sparkles className="size-3.5 shrink-0" strokeWidth={2.2} style={{ color: PRIMARY }} />
            Pagamento confirmado
          </span>
        </div>

        <section
          className="relative mt-7 rounded-[22px] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8"
          style={{
            background: `linear-gradient(165deg, ${CARD} 0%, #050505 100%)`,
            borderColor: BORDER,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex flex-col items-center">
            <div
              className="flex size-[72px] items-center justify-center rounded-full border-2"
              style={{
                borderColor: "rgba(177,235,11,0.45)",
                background: "linear-gradient(145deg, rgba(177,235,11,0.18), rgba(177,235,11,0.04))",
                boxShadow: "0 0 40px rgba(177,235,11,0.15)",
              }}
            >
              <Check className="size-9" strokeWidth={2.8} style={{ color: PRIMARY }} />
            </div>

            <h1 className="mt-5 text-center text-[28px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[32px]">
              Você está <span style={{ color: PRIMARY }}>dentro do jogo</span>
            </h1>
            <p className="mx-auto mt-3 max-w-[320px] text-center text-[14px] leading-relaxed text-white/58 sm:text-[15px]">
              Seu pagamento foi aprovado com sucesso. Suas cotas já estão na conta — é só escolher os palpites e
              acompanhar o ranking.
            </p>
          </div>

          <div
            className="relative mx-auto mt-8 flex size-[120px] items-center justify-center"
            aria-live="polite"
            aria-atomic="true"
          >
            <svg className="absolute inset-0 -rotate-90" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={PRIMARY}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="relative flex flex-col items-center justify-center text-center">
              <span className="text-[40px] font-black leading-none tabular-nums tracking-tight" style={{ color: PRIMARY }}>
                {Math.max(0, secondsLeft)}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                segundos
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] font-medium leading-snug text-white/45">
            Em seguida abrimos <span className="font-bold text-white/70">Meus Bolões</span> para você conferir tudo.
          </p>

          <div
            className="mt-8 rounded-[16px] border px-4 py-4 sm:px-5"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-center gap-2 text-white/45">
              <Ticket className="size-4 shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-black uppercase tracking-[0.12em]">Resumo do pedido</span>
            </div>
            <p className="mt-2 text-center text-[26px] font-black tabular-nums leading-none" style={{ color: PRIMARY }}>
              {total} {total === 1 ? "cota" : "cotas"}
            </p>
            {resumoLines.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-white/[0.07] pt-4 text-left">
                {resumoLines.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-white/45">{row.label}</span>
                    <span className="font-bold text-white/90">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-center text-[12px] text-white/45">
                Suas cotas já estão disponíveis em Meus Bolões.
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={onIrAgora}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[14px] font-black uppercase tracking-[0.06em] text-[#0E141B] shadow-[0_6px_28px_rgba(177,235,11,0.35)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99]"
              style={{
                background: `linear-gradient(180deg, ${PRIMARY_SOFT} 0%, ${PRIMARY} 100%)`,
              }}
            >
              Ir agora
              <ArrowRight className="size-5 shrink-0" strokeWidth={2.4} />
            </button>
            <Link
              href="/tickets"
              onClick={() => {
                cancelledRef.current = true;
              }}
              className="flex h-[48px] w-full items-center justify-center rounded-[14px] border text-[13px] font-bold text-white/85 transition-colors hover:bg-white/[0.04] active:scale-[0.99]"
              style={{ borderColor: "rgba(255,255,255,0.14)" }}
            >
              Adquirir mais bolões
            </Link>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
            Não fechou a página? Sem problema — redirecionamos automaticamente quando o contador chegar a zero.
          </p>
        </section>
      </div>
    </div>
  );
}

function TicketObrigadoFallback() {
  return (
    <div className="min-h-screen bg-black px-5 py-10">
      <div className="mx-auto max-w-[440px]">
        <div
          className="animate-pulse rounded-[22px] border p-8"
          style={{ background: CARD, borderColor: BORDER }}
        >
          <div className="mx-auto h-[72px] w-[72px] rounded-full bg-white/10" />
          <div className="mx-auto mt-5 h-8 w-48 rounded-lg bg-white/10" />
          <div className="mx-auto mt-3 h-16 w-full max-w-[280px] rounded-lg bg-white/5" />
          <div className="mx-auto mt-8 h-[120px] w-[120px] rounded-full bg-white/5" />
          <div className="mt-8 h-28 w-full rounded-[16px] bg-white/5" />
          <div className="mt-8 h-[52px] w-full rounded-[14px] bg-white/10" />
        </div>
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
