"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Lock,
  ShieldAlert,
  ShoppingCart,
} from "lucide-react";
import camisaBraImg from "@/app/assets/camisa-nova-bra.png";
import dinheiroImg from "@/app/assets/pix-banco-central.svg";
import brasilLogo from "@/app/assets/brasil-selecao-logo.png";
import type { BrasilMarrocosPlacarPromoStatus } from "@/lib/promotions/brasil-marrocos-placar-promo-shared";

const CHECKOUT_URL = "/comprar-cotas";
const GREEN = "#B1EB0B";
const PROMO_FONT =
  "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
const MARROCOS_SHIELD_URL =
  "https://cdn.api-futebol.com.br/times/escudos/677fca6889a75.svg";

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
  const router = useRouter();
  const { predCasa, predVisitante, escanteiosBrasil } = usePalpiteData();
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/promotions/brasil-marrocos-placar", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d: BrasilMarrocosPlacarPromoStatus) => {
        if (cancelled) return;
        if (d.promoActivated) {
          router.replace("/boloes");
          return;
        }
        if (!d.alreadySubmitted) {
          router.replace("/homepage");
          return;
        }
        setGateReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/homepage");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!gateReady) {
    return <div className="min-h-screen w-full bg-[#0a0a0a]" />;
  }

  return (
    <div
      className="flex w-full flex-col items-center bg-[#0a0a0a] px-4 py-2 pb-6"
      style={{ fontFamily: PROMO_FONT }}
    >
      <div className="flex w-full max-w-[390px] flex-col">
        {/* ── HEADER ── */}
        <div className="flex items-center gap-2.5 text-left flex-col mb-2">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: GREEN, background: `${GREEN}18` }}
              >
                <AlertTriangle
                  className="size-4.5"
                  strokeWidth={2.5}
                  style={{ color: GREEN }}
                />
              </div>
              <p className="text-[22px] font-black uppercase italic leading-none tracking-tight text-center">
                <span className="text-white">Falta </span>
                <span style={{ color: GREEN }}>1 Passo!</span>
              </p>
            </div>

            <p className="text-[11px] font-medium leading-snug text-white/80">
              Seu Palpite foi salvo, mas ainda{" "}
              <span className="font-bold" style={{ color: GREEN }}>
                não
              </span>{" "}
            </p>
            <p className="text-[11px] font-medium leading-snug text-white/80 text-center">
              está{" "}
              <span className="font-bold" style={{ color: GREEN }}>
                participando
              </span>{" "}
              da promoção.
            </p>
          </div>
        </div>

        {/* ── SEU PALPITE ── */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-2 mb-2">
          <p className="mb-1.5 text-center text-[9px] font-black uppercase tracking-[0.18em] text-white/50">
            Seu Palpite
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <Image
                src={brasilLogo}
                alt="Brasil"
                width={32}
                height={32}
                className="size-8 object-contain"
                draggable={false}
              />
              <span className="text-[9px] font-black uppercase tracking-wide text-white/80">
                Brasil
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[30px] font-black tabular-nums leading-none text-white">
                {predCasa ?? "–"}
              </span>
              <span className="text-[14px] font-bold text-white/40">x</span>
              <span className="text-[30px] font-black tabular-nums leading-none text-white">
                {predVisitante ?? "–"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Image
                src={MARROCOS_SHIELD_URL}
                alt="Marrocos"
                width={32}
                height={32}
                unoptimized
                className="size-8 object-contain"
                draggable={false}
              />
              <span className="text-[9px] font-black uppercase tracking-wide text-white/80">
                Marrocos
              </span>
            </div>
          </div>
          <div
            className="mt-1.5 flex items-center justify-center gap-2 rounded-lg py-1"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <Image
              src={brasilLogo}
              alt=""
              width={12}
              height={12}
              className="size-3 object-contain"
              draggable={false}
            />
            <span className="text-[11px] font-semibold text-white/60">
              Escanteios Brasil:
            </span>
            <span className="text-[13px] font-black tabular-nums text-white">
              {escanteiosBrasil ?? "–"}
            </span>
          </div>
        </div>

        {/* ── AO ATIVAR SUA COTA divider ── */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="h-px flex-1"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
          <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-white/50">
            Ao ativar sua cota, você concorre a:
          </span>
          <div
            className="h-px flex-1"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* ── PRIZE: camisa | dinheiro ── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111] mb-2">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              <Image
                src={camisaBraImg}
                alt="Camisa oficial da Seleção Brasileira"
                width={120}
                height={78}
                className="object-contain"
                priority
                draggable={false}
              />
              <p
                className="text-[12px] font-black uppercase italic leading-tight"
                style={{ color: GREEN }}
              >
                Camisa Oficial
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-white">
                da Seleção Brasileira
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-2">
              <Image
                src={dinheiroImg}
                alt="R$ 1.000 no PIX"
                width={120}
                height={120}
                className="object-contain"
                draggable={false}
              />
              <p
                className="text-[20px] font-black uppercase italic leading-tight"
                style={{ color: GREEN }}
              >
                R$ 1.000
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-white">
                no PIX
              </p>
            </div>
          </div>
        </div>

        {/* ── WARNING: sem cota ativa ── */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 mb-2">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `${GREEN}18`,
              border: `1.5px solid ${GREEN}55`,
            }}
          >
            <ShieldAlert
              className="size-[18px]"
              strokeWidth={2.5}
              style={{ color: GREEN }}
            />
          </div>
          <p className="text-[11px] font-medium leading-snug text-white/80">
            Sem uma cota ativa, seu palpite{" "}
            <span className="font-bold" style={{ color: GREEN }}>
              não participa
            </span>{" "}
            da promoção.
          </p>
        </div>

        {/* ── ATIVE SUA PARTICIPAÇÃO AGORA divider ── */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1" style={{ background: `${GREEN}35` }} />
          <span
            className="text-[8.5px] font-black uppercase italic tracking-[0.14em]"
            style={{ color: GREEN }}
          >
            Ative sua participação Agora
          </span>
          <div className="h-px flex-1" style={{ background: `${GREEN}35` }} />
        </div>

        {/* ── OFFER CARD ── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111] mb-2">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            <div className="flex flex-col justify-center px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-white">
                Concorra a mais de
              </p>
              <p
                className="text-[24px] font-black uppercase italic leading-none tracking-tight"
                style={{ color: GREEN }}
              >
                R$ 1 Milhão
              </p>
              <p className="text-[10px] font-black uppercase tracking-wide text-white">
                em premiações no Bolão
              </p>
              <p
                className="mt-1 text-[9px] font-black uppercase italic tracking-tight"
                style={{ color: GREEN }}
              >
                + Camisa Oficial e R$ 1.000 no PIX
              </p>
            </div>
            <div className="flex flex-col justify-center px-3 py-2.5">
              <p className="text-[10px] font-medium text-white/60">
                Por apenas
              </p>
              <p className="mt-0.5 leading-none">
                <span className="text-[12px] font-bold text-white/70">
                  R$&nbsp;
                </span>
                <span className="text-[26px] font-black tabular-nums text-white">
                  29,90
                </span>
              </p>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Check
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                    style={{ color: GREEN }}
                  />
                  <span className="text-[10px] font-medium text-white/70">
                    Copa inteira
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className="size-3.5 shrink-0"
                    strokeWidth={2.5}
                    style={{ color: GREEN }}
                  />
                  <span className="text-[10px] font-medium text-white/70">
                    104 jogos para pontuar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <Link
          href={CHECKOUT_URL}
          className="flex min-h-[52px] w-full mb-2 items-center justify-between rounded-full px-5 text-[15px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          style={{ background: GREEN }}
        >
          <ShoppingCart className="size-5 shrink-0" strokeWidth={2.3} />
          <span className="flex-1 text-center">Ativar meu palpite</span>
          <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
        </Link>

        {/* ── FOOTER ── */}
        <div className="mb-1 flex items-center justify-center gap-1.5">
          <Lock className="size-3 shrink-0 text-white/35" strokeWidth={2} />
          <p className="text-center text-[10px] font-medium leading-snug text-white/45">
            Compra{" "}
            <strong className="font-bold text-white/70">100% segura</strong>.{" "}
            Pagamento via PIX com aprovação imediata.
          </p>
        </div>
      </div>
    </div>
  );
}
