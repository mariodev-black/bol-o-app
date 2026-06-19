"use client";

import Link from "next/link";
import { Gift, ShieldCheck, Trophy, Zap } from "lucide-react";

const GREEN = "#B1EB0B";
const CARD_BG = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.07)";

type BandItem = {
  icon: React.ElementType;
  iconColor: string;
  eyebrow: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
};

const ITEMS: BandItem[] = [
  {
    icon: Gift,
    iconColor: GREEN,
    eyebrow: "PROMOÇÃO ATIVA",
    title: "Palpite Brasil x Marrocos",
    description: "Concorra à camisa oficial + R$ 1.000 no PIX",
    cta: { label: "PARTICIPAR", href: "/promo-camisa-brasil" },
  },
  {
    icon: ShieldCheck,
    iconColor: "#4ADE80",
    eyebrow: "100% SEGURO",
    title: "100% Seguro",
    description: "Seus dados e pagamentos protegidos com segurança.",
  },
  {
    icon: Trophy,
    iconColor: "#FACC15",
    eyebrow: "LÍDER EM BOLÕES",
    title: "Líder em Bolões",
    description: "Mais de 1 milhão de usuários em todo o Brasil.",
  },
  {
    icon: Zap,
    iconColor: "#60A5FA",
    eyebrow: "PAGAMENTO RÁPIDO",
    title: "Pagamento Rápido",
    description: "Prêmios pagos via PIX em até 1 hora.",
  },
];

function BandCard({ item }: { item: BandItem }) {
  const Icon = item.icon;
  return (
    <article
      className="flex min-w-0 items-start gap-3 rounded-[14px] border p-3.5"
      style={{ background: CARD_BG, borderColor: BORDER }}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/5">
        <Icon className="size-5" style={{ color: item.iconColor }} strokeWidth={1.8} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/45">{item.eyebrow}</p>
        <p className="mt-0.5 text-[12px] font-black leading-snug text-white">{item.title}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-white/60">{item.description}</p>
        {item.cta ? (
          <Link
            href={item.cta.href}
            className="mt-2 inline-flex h-7 items-center rounded-[7px] px-3 text-[10px] font-black uppercase tracking-wide transition hover:brightness-110 active:scale-[0.98]"
            style={{ background: GREEN, color: "#0E141B" }}
          >
            {item.cta.label}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function HomeFeatureBand({
  promoEnabled = false,
  className = "",
}: {
  promoEnabled?: boolean;
  className?: string;
}) {
  const items = promoEnabled ? ITEMS : ITEMS.slice(1);
  return (
    <section className={`${className}`} aria-label="Destaques">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <BandCard key={item.eyebrow} item={item} />
        ))}
      </div>
    </section>
  );
}
