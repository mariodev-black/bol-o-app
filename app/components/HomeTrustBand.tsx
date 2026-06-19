"use client";

import { Banknote, RefreshCw, ShieldCheck, Headphones, Users } from "lucide-react";

const GREEN = "#B1EB0B";

type TrustItem = {
  icon: React.ElementType;
  title: string;
  subtitle: string;
};

const ITEMS: TrustItem[] = [
  { icon: Banknote, title: "SAQUES VIA PIX", subtitle: "Rápido e seguro" },
  { icon: ShieldCheck, title: "100% CONFIÁVEL", subtitle: "Plataforma segura" },
  { icon: Headphones, title: "SUPORTE 24/7", subtitle: "Estamos sempre online" },
  { icon: Users, title: "+1 MILHÃO DE USUÁRIOS", subtitle: "Junte-se aos campeões" },
  { icon: RefreshCw, title: "ATUALIZAÇÕES EM TEMPO REAL", subtitle: "Não perca nada" },
];

export function HomeTrustBand({ className = "" }: { className?: string }) {
  return (
    <section
      className={`border-t pt-5 ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
      aria-label="Diferenciais"
    >
      <div className="grid grid-cols-5 gap-4">
        {ITEMS.map(({ icon: Icon, title, subtitle }) => (
          <div key={title} className="flex items-center gap-3">
            <Icon className="size-6 shrink-0" style={{ color: GREEN }} strokeWidth={1.9} aria-hidden />
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase leading-tight tracking-[0.02em] text-white">
                {title}
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/50">
                {subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
