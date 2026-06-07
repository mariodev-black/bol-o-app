"use client";

import { AdminTabBar } from "@/app/admin/_components/AdminTabBar";
import { adminStatGridClass, adminTabButtonClass } from "@/app/admin/_components/admin-layout";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import { formatAdminDate } from "@/lib/admin/format";
import type { AdminBrasilEgitoPromoDashboard } from "@/lib/admin/brasil-egito-placar-promo";
import type { AdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import { Download, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPromoEmailDispatch } from "./AdminPromoEmailDispatch";
import { AdminPromoHubLinks } from "./AdminPromoHubLinks";

type PromocoesTab = "palpites" | "email";

type PrizeFilter = "all" | "exact_hit" | "missed" | "free_ticket" | "shirt";

const PRIZE_FILTER_LABELS: Record<PrizeFilter, string> = {
  all: "Todos os palpites",
  exact_hit: "Acertaram o placar",
  missed: "Erraram o placar",
  free_ticket: "Elegíveis cota grátis",
  shirt: "Elegíveis camisa",
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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

function officialResultSourceLabel(
  source: AdminBrasilEgitoPromoDashboard["officialResult"] extends infer R
    ? R extends { source: infer S }
      ? S
      : never
    : never,
): string {
  switch (source) {
    case "env":
      return "variáveis de ambiente";
    case "match_cache":
      return "placar salvo em Amistosos";
    case "confirmed":
      return "placar confirmado (2 x 1)";
    default:
      return "";
  }
}

function WinnersPanel({
  rows,
  friendsGoal,
}: {
  rows: PlacarPromoRow[];
  friendsGoal: number;
}) {
  const freeTicketWinners = rows.filter((row) => row.freeTicketPrizeEligible);
  const shirtWinners = rows.filter((row) => row.shirtPrizeEligible);

  if (freeTicketWinners.length === 0 && shirtWinners.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-white/45" strokeWidth={2.2} />
          <h3 className="text-[14px] font-black uppercase tracking-wide text-white">
            Ganhadores
          </h3>
        </div>
        <p className="mt-2 text-[13px] text-white/55">
          Nenhum palpite exato registrado para esta promoção.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-primary" strokeWidth={2.2} />
        <h3 className="text-[14px] font-black uppercase tracking-wide text-white">
          Ganhadores
        </h3>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-primary">
            Cota grátis — placar exato
          </p>
          <p className="mt-1 text-[22px] font-black tabular-nums text-white">
            {freeTicketWinners.length.toLocaleString("pt-BR")}
          </p>
          {freeTicketWinners.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[13px] text-white/80">
              {freeTicketWinners.map((row) => (
                <li key={row.userId}>
                  <Link
                    href={`/admin/users/${row.userId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {row.userName?.trim() || "Sem nome"}
                  </Link>
                  <span className="text-white/45"> · {row.userEmail}</span>
                  <span className="ml-1 font-black tabular-nums text-white/70">
                    ({row.predCasa} x {row.predVisitante})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-white/45">Nenhum ganhador.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-primary">
            Camisa oficial — placar + {friendsGoal} indicações
          </p>
          <p className="mt-1 text-[22px] font-black tabular-nums text-white">
            {shirtWinners.length.toLocaleString("pt-BR")}
          </p>
          {shirtWinners.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[13px] text-white/80">
              {shirtWinners.map((row) => (
                <li key={row.userId}>
                  <Link
                    href={`/admin/users/${row.userId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {row.userName?.trim() || "Sem nome"}
                  </Link>
                  <span className="text-white/45"> · {row.userEmail}</span>
                  <span className="ml-1 text-white/55">
                    ({row.friendsInvited}/{row.friendsGoal} ind.)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-white/45">
              Nenhum ganhador com {friendsGoal} indicações válidas.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function PlacarPromoSection({
  title,
  data,
  exportSlug,
  showWinners = false,
}: {
  title: string;
  data: PlacarPromoDashboard;
  exportSlug?: string;
  showWinners?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [prizeFilter, setPrizeFilter] = useState<PrizeFilter>("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const resultLabel =
    data.officialResult != null
      ? `${data.officialResult.casa} x ${data.officialResult.visitante}`
      : "Não configurado";

  const resultSource =
    data.officialResult != null &&
    "source" in data.officialResult &&
    data.officialResult.source
      ? officialResultSourceLabel(
          data.officialResult.source as "env" | "match_cache" | "confirmed",
        )
      : null;

  const filteredRows = useMemo(() => {
    const textQuery = normalize(query);
    return data.rows.filter((row) => {
      if (textQuery) {
        const haystack = `${normalize(row.userName)} ${normalize(row.userEmail)}`;
        if (!haystack.includes(textQuery)) return false;
      }
      switch (prizeFilter) {
        case "exact_hit":
          return row.scoreExactHit === true;
        case "missed":
          return row.scoreExactHit === false;
        case "free_ticket":
          return row.freeTicketPrizeEligible;
        case "shirt":
          return row.shirtPrizeEligible;
        default:
          return true;
      }
    });
  }, [data.rows, prizeFilter, query]);

  const freeTicketEligibleCount =
    "freeTicketEligibleCount" in data.stats
      ? data.stats.freeTicketEligibleCount
      : data.stats.exactHitsCount;

  const cards = [
    {
      label: "Palpites enviados",
      value: data.stats.submissionsCount.toLocaleString("pt-BR"),
    },
    {
      label: "Placares exatos",
      value: data.stats.exactHitsCount.toLocaleString("pt-BR"),
    },
    {
      label: "Elegíveis cota grátis",
      value: freeTicketEligibleCount.toLocaleString("pt-BR"),
    },
    {
      label: `Elegíveis camisa (${data.friendsGoal} ind.)`,
      value: data.stats.shirtEligibleCount.toLocaleString("pt-BR"),
    },
    {
      label: "Promo ativa",
      value: data.promoEnabled && data.submissionOpen ? "Aberta" : "Fechada",
    },
  ];

  async function handleExport() {
    if (!exportSlug) return;
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (prizeFilter !== "all") params.set("filter", prizeFilter);
      const qs = params.toString();
      const resp = await fetch(
        `/api/admin/promocoes/${exportSlug}/export${qs ? `?${qs}` : ""}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Não foi possível exportar.",
        );
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename =
        match?.[1] ?? `promo-${exportSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Erro ao exportar promoção.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
        <h2 className="text-[15px] font-black uppercase tracking-wide text-white">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-white/55">
          Placar oficial:{" "}
          <strong className="font-bold text-white/85">{resultLabel}</strong>
          {resultSource ? (
            <span className="text-white/40"> · via {resultSource}</span>
          ) : null}
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
        <p className="mt-2 text-[12px] text-white/48">
          Camisa oficial: somente quem acertou o placar{" "}
          <strong className="text-white/70">e</strong> indicou{" "}
          {data.friendsGoal} amigos.
        </p>
      </section>

      {showWinners && data.officialResult != null ? (
        <WinnersPanel rows={data.rows} friendsGoal={data.friendsGoal} />
      ) : null}

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

      <section className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
            <label className="block">
              <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
                Buscar por nome ou e-mail
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Digite nome ou e-mail"
                autoComplete="off"
                className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/45"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
                Filtrar por
              </span>
              <select
                value={prizeFilter}
                onChange={(event) =>
                  setPrizeFilter(event.target.value as PrizeFilter)
                }
                className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-bold text-white outline-none transition-colors focus:border-primary/45"
              >
                {Object.entries(PRIZE_FILTER_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#101010]">
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {exportSlug ? (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || filteredRows.length === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-primary/35 bg-primary/12 px-4 text-[13px] font-black uppercase tracking-wide text-primary transition hover:bg-primary/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />
              ) : (
                <Download className="size-4" strokeWidth={2.4} />
              )}
              Exportar Excel
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-[12px] text-white/45">
          Exibindo{" "}
          <strong className="text-white/70">
            {filteredRows.length.toLocaleString("pt-BR")}
          </strong>{" "}
          de {data.rows.length.toLocaleString("pt-BR")} palpites
          {exportSlug ? " · exportação respeita busca e filtro ativos" : ""}
        </p>
        {exportError ? (
          <p className="mt-2 text-[12px] font-medium text-red-300">
            {exportError}
          </p>
        ) : null}
      </section>

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
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-white/45">
                  Nenhum palpite encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              filteredRows.map((row: PlacarPromoRow) => (
                <tr
                  key={row.userId}
                  className={`border-b border-white/6 text-white/85 hover:bg-white/[0.03] ${
                    row.freeTicketPrizeEligible ? "bg-primary/[0.03]" : ""
                  }`}
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
  hubUrl,
}: {
  brasilEgito: AdminBrasilEgitoPromoDashboard;
  brasilPanama: AdminBrasilPanamaPromoDashboard;
  hubUrl: string;
}) {
  const [tab, setTab] = useState<PromocoesTab>("palpites");

  return (
    <div className="space-y-8">
      <AdminTabBar>
        {(
          [
            { id: "palpites" as const, label: "Palpites e ganhadores" },
            { id: "email" as const, label: "Disparo" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              adminTabButtonClass,
              tab === item.id
                ? "bg-primary text-black"
                : "border border-white/10 bg-white/5 text-white/48 hover:text-white",
            ].join(" ")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </AdminTabBar>

      {tab === "email" ? (
        <AdminPromoEmailDispatch data={brasilEgito} />
      ) : (
        <div className="space-y-12">
          <AdminPromoHubLinks hubUrl={hubUrl} />
          <PlacarPromoSection
            title="Brasil x Egito — Placar exato"
            data={brasilEgito}
            exportSlug="brasil-egito"
            showWinners
          />
          {brasilPanama.stats.submissionsCount > 0 ||
          brasilPanama.promoEnabled ? (
            <PlacarPromoSection
              title="Brasil x Panamá — Placar exato (legado)"
              data={brasilPanama}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
