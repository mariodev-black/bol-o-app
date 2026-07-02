"use client";

import type {
  AdminCompetitionOption,
  BolaoDefinition,
  BolaoDefinitionInput,
  BolaoPrizeTier,
} from "@/lib/boloes/definitions/types";
import {
  BolaoCurrencyInput,
  formatCentsBRL,
} from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoCurrencyInput";
import {
  BolaoCompetitionMatchStep,
  type MatchIdsByCompetition,
} from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoCompetitionMatchStep";
import { BolaoDatetimeInput } from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoDatetimeInput";
import { BolaoImageUpload } from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoImageUpload";
import {
  datetimeLocalBrToIso,
  isoToDatetimeLocalBr,
} from "@/lib/client/datetime-local-br";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEPS = [
  { id: 1, title: "Nome e logo" },
  { id: 2, title: "Valor da cota" },
  { id: 3, title: "Campeonatos e jogos" },
  { id: 4, title: "Detalhes" },
  { id: 5, title: "Publicar" },
] as const;

const STEP_COUNT = STEPS.length;

type WizardProps = {
  mode: "create" | "edit";
  definitionId?: string;
  initialDefinition?: BolaoDefinition | null;
};

function flattenMatchIds(byComp: MatchIdsByCompetition): number[] {
  return [...new Set(Object.values(byComp).flat())].sort((a, b) => a - b);
}

function hydrateMatchIdsByComp(def: BolaoDefinition): MatchIdsByCompetition {
  const out: MatchIdsByCompetition = {};
  if (def.scopeConfig.competitions.length > 0) {
    for (const rule of def.scopeConfig.competitions) {
      if (rule.matchIds?.length) {
        out[rule.competitionId] = [...rule.matchIds];
      }
    }
    return out;
  }
  const compIds =
    def.competitionIds.length > 0 ? def.competitionIds : [def.competitionId];
  if (def.scopeMatchIds.length > 0 && compIds.length === 1) {
    out[compIds[0]!] = [...def.scopeMatchIds];
  }
  return out;
}

