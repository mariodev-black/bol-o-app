import Link from "next/link";
import { ArrowRight, Gift, Target, Ticket, Users } from "lucide-react";
import { AdminBolaoKindBadge, AdminBolaoKindIcon, type AdminBolaoKind } from "./AdminBolaoKindIcon";
import { AdminBolaoStat } from "./AdminBolaoStat";
import type { ExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";

type CardStats = {
  ticketsCount: number;
  playersCount: number;
  totalPoints?: number;
  finishedCount?: number;
  promoTicketsCount?: number;
};

export function AdminBolaoDashboardCard({
  href,
  kind,
  extraVariant,
  eyebrow,
  title,
  subtitle,
  badge,
  stats,
}: {
  href: string;
  kind: AdminBolaoKind;
  extraVariant?: ExtraBolaoHeroSideVariant;
  eyebrow: string;
  title: string;
  subtitle: string;
  badge?: string;
  stats: CardStats;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[18px] border border-white/8 bg-white/3 p-5 transition-colors hover:border-primary/25 hover:bg-white/5"
    >
      <div className="flex items-start gap-4">
        <AdminBolaoKindIcon kind={kind} extraVariant={extraVariant} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AdminBolaoKindBadge kind={kind} />
            {badge ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-white/55">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h3 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-white">{title}</h3>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-white/40">{subtitle}</p>
        </div>
      </div>

      <div
        className={`mt-5 grid gap-2 ${
          stats.promoTicketsCount != null && stats.promoTicketsCount > 0
            ? "grid-cols-2 sm:grid-cols-4"
            : stats.finishedCount != null
              ? "grid-cols-3"
              : "grid-cols-3"
        }`}
      >
        <AdminBolaoStat icon={Ticket} label="Cotas" value={stats.ticketsCount} accent="primary" />
        <AdminBolaoStat icon={Users} label="Jogadores" value={stats.playersCount} />
        {stats.finishedCount != null ? (
          <AdminBolaoStat icon={Target} label="Finalizadas" value={stats.finishedCount} />
        ) : (
          <AdminBolaoStat icon={Target} label="Pontos" value={stats.totalPoints ?? 0} />
        )}
        {stats.promoTicketsCount != null && stats.promoTicketsCount > 0 ? (
          <AdminBolaoStat icon={Gift} label="Grátis" value={stats.promoTicketsCount} accent="amber" />
        ) : null}
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-primary">
        Abrir detalhes
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
      </p>
    </Link>
  );
}
