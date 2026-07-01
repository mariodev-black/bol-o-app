"use client";

import { formatCentsBRL } from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoCurrencyInput";
import {
  adminBolaoStatusLabel,
  ADMIN_BOLAO_STATUS_STYLES,
} from "@/lib/boloes/definitions/lifecycle-labels";
import type { AdminBolaoHubItem } from "@/lib/boloes/definitions/types";
import { extraBolaoIconSrc } from "@/app/shared/extra-bolao-icons";
import type { ExtraBolaoIconVariant } from "@/app/shared/extra-bolao-icons";
import { calculateDefinitionPrizePoolCents } from "@/lib/boloes/definitions/prizes";
import { Pencil } from "lucide-react";
import Link from "next/link";

export function AdminBolaoDefinitionDetailClient({
  id,
  item,
}: {
  id: string;
  item: AdminBolaoHubItem;
}) {
  const logoSrc =
    item.resolvedLogoUrl ??
    extraBolaoIconSrc(
      (item.resolvedIconVariant || "generic") as ExtraBolaoIconVariant,
    ).src;
  const status = item.computedStatus;
  const prizePoolCents = calculateDefinitionPrizePoolCents(item, item.revenueCents);
  const operatorCents = Math.max(0, item.revenueCents - prizePoolCents);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/boloes"
          className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/45 hover:text-primary"
        >
          ← Voltar aos bolões
        </Link>
        <Link
          href={`/admin/boloes/definicoes/${id}/edit`}
          className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-black uppercase text-white/80 hover:bg-white/10"
        >
          <Pencil className="size-4" />
          Editar
        </Link>
      </div>

      <div className="rounded-[16px] border border-white/8 bg-[#101010] p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="max-h-full max-w-full object-contain p-1.5"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${ADMIN_BOLAO_STATUS_STYLES[status]}`}
              >
                {adminBolaoStatusLabel(status)}
              </span>
            </div>
            <h2 className="text-[20px] font-black text-white">{item.displayName}</h2>
            <p className="mt-1 text-[13px] text-white/45">{item.subtitle ?? item.slug}</p>
            <p className="mt-2 text-[12px] text-white/35">
              {item.competitionDisplayName || `#${item.competitionId}`} · {item.matchCount} jogo(s)
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">
              Preço
            </p>
            <p className="text-[22px] font-black text-primary">
              {formatCentsBRL(item.unitPriceCents)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Cotas pagas", value: String(item.ticketsPaid) },
          { label: "Pendentes", value: String(item.ticketsPending) },
          { label: "Receita", value: formatCentsBRL(item.revenueCents) },
          { label: "Participantes", value: String(item.participants) },
        ].map((card) => (
            <div
              key={card.label}
              className="rounded-[14px] border border-white/8 bg-[#0d0d0d] px-4 py-3"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                {card.label}
              </p>
              <p className="mt-1 text-[20px] font-black tabular-nums text-white">{card.value}</p>
            </div>
          ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[14px] border border-white/8 bg-[#0d0d0d] p-4">
          <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-white/40">
            Faturamento
          </h3>
          <dl className="mt-3 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Receita confirmada</dt>
              <dd className="font-bold tabular-nums text-primary">
                {formatCentsBRL(item.revenueCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Cotas pagas</dt>
              <dd className="font-bold tabular-nums text-white">{item.ticketsPaid}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Cotas pendentes</dt>
              <dd className="font-bold tabular-nums text-white">{item.ticketsPending}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Pool de premiação ({item.prizePoolBps / 100}%)</dt>
              <dd className="font-bold tabular-nums text-white">
                {formatCentsBRL(prizePoolCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-white/6 pt-2">
              <dt className="text-white/55">Margem operacional</dt>
              <dd className="font-bold tabular-nums text-white/80">
                {formatCentsBRL(operatorCents)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[14px] border border-white/8 bg-[#0d0d0d] p-4">
          <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-white/40">
            Distribuição do pool
          </h3>
          <p className="mt-2 text-[13px] text-white/60">
            Com base na receita confirmada de{" "}
            <span className="font-bold text-white">{formatCentsBRL(item.revenueCents)}</span>
          </p>
          <ul className="mt-3 space-y-2">
            {item.prizeTiers.map((tier) => (
              <li key={tier.rank} className="flex justify-between text-[13px] text-white/75">
                <span>{tier.rank}º lugar</span>
                <span className="font-bold tabular-nums">
                  {formatCentsBRL(Math.floor((prizePoolCents * tier.poolBps) / 10000))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[14px] border border-white/8 bg-[#0d0d0d] p-4">
          <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-white/40">
            Escopo e venda
          </h3>
          <dl className="mt-3 space-y-2 text-[13px] text-white/70">
            <div className="flex justify-between gap-4">
              <dt>Dias</dt>
              <dd className="text-right font-medium text-white">
                {item.scopeDates.length > 0 ? item.scopeDates.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Edição / rodada</dt>
              <dd className="font-medium text-white">
                {item.editionNumber ?? item.roundNumber ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Venda</dt>
              <dd className="font-bold text-primary">
                {item.saleEnabled && item.enabled ? "Ativo" : "Inativo"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Palpites</dt>
              <dd className="font-medium text-white">{item.predictionsCount}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