export function BolaoCreateWizard({ mode, definitionId, initialDefinition }: WizardProps) {
  const [step, setStep] = useState(1);
  const [savedDefinitionId, setSavedDefinitionId] = useState<string | undefined>(definitionId);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<AdminCompetitionOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [competitionIds, setCompetitionIds] = useState<number[]>([]);
  const [matchIdsByCompetition, setMatchIdsByCompetition] = useState<MatchIdsByCompetition>({});
  const [displayName, setDisplayName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [settlementAt, setSettlementAt] = useState("");
  const [prizeReleaseAt, setPrizeReleaseAt] = useState("");
  const [maxTicketsPerUser, setMaxTicketsPerUser] = useState("");
  const [unitPriceCents, setUnitPriceCents] = useState(0);
  const [prizePoolPercent, setPrizePoolPercent] = useState("");
  const [prizeTiers, setPrizeTiers] = useState<BolaoPrizeTier[]>([]);
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [shopVisible, setShopVisible] = useState(false);

  const competitionId = competitionIds[0] ?? null;
  const scopeMatchIds = useMemo(
    () => flattenMatchIds(matchIdsByCompetition),
    [matchIdsByCompetition],
  );

  const selectedCompetitions = useMemo(
    () => competitions.filter((c) => competitionIds.includes(c.id)),
    [competitions, competitionIds],
  );

  const hydrateFromDefinition = useCallback((def: BolaoDefinition) => {
    setCompetitionIds(
      def.competitionIds.length > 0 ? [...def.competitionIds] : [def.competitionId],
    );
    setMatchIdsByCompetition(hydrateMatchIdsByComp(def));
    setDisplayName(def.displayName);
    setSubtitle(def.subtitle ?? "");
    setDescription(def.description ?? "");
    setLogoUrl(def.logoUrl ?? "");
    setStartsAt(isoToDatetimeLocalBr(def.startsAt));
    setEndsAt(isoToDatetimeLocalBr(def.endsAt));
    setSettlementAt(isoToDatetimeLocalBr(def.settlementAt));
    setPrizeReleaseAt(isoToDatetimeLocalBr(def.prizeReleaseAt));
    setMaxTicketsPerUser(
      def.maxTicketsPerUser != null ? String(def.maxTicketsPerUser) : "",
    );
    setUnitPriceCents(def.unitPriceCents);
    setPrizePoolPercent(String(def.prizePoolBps / 100));
    setPrizeTiers(def.prizeTiers.length > 0 ? def.prizeTiers : []);
    setSaleEnabled(def.saleEnabled);
    setShopVisible(def.shopVisible);
  }, []);

  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/boloes/definitions/competitions", {
          credentials: "include",
        });
        const d = (await r.json()) as { competitions?: AdminCompetitionOption[] };
        if (cancelled) return;
        setCompetitions(d.competitions ?? []);
        if (mode === "edit" && initialDefinition && !hydratedRef.current) {
          hydrateFromDefinition(initialDefinition);
          hydratedRef.current = true;
        }
      } catch {
        if (!cancelled) setError("Falha ao carregar campeonatos");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, initialDefinition, hydrateFromDefinition]);

  function buildInput(): BolaoDefinitionInput {
    if (competitionIds.length === 0 || competitionId == null) {
      throw new Error("Selecione ao menos um campeonato");
    }
    if (scopeMatchIds.length === 0) {
      throw new Error("Selecione ao menos um jogo");
    }
    const poolBps = Math.round(Number(prizePoolPercent) * 100);
    return {
      displayName: displayName.trim(),
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      ticketType: "extra",
      competitionId,
      competitionIds,
      scopeMode: "custom_matches",
      scopeDates: [],
      scopeMatchIds,
      scopeConfig: {
        competitions: competitionIds
          .map((id) => ({
            competitionId: id,
            mode: "custom_matches" as const,
            matchIds: matchIdsByCompetition[id] ?? [],
          }))
          .filter((r) => r.matchIds.length > 0),
      },
      roundNumber: null,
      editionNumber: null,
      unitPriceCents,
      saleEnabled,
      shopVisible,
      enabled: true,
      logoUrl: logoUrl.trim() || null,
      bannerUrl: null,
      useCompetitionLogo: !logoUrl.trim(),
      startsAt: datetimeLocalBrToIso(startsAt),
      endsAt: datetimeLocalBrToIso(endsAt),
      settlementAt: datetimeLocalBrToIso(settlementAt),
      prizeReleaseAt: datetimeLocalBrToIso(prizeReleaseAt),
      maxTicketsPerUser: maxTicketsPerUser ? Number(maxTicketsPerUser) : null,
      prizePoolBps: poolBps,
      prizeTiers,
    };
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 2) {
      if (!displayName.trim()) return "Informe o nome do bolão";
    }
    if (targetStep >= 3) {
      if (unitPriceCents <= 0) return "Informe o valor da cota";
    }
    if (targetStep >= 4) {
      if (competitionIds.length === 0) return "Selecione ao menos um campeonato";
      if (scopeMatchIds.length === 0) return "Selecione ao menos um jogo";
      const withoutMatches = competitionIds.filter(
        (id) => !(matchIdsByCompetition[id]?.length ?? 0),
      );
      if (withoutMatches.length > 0) {
        return "Selecione jogos em todos os campeonatos escolhidos";
      }
    }
    if (targetStep >= 5) {
      const pool = Number(prizePoolPercent);
      const hasFixed = prizeTiers.some((t) => (t.amountCents ?? 0) > 0);
      const hasPoolShare = prizeTiers.some((t) => t.poolBps > 0);
      if (prizeTiers.length === 0) {
        return "Adicione ao menos uma colocação na premiação";
      }
      if (hasPoolShare) {
        if (!Number.isFinite(pool) || pool <= 0 || pool > 100) {
          return "Informe o pool de premiação (entre 1% e 100%)";
        }
        const tierTotal = prizeTiers.reduce((sum, t) => sum + t.poolBps, 0);
        if (tierTotal !== 10000) {
          return "A soma dos percentuais das colocações deve totalizar 100%";
        }
      } else if (!hasFixed) {
        return "Informe prêmio fixo (R$) ou percentual do pool em cada colocação";
      } else if (!Number.isFinite(pool) || pool < 0 || pool > 100) {
        return "Pool inválido (use 0% se todos os prêmios forem fixos)";
      }
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step + 1);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveNotice(null);
    try {
      const payload = buildInput();
      const activeId = savedDefinitionId ?? definitionId;
      const isUpdate = Boolean(activeId);
      const r = await fetch(
        isUpdate
          ? `/api/admin/boloes/definitions/${activeId}`
          : "/api/admin/boloes/definitions",
        {
          method: isUpdate ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const d = (await r.json()) as { item?: BolaoDefinition; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      const id = d.item?.id ?? activeId;
      if (id) setSavedDefinitionId(id);
      setConfirmOpen(false);
      setSaveNotice("Bolão salvo com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function stepHidden(target: number) {
    return step !== target ? "hidden" : undefined;
  }

  const inputClass =
    "w-full rounded-[12px] border border-white/8 bg-[#080808] px-4 py-3 text-[14px] font-medium text-white outline-none focus:border-white/20";

  if (loadingMeta) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/40">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/boloes"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-white/40 hover:text-white/70"
        >
          <ChevronLeft className="size-4" />
          Voltar aos bolões
        </Link>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
          {mode === "edit" ? "Editar" : "Novo bolão"} · passo {step}/{STEP_COUNT}
        </span>
      </div>

      <div className="border-b border-white/6 pb-4">
        <div className="flex items-center gap-0 overflow-x-auto">
          {STEPS.map((s, index) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex min-w-0 flex-1 items-center">
                <div className="flex min-w-0 flex-col items-start gap-1 sm:items-center">
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      active ? "text-white" : done ? "text-white/50" : "text-white/25"
                    }`}
                  >
                    {String(s.id).padStart(2, "0")}
                  </span>
                  <span
                    className={`hidden truncate text-[10px] font-medium uppercase tracking-[0.08em] sm:block ${
                      active ? "text-white/80" : "text-white/25"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {index < STEPS.length - 1 ? (
                  <div
                    className={`mx-2 h-px min-w-[8px] flex-1 ${done ? "bg-white/20" : "bg-white/6"}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {saveNotice ? (
        <div className="rounded-[10px] border border-primary/25 bg-primary/10 px-4 py-3 text-[13px] text-primary">
          {saveNotice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[10px] border border-red-400/20 bg-red-950/40 px-4 py-3 text-[13px] text-red-200/90">
          {error}
        </div>
      ) : null}

      <section
        className={`rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6 ${stepHidden(1) ?? ""}`}
      >
          <h2 className="text-[17px] font-bold text-white">Nome e logo</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            Como o bolão aparece na vitrine e na loja.
          </p>
          <div className="grid gap-6">
            <label className="block space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Nome do bolão *
              </span>
              <input
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex.: Bolão Série B — Rodada 12"
                autoFocus
              />
            </label>
            <BolaoImageUpload
              label="Logo do bolão"
              hint="JPG, PNG ou WebP · até 8 MB"
              valueUrl={logoUrl}
              onChangeUrl={setLogoUrl}
              previewSize="logo"
            />
          </div>
        </section>

      <section
        className={`rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6 ${stepHidden(2) ?? ""}`}
      >
          <h2 className="text-[17px] font-bold text-white">Valor da cota</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            Preço de cada cota do bolão{" "}
            <span className="text-white/60">{displayName || "—"}</span>.
          </p>
          <div className="grid max-w-md gap-4">
            <label className="block space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Preço por cota *
              </span>
              <BolaoCurrencyInput
                valueCents={unitPriceCents}
                onChangeCents={setUnitPriceCents}
              />
              {unitPriceCents > 0 ? (
                <p className="text-[13px] text-white/50">
                  Cada cota:{" "}
                  <span className="font-semibold text-white">
                    {formatCentsBRL(unitPriceCents)}
                  </span>
                </p>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Máx. cotas por usuário
              </span>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={maxTicketsPerUser}
                onChange={(e) => setMaxTicketsPerUser(e.target.value)}
                placeholder="Ilimitado"
              />
            </label>
          </div>
        </section>

      <section
        className={`rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6 ${stepHidden(3) ?? ""}`}
      >
          <h2 className="text-[17px] font-bold text-white">Campeonatos e jogos</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            Escolha os campeonatos e, para cada um, marque as partidas que entram no bolão.
          </p>
          <BolaoCompetitionMatchStep
            competitions={competitions}
            competitionIds={competitionIds}
            onCompetitionIdsChange={setCompetitionIds}
            matchIdsByCompetition={matchIdsByCompetition}
            onMatchIdsByCompetitionChange={setMatchIdsByCompetition}
          />
        </section>

      <div className={`space-y-4 ${stepHidden(4) ?? ""}`}>
          <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
            <h2 className="text-[17px] font-bold text-white">Textos e datas</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Subtítulo
                </span>
                <input
                  className={inputClass}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex.: 12ª Rodada · Brasileirão Série B"
                />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Descrição
                </span>
                <textarea
                  className={`${inputClass} min-h-[88px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Texto exibido na vitrine"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Início das inscrições
                </span>
                <BolaoDatetimeInput
                  value={startsAt}
                  onChange={setStartsAt}
                  inputClass={inputClass}
                />
                <span className="text-[11px] text-white/30">Horário de Brasília</span>
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Encerramento
                </span>
                <BolaoDatetimeInput
                  value={endsAt}
                  onChange={setEndsAt}
                  inputClass={inputClass}
                />
                <span className="text-[11px] text-white/30">Horário de Brasília</span>
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Apuração (settlement)
                </span>
                <BolaoDatetimeInput
                  value={settlementAt}
                  onChange={setSettlementAt}
                  inputClass={inputClass}
                />
                <span className="text-[11px] text-white/30">
                  Opcional — se vazio, apura após o último jogo + prazo.
                </span>
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                  Liberação de prêmios
                </span>
                <BolaoDatetimeInput
                  value={prizeReleaseAt}
                  onChange={setPrizeReleaseAt}
                  inputClass={inputClass}
                />
                <span className="text-[11px] text-white/30">
                  Opcional — quando o saldo é creditado aos vencedores.
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
            <h3 className="text-[14px] font-bold text-white">Premiação</h3>
            <p className="mt-1 mb-4 text-[12px] text-white/40">
              Pool (% da arrecadação) e/ou prêmio fixo por colocação.
            </p>
            <label className="mb-5 block max-w-xs space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
                Pool (% da arrecadação) *
              </span>
              <div className="relative">
                <input
                  className={inputClass}
                  value={prizePoolPercent}
                  onChange={(e) => setPrizePoolPercent(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 60"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                  %
                </span>
              </div>
            </label>
            {prizeTiers.length === 0 ? (
              <p className="mb-3 text-[13px] text-white/35">
                Nenhuma colocação definida ainda.
              </p>
            ) : null}
            <div className="space-y-2">
              {prizeTiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={tier.rank}
                    onChange={(e) => {
                      const tiers = [...prizeTiers];
                      tiers[index] = { ...tier, rank: Number(e.target.value) };
                      setPrizeTiers(tiers);
                    }}
                    placeholder="Posição"
                  />
                  <div className="relative">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={tier.poolBps / 100}
                      onChange={(e) => {
                        const tiers = [...prizeTiers];
                        tiers[index] = {
                          ...tier,
                          poolBps: Math.round(Number(e.target.value) * 100),
                        };
                        setPrizeTiers(tiers);
                      }}
                      placeholder="% do pool"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/30">
                      %
                    </span>
                  </div>
                  <BolaoCurrencyInput
                    valueCents={tier.amountCents ?? 0}
                    onChangeCents={(cents) => {
                      const tiers = [...prizeTiers];
                      tiers[index] = {
                        ...tier,
                        amountCents: cents > 0 ? cents : undefined,
                      };
                      setPrizeTiers(tiers);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPrizeTiers(prizeTiers.filter((_, i) => i !== index))}
                    className="rounded-[10px] border border-white/8 px-3 text-white/40 hover:bg-white/5"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPrizeTiers([
                    ...prizeTiers,
                    { rank: prizeTiers.length + 1, poolBps: 0 },
                  ])
                }
                className="text-[12px] font-medium text-white/50 hover:text-white/70"
              >
                + Adicionar colocação
              </button>
            </div>
          </div>
      </div>

      <section
        className={`rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6 ${stepHidden(5) ?? ""}`}
      >
          <h2 className="text-[17px] font-bold text-white">Revisão e publicação</h2>
          <dl className="mt-5 grid gap-3 rounded-[12px] border border-white/6 bg-[#080808] p-4 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-white/35">Nome</dt>
              <dd className="font-medium text-white">{displayName || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/35">Valor da cota</dt>
              <dd className="font-semibold tabular-nums text-white">
                {unitPriceCents > 0 ? formatCentsBRL(unitPriceCents) : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-white/35">Campeonatos e jogos</dt>
              <dd className="mt-1 space-y-1 font-medium text-white">
                {selectedCompetitions.length === 0 ? (
                  <span>—</span>
                ) : (
                  selectedCompetitions.map((c) => (
                    <p key={c.id}>
                      {c.displayName}: {matchIdsByCompetition[c.id]?.length ?? 0} jogo(s)
                    </p>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-white/35">Total de jogos</dt>
              <dd className="font-medium text-white">{scopeMatchIds.length}</dd>
            </div>
            <div>
              <dt className="text-white/35">Pool prêmios</dt>
              <dd className="font-medium text-white">
                {prizePoolPercent ? `${prizePoolPercent}%` : "—"}
              </dd>
            </div>
            {logoUrl ? (
              <div className="sm:col-span-2">
                <dt className="text-white/35">Logo</dt>
                <dd className="mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-14 w-14 rounded-[8px] border border-white/8 object-contain p-1"
                  />
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-5 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
              <input
                type="checkbox"
                checked={saleEnabled}
                onChange={(e) => setSaleEnabled(e.target.checked)}
                className="size-4 rounded border-white/20 bg-[#0a0a0a]"
              />
              Habilitar venda na loja
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
              <input
                type="checkbox"
                checked={shopVisible}
                onChange={(e) => setShopVisible(e.target.checked)}
                className="size-4 rounded border-white/20 bg-[#0a0a0a]"
              />
              Visível no catálogo
            </label>
          </div>
        </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || saving}
          className="inline-flex items-center gap-1 rounded-[10px] border border-white/8 px-4 py-2.5 text-[13px] font-medium text-white/50 disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
        {step < STEP_COUNT ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-[10px] bg-white px-5 py-2.5 text-[13px] font-bold text-[#0a0a0a]"
          >
            Continuar
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const err = validateStep(STEP_COUNT);
              if (err) {
                setError(err);
                return;
              }
              setConfirmOpen(true);
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-5 py-2.5 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "edit" ? "Salvar" : "Criar bolão"}
          </button>
        )}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            className="w-full max-w-md rounded-[16px] border border-white/8 bg-[#0e0e0e] p-6"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-[17px] font-bold text-white">
              {mode === "edit" ? "Confirmar alterações?" : "Criar este bolão?"}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">
              <span className="text-white/80">{displayName}</span> será{" "}
              {saleEnabled ? "publicado na loja" : "salvo sem venda ativa"}.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-white py-3 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirmar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmOpen(false)}
                className="rounded-[10px] border border-white/8 px-4 py-3 text-[13px] font-medium text-white/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
