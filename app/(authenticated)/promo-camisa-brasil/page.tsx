"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Lock, ShieldAlert, ShoppingCart } from "lucide-react";
import camisaBraImg from "@/app/assets/camisa-nova-bra.png";
import dinheiroImg from "@/app/assets/pix-banco-central.svg";
import brasilLogo from "@/app/assets/brasil-selecao-logo.png";
import type { BrasilMarrocosPlacarPromoStatus } from "@/lib/promotions/brasil-marrocos-placar-promo";

const CHECKOUT_URL = "/comprar-cotas";
const GREEN = "#B1EB0B";
const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
const MARROCOS_SHIELD_URL = "https://cdn.api-futebol.com.br/times/escudos/677fca6889a75.svg";

type PalpiteData = {
  predCasa: number | null;
  predVisitante: number | null;
  escanteiosBrasil: number | null;
};

function usePalpiteData(): PalpiteData {
  const [data, setData] = useState<PalpiteData>({
    predCasa: null,
    predVisitante: null,
    escanteiosBrasil: null,
  });

  useEffect(() => {
    void fetch("/api/promotions/brasil-marrocos-placar", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d: BrasilMarrocosPlacarPromoStatus) => {
        setData({
          predCasa: d.predCasa,
          predVisitante: d.predVisitante,
          escanteiosBrasil: d.escanteiosBrasil,
        });
      })
      .catch(() => null);
  }, []);

  return data;
}

