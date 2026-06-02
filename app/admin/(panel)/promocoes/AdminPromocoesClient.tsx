"use client";

import { adminStatGridClass } from "@/app/admin/_components/admin-layout";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import { formatAdminDate } from "@/lib/admin/format";
import type { AdminBrasilEgitoPromoDashboard } from "@/lib/admin/brasil-egito-placar-promo";
import type { AdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import Link from "next/link";

function HitBadge({ hit }: { hit: boolean | null }) {
  if (hit == null) {
    return (
      <span className="inline-flex rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-bold uppercase text-white/55">
        Aguardando
      </span>
    );
  }
  if (hit) {
    return (
      <span className="inline-flex rounded-md border border-primary/35 bg-primary/12 px-2 py-0.5 text-[11px] font-black uppercase text-primary">
        Acertou
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-red-300">
      Errou
    </span>
  );
}

function EligibleBadge({ eligible }: { eligible: boolean }) {
  return eligible ? (
    <span className="inline-flex rounded-md border border-primary/35 bg-primary/12 px-2 py-0.5 text-[11px] font-black uppercase text-primary">
      Sim
    </span>
  ) : (
    <span className="inline-flex rounded-md border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] font-bold uppercase text-white/45">
      Não
    </span>
  );
}

type PlacarPromoDashboard =
  | AdminBrasilEgitoPromoDashboard
  | AdminBrasilPanamaPromoDashboard;

type PlacarPromoRow =
  | AdminBrasilEgitoPromoDashboard["rows"][number]
  | AdminBrasilPanamaPromoDashboard["rows"][number];

function PlacarPromoSection({
  title,
  resultEnvPrefix,
  data,
}: {
  title: string;
  resultEnvPrefix: string;
  data: PlacarPromoDashboard;
}) {
  const resultLabel =
    data.officialResult != null
      ? `${data.officialResult.casa} x ${data.officialResult.visitante}`
      : "Não configurado";

  const cards = [
    { label: "Palpites enviados", value: data.stats.submissionsCount.toLocaleString("pt-BR") },
    { label: "Placares exatos", value: data.stats.exactHitsCount.toLocaleString("pt-BR") },
    {
      label: `Elegíveis camisa (${data.friendsGoal} ind.)`,
      value: data.stats.shirtEligibleCount.toLocaleString("pt-BR"),
    },
    {
      label: "Promo ativa",
      value: data.promoEnabled && data.submissionOpen ? "Aberta" : "Fechada",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
        <h2 className="text-[15px] font-black uppercase tracking-wide text-white">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-white/55">
          Placar oficial:{" "}
          <strong className="font-bold text-white/85">{resultLabel}</strong>
          {data.closesAtIso ? (
            <>
              {" "}
              · Fecha em{" "}
              <strong className="font-bold text-white/85">
                {formatAdminDate(data.closesAtIso)}
              </strong>
            </>
          ) : null}
        </p>
        {data.officialResult == null ? (
          <p className="mt-2 text-[12px] font-medium text-amber-300/90">
            Configure{" "}
            <code className="rounded bg-white/8 px-1 py-0.5 text-[11px]">
              {resultEnvPrefix}_RESULT_CASA
            </code>{" "}
            e{" "}
            <code className="rounded bg-white/8 px-1 py-0.5 text-[11px]">
              {resultEnvPrefix}_RESULT_VISITANTE
            </code>{" "}
            no servidor para marcar quem acertou.
          </p>
        ) : null}
        <p className="mt-2 text-[12px] text-white/48">
          Camisa oficial: somente quem acertou o placar{" "}
          <strong className="text-white/70">e</strong> indicou{" "}
          {data.friendsGoal} amigos.
        </p>
      </section>

      <div className={adminStatGridClass}>
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/8 bg-[#111] px-4 py-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">
              {card.label}
            </p>
            <p className="mt-1 text-[22px] font-black tabular-nums text-white">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <AdminTableScroll>
        <table className="min-w-[920px] w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wide text-white/45">
              <th className="px-3 py-3">Usuário</th>
              <th className="px-3 py-3">Palpite</th>
              <th className="px-3 py-3">Placar</th>
              <th className="px-3 py-3">Indicações</th>
              <th className="px-3 py-3">Cota grátis</th>
              <th className="px-3 py-3">Camisa ({data.friendsGoal} ind.)</th>
              <th className="px-3 py-3">Enviado em</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-white/45">
                  Nenhum palpite registrado ainda.
                </td>
              </tr>
            ) : (
              data.rows.map((row: PlacarPromoRow) => (
                <tr
                  key={row.userId}
                  className="border-b border-white/6 text-white/85 hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/users/${row.userId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {row.userName?.trim() || "Sem nome"}
                    </Link>
                    <p className="text-[12px] text-white/45">{row.userEmail}</p>
                  </td>
                  <td className="px-3 py-3 font-black tabular-nums">
                    {row.predCasa} x {row.predVisitante}
                  </td>
                  <td className="px-3 py-3">
                    <HitBadge hit={row.scoreExactHit} />
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums">
                    <span
                      className={
                        row.friendsInvited >= row.friendsGoal
                          ? "text-primary"
                          : "text-white/75"
                      }
                    >
                      {row.friendsInvited}
                    </span>
                    <span className="text-white/40"> / {row.friendsGoal}</span>
                  </td>
                  <td className="px-3 py-3">
                    <EligibleBadge eligible={row.freeTicketPrizeEligible} />
                  </td>
                  <td className="px-3 py-3">
                    <EligibleBadge eligible={row.shirtPrizeEligible} />
                  </td>
                  <td className="px-3 py-3 text-white/55">
                    {formatAdminDate(row.submittedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableScroll>
    </div>
  );
}

export function AdminPromocoesClient({
  brasilEgito,
  brasilPanama,
}: {
  brasilEgito: AdminBrasilEgitoPromoDashboard;
  brasilPanama: AdminBrasilPanamaPromoDashboard;
}) {
  return (
    <div className="space-y-12">
      <PlacarPromoSection
        title="Brasil x Egito — Placar exato"
        resultEnvPrefix="BRASIL_EGITO_PLACAR"
        data={brasilEgito}
      />
      {brasilPanama.stats.submissionsCount > 0 || brasilPanama.promoEnabled ? (
        <PlacarPromoSection
          title="Brasil x Panamá — Placar exato (legado)"
          resultEnvPrefix="BRASIL_PANAMA_PLACAR"
          data={brasilPanama}
        />
      ) : null}
    </div>
  );
}
