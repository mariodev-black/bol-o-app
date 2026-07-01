"use client";

import { resolveAdminBolaoStatus } from "@/lib/admin/bolao-hub-filter";
import {
  adminBolaoStatusLabel,
  ADMIN_BOLAO_STATUS_STYLES,
  isClosedBolaoStatus,
} from "@/lib/boloes/definitions/lifecycle-labels";
import type { AdminBolaoHubItem } from "@/lib/boloes/definitions/types";
import { resolveAdminBolaoHubIconVariant } from "@/lib/admin/bolao-hub-logo";
import { extraBolaoIconSrc } from "@/app/shared/extra-bolao-icons";
import {
  Copy,
  Eye,
  Pencil,
  Radio,
  Ticket,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

function formatDateBR(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function BolaoLogo({ item }: { item: AdminBolaoHubItem }) {
  const iconVariant = resolveAdminBolaoHubIconVariant(item);
  const fallbackSrc = extraBolaoIconSrc(iconVariant).src;
  const src = item.resolvedLogoUrl || fallbackSrc;

  return (
    <div className="flex size-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[#0a0a0a]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="size-[44px] object-contain"
        loading="lazy"
      />
    </div>
  );
}

type Props = {
  item: AdminBolaoHubItem;
  saving: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function AdminBolaoDefinitionCard({ item, saving, onDuplicate, onDelete }: Props) {
  const status = resolveAdminBolaoStatus(item);
  const statusLabel = adminBolaoStatusLabel(status);
  const statusStyle = ADMIN_BOLAO_STATUS_STYLES[status];
  const closed = isClosedBolaoStatus(status);
  const readOnly = Boolean(item.isLegacy);
  const detailHref = item.detailHref ?? `/admin/boloes/definicoes/${item.id}`;
  const editHref = `/admin/boloes/definicoes/${item.id}/edit`;

  const periodLabel =
    item.startsAt || item.endsAt
      ? [formatDateBR(item.startsAt), formatDateBR(item.endsAt)].filter(Boolean).join(" → ")
      : null;

  const metaLabel = [item.datesLabel, item.competitionDisplayName, periodLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative overflow-hidden rounded-[20px] border border-white/8 bg-[#0c0c0c] transition duration-200 hover:border-primary/25">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/35 to-transparent opacity-0 transition group-hover:opacity-100" />

      <Link href={detailHref} className="block p-5 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <BolaoLogo item={item} />
            {status === "ao_vivo" ? (
              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-[#0c0c0c]">
                <Radio className="size-2 text-white" aria-hidden />
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusStyle}`}
              >
                {statusLabel}
              </span>
              {status === "premiacao_liberada" ? (
                <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-200">
                  Premiação ok
                </span>
              ) : null}
              {!item.enabled ? (
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/35">
                  Desativado
                </span>
              ) : readOnly ? (
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/40">
                  Sistema
                </span>
              ) : item.saleEnabled && !closed ? (
                <span className="inline-flex rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary/90">
                  Na loja
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-white">
              {item.displayName}
            </h3>
            {(item.subtitle ?? item.slug) ? (
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/42">
                {item.subtitle ?? item.slug}
              </p>
            ) : null}
            <p className="mt-2 text-[13px] font-black tabular-nums text-primary">
              Cota {formatBRL(item.unitPriceCents)}
            </p>
          </div>
        </div>

        {metaLabel ? (
          <p className="mt-3 line-clamp-2 text-[11px] text-white/35">{metaLabel}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[12px] border border-white/6 bg-[#080808] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-white/35">
              <Ticket className="size-3.5" strokeWidth={2.2} />
              <span className="text-[10px] font-bold uppercase tracking-wide">Cotas</span>
            </div>
            <p className="mt-1 text-[16px] font-black tabular-nums text-white">
              {item.ticketsPaid.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-[12px] border border-white/6 bg-[#080808] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-white/35">
              <Users className="size-3.5" strokeWidth={2.2} />
              <span className="text-[10px] font-bold uppercase tracking-wide">Jogadores</span>
            </div>
            <p className="mt-1 text-[16px] font-black tabular-nums text-white">
              {item.participants.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-[12px] border border-white/6 bg-[#080808] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-white/35">
              <TrendingUp className="size-3.5" strokeWidth={2.2} />
              <span className="text-[10px] font-bold uppercase tracking-wide">Receita</span>
            </div>
            <p className="mt-1 text-[13px] font-black tabular-nums leading-tight text-primary">
              {formatBRL(item.revenueCents)}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-white/6 px-3 py-2.5">
        {readOnly ? (
          <Link
            href={detailHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-white/6 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-primary hover:text-[#0a0a0a]"
          >
            <Eye className="size-3.5" strokeWidth={2.4} />
            Ver ranking
          </Link>
        ) : (
          <>
            <Link
              href={editHref}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-white/6 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-primary hover:text-[#0a0a0a]"
            >
              <Pencil className="size-3.5" strokeWidth={2.4} />
              Editar
            </Link>
            <Link
              href={detailHref}
              className="rounded-[10px] border border-white/10 p-2 text-white/55 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
              aria-label="Ver detalhes"
            >
              <Eye className="size-4" />
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => onDuplicate(item.id)}
              className="rounded-[10px] border border-white/10 p-2 text-white/55 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-40"
              aria-label="Duplicar"
            >
              <Copy className="size-4" />
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onDelete(item.id)}
              className="rounded-[10px] border border-red-400/20 p-2 text-red-300/80 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
              aria-label="Desativar"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