export default function PromoCamisaBrasilPage() {
  const { predCasa, predVisitante, escanteiosBrasil } = usePalpiteData();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="flex flex-1 flex-col items-center bg-[#0a0a0a] px-4 py-2"
      style={{ fontFamily: PROMO_FONT }}
    >
      <div className="flex w-full max-w-[390px] flex-1 flex-col justify-between">

        {/* ── HEADER ── */}
        <div className="flex flex-row items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: GREEN, background: `${GREEN}18` }}
          >
            <AlertTriangle className="size-4" strokeWidth={2.5} style={{ color: GREEN }} />
          </div>
          <div>
            <p className="text-[20px] font-black uppercase italic leading-none tracking-tight">
              <span className="text-white">Falta </span>
              <span style={{ color: GREEN }}>1 Passo!</span>
            </p>
            <p className="text-[10.5px] font-medium leading-snug text-white/80">
              Palpite salvo, mas ainda{" "}
              <span className="font-bold" style={{ color: GREEN }}>não</span>{" "}
              está{" "}
              <span className="font-bold" style={{ color: GREEN }}>participando</span>{" "}
              da promoção.
            </p>
          </div>
        </div>

        {/* ── SEU PALPITE ── */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-1.5">
          <p className="mb-1 text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/50">
            Seu Palpite
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <Image src={brasilLogo} alt="Brasil" width={28} height={28} className="size-7 object-contain" draggable={false} />
              <span className="text-[8px] font-black uppercase tracking-wide text-white/80">Brasil</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[28px] font-black tabular-nums leading-none text-white">{predCasa ?? "–"}</span>
              <span className="text-[13px] font-bold text-white/40">x</span>
              <span className="text-[28px] font-black tabular-nums leading-none text-white">{predVisitante ?? "–"}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Image src={MARROCOS_SHIELD_URL} alt="Marrocos" width={28} height={28} unoptimized className="size-7 object-contain" draggable={false} />
              <span className="text-[8px] font-black uppercase tracking-wide text-white/80">Marrocos</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 rounded-lg py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Image src={brasilLogo} alt="" width={12} height={12} className="size-3 object-contain" draggable={false} />
            <span className="text-[10px] font-semibold text-white/60">Escanteios Brasil:</span>
            <span className="text-[12px] font-black tabular-nums text-white">{escanteiosBrasil ?? "–"}</span>
          </div>
        </div>

        {/* ── AO ATIVAR SUA COTA divider ── */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-white/50">
            Ao ativar sua cota, você concorre a:
          </span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* ── PRIZE: camisa | dinheiro ── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
              <Image src={camisaBraImg} alt="Camisa oficial da Seleção Brasileira" width={100} height={70} className="object-contain" priority draggable={false} />
              <p className="text-[11px] font-black uppercase italic leading-tight" style={{ color: GREEN }}>Camisa Oficial</p>
              <p className="text-[8px] font-bold uppercase tracking-wide text-white">da Seleção Brasileira</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5">
              <Image src={dinheiroImg} alt="R$ 1.000 no PIX" width={100} height={70} className="object-contain" draggable={false} />
              <p className="text-[18px] font-black uppercase italic leading-tight" style={{ color: GREEN }}>R$ 1.000</p>
              <p className="text-[8px] font-bold uppercase tracking-wide text-white">no PIX</p>
            </div>
          </div>
        </div>

        {/* ── WARNING: sem cota ativa ── */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${GREEN}18`, border: `1.5px solid ${GREEN}55` }}>
            <ShieldAlert className="size-4" strokeWidth={2.5} style={{ color: GREEN }} />
          </div>
          <p className="text-[10.5px] font-medium leading-snug text-white/80">
            Sem uma cota ativa, seu palpite{" "}
            <span className="font-bold" style={{ color: GREEN }}>não participa</span>{" "}
            da promoção.
          </p>
        </div>

        {/* ── ATIVE SUA PARTICIPAÇÃO AGORA divider ── */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: `${GREEN}35` }} />
          <span className="text-[8px] font-black uppercase italic tracking-[0.14em]" style={{ color: GREEN }}>
            Ative sua participação Agora
          </span>
          <div className="h-px flex-1" style={{ background: `${GREEN}35` }} />
        </div>

        {/* ── OFFER CARD ── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="flex flex-col justify-center px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-white">Concorra a mais de</p>
              <p className="text-[21px] font-black uppercase italic leading-none tracking-tight" style={{ color: GREEN }}>R$ 1 Milhão</p>
              <p className="text-[9px] font-black uppercase tracking-wide text-white">em premiações no Bolão</p>
              <p className="mt-1 text-[8px] font-black uppercase italic tracking-tight" style={{ color: GREEN }}>+ Camisa Oficial e R$ 1.000 no PIX</p>
            </div>
            <div className="flex flex-col justify-center px-3 py-2">
              <p className="text-[9px] font-medium text-white/60">Por apenas</p>
              <p className="mt-0.5 leading-none">
                <span className="text-[11px] font-bold text-white/70">R$&nbsp;</span>
                <span className="text-[24px] font-black tabular-nums text-white">29,90</span>
              </p>
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center gap-1">
                  <Check className="size-3 shrink-0" strokeWidth={2.5} style={{ color: GREEN }} />
                  <span className="text-[9px] font-medium text-white/70">Copa inteira</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="size-3 shrink-0" strokeWidth={2.5} style={{ color: GREEN }} />
                  <span className="text-[9px] font-medium text-white/70">104 jogos para pontuar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <Link
          href={CHECKOUT_URL}
          className="flex min-h-[48px] w-full items-center justify-between rounded-full px-5 text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          style={{ background: GREEN }}
        >
          <ShoppingCart className="size-4.5 shrink-0" strokeWidth={2.3} />
          <span className="flex-1 text-center">Ativar meu palpite</span>
          <ChevronRight className="size-4.5 shrink-0" strokeWidth={2.5} />
        </Link>

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-center gap-1.5">
          <Lock className="size-3 shrink-0 text-white/35" strokeWidth={2} />
          <p className="text-center text-[9.5px] font-medium leading-snug text-white/45">
            Compra{" "}
            <strong className="font-bold text-white/70">100% segura</strong>.{" "}
            Pagamento via PIX com aprovação imediata.
          </p>
        </div>

      </div>
    </div>
  );
}
