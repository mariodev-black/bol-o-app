"use client";

import { getScopeCardAction } from "@/app/(authenticated)/ranking/_components/ranking-flow";
import { RankingScopeCarousel } from "@/app/(authenticated)/ranking/_components/RankingScopeCarousel";
import {
  groupScopesByKind,
  partitionScopesByStatus,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-groups";
import {
  RankingScopeCard,
  RankingScopeGroupLabel,
} from "@/app/(authenticated)/ranking/_components/RankingScopeCard";
import type { RankingScopeOption } from "@/lib/ranking/scopes-shared";

function ScopeCardsRow({
  items,
  highlightTicketId,
  onOpenRanking,
  onOpenSteps,
}: {
  items: RankingScopeOption[];
  highlightTicketId: string;
  onOpenRanking: (scope: RankingScopeOption) => void;
  onOpenSteps: (scope: RankingScopeOption) => void;
}) {
  if (items.length === 0) return null;

  return (
    <RankingScopeCarousel itemCount={items.length}>
      {items.map((option) => {
        const action = getScopeCardAction(option);
        const highlighted =
          Boolean(highlightTicketId) && option.ticketId === highlightTicketId;
        return (
          <RankingScopeCard
            key={option.key}
            option={option}
            highlighted={highlighted}
            action={action}
            carouselItem={items.length > 1}
            onOpenRanking={() => onOpenRanking(option)}
            onOpenSteps={
              action === "palpites" ? () => onOpenSteps(option) : undefined
            }
          />
        );
      })}
    </RankingScopeCarousel>
  );
}

function ScopesByKindSections({
  scopes,
  highlightTicketId,
  onOpenRanking,
  onOpenSteps,
  flat = false,
}: {
  scopes: RankingScopeOption[];
  highlightTicketId: string;
  onOpenRanking: (scope: RankingScopeOption) => void;
  onOpenSteps: (scope: RankingScopeOption) => void;
  /** Lista única (ex.: finalizados) — sem agrupar por campeonato. */
  flat?: boolean;
}) {
  if (flat) {
    return (
      <ScopeCardsRow
        items={scopes}
        highlightTicketId={highlightTicketId}
        onOpenRanking={onOpenRanking}
        onOpenSteps={onOpenSteps}
      />
    );
  }

  const { principal, diario, extraGroups } = groupScopesByKind(scopes);
  const extraItems = extraGroups.flatMap((group) => group.items);

  if (principal.length === 0 && diario.length === 0 && extraItems.length === 0) {
    return null;
  }

  return (
    <>
      {principal.length > 0 ? (
        <section className="mt-6 first:mt-8">
          <RankingScopeGroupLabel>Bolão geral</RankingScopeGroupLabel>
          <ScopeCardsRow
            items={principal}
            highlightTicketId={highlightTicketId}
            onOpenRanking={onOpenRanking}
            onOpenSteps={onOpenSteps}
          />
        </section>
      ) : null}

      {diario.length > 0 ? (
        <section className="mt-6">
          <RankingScopeGroupLabel>Bolão do dia</RankingScopeGroupLabel>
          <ScopeCardsRow
            items={diario}
            highlightTicketId={highlightTicketId}
            onOpenRanking={onOpenRanking}
            onOpenSteps={onOpenSteps}
          />
        </section>
      ) : null}

      {extraItems.length > 0 ? (
        <section className="mt-6">
          <RankingScopeGroupLabel>Bolão extra</RankingScopeGroupLabel>
          <ScopeCardsRow
            items={extraItems}
            highlightTicketId={highlightTicketId}
            onOpenRanking={onOpenRanking}
            onOpenSteps={onOpenSteps}
          />
        </section>
      ) : null}
    </>
  );
}

export function RankingScopePicker({
  scopes,
  highlightTicketId,
  onOpenRanking,
  onOpenSteps,
}: {
  scopes: RankingScopeOption[];
  highlightTicketId: string;
  onOpenRanking: (scope: RankingScopeOption) => void;
  onOpenSteps: (scope: RankingScopeOption) => void;
}) {
  const { active, finished } = partitionScopesByStatus(scopes);

  return (
    <>
      <ScopesByKindSections
        scopes={active}
        highlightTicketId={highlightTicketId}
        onOpenRanking={onOpenRanking}
        onOpenSteps={onOpenSteps}
      />

      {finished.length > 0 ? (
        <section className="mt-10">
          <RankingScopeGroupLabel>Finalizados</RankingScopeGroupLabel>
          <p className="-mt-1 mb-4 text-[13px] font-medium leading-snug text-white/48">
            Bolões encerrados — consulte a classificação final.
          </p>
          <ScopesByKindSections
            scopes={finished}
            highlightTicketId={highlightTicketId}
            onOpenRanking={onOpenRanking}
            onOpenSteps={onOpenSteps}
            flat
          />
        </section>
      ) : null}
    </>
  );
}
