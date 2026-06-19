"use client";

import { extraBolaoIconSrc } from "@/app/shared/extra-bolao-icons";
import type {
  AdminCompetitionOption,
  BolaoDefinition,
  BolaoDefinitionInput,
  BolaoPrizeTier,
  BolaoScopeMode,
} from "@/lib/boloes/definitions/types";
import {
  findKindPreset,
  getBolaoKindPresets,
  SCOPE_MODE_LABELS,
  ticketTypeLabel,
  type BolaoKindPreset,
} from "@/lib/boloes/definitions/presets";
import {
  BolaoCurrencyInput,
  formatCentsBRL,
} from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoCurrencyInput";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const STEPS = [
  { id: 1, title: "Campeonato" },
  { id: 2, title: "Modalidade" },
  { id: 3, title: "Configuração" },
  { id: 4, title: "Premiação" },
  { id: 5, title: "Publicar" },
] as const;

const DEFAULT_TIERS: BolaoPrizeTier[] = [
  { rank: 1, poolBps: 5000 },
  { rank: 2, poolBps: 3000 },
  { rank: 3, poolBps: 2000 },
];

type MatchRoundOption = { round: number; label: string; matchCount: number };

type WizardProps = {
  mode: "create" | "edit";
  definitionId?: string;
  initialDefinition?: BolaoDefinition | null;
};

function CompetitionCard({
  competition,
  selected,
  onSelect,
}: {
  competition: AdminCompetitionOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const logo = competition.logoUrl;
  const iconSrc = extraBolaoIconSrc(
    competition.iconVariant as Parameters<typeof extraBolaoIconSrc>[0],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center rounded-[14px] border p-4 text-center transition-all ${
        selected
          ? "border-white/25 bg-[#141414] ring-1 ring-white/10"
          : "border-white/6 bg-[#0a0a0a] hover:border-white/12 hover:bg-[#0e0e0e]"
      }`}
    >
      <div className="mb-3 flex size-14 items-center justify-center rounded-[12px] border border-white/6 bg-[#050505] p-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="max-h-full max-w-full object-contain opacity-90" />
        ) : (
          <Image
            src={iconSrc}
            alt=""
            width={48}
            height={48}
            className="object-contain opacity-80"
          />
        )}
      </div>
      <p className="text-[13px] font-bold leading-tight text-white/90">{competition.displayName}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-white/30">
        #{competition.id}
      </p>
    </button>
  );
}

export function BolaoCreateWizard({ mode, definitionId, initialDefinition }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [competitions, setCompetitions] = useState<AdminCompetitionOption[]>([]);
  const [matchDates, setMatchDates] = useState<string[]>([]);
  const [matchRounds, setMatchRounds] = useState<MatchRoundOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [scopeMetaLoading, setScopeMetaLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [kindId, setKindId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<BolaoScopeMode | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [unitPriceCents, setUnitPriceCents] = useState(1000);
  const [scopeDates, setScopeDates] = useState<string[]>([]);
  const [roundNumber, setRoundNumber] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [prizePoolPercent, setPrizePoolPercent] = useState("60");
  const [prizeTiers, setPrizeTiers] = useState<BolaoPrizeTier[]>([...DEFAULT_TIERS]);
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [shopVisible, setShopVisible] = useState(true);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === competitionId) ?? null,
    [competitions, competitionId],
  );

  const kindPresets = useMemo(
    () => (selectedCompetition ? getBolaoKindPresets(selectedCompetition) : []),
    [selectedCompetition],
  );

  const selectedKind = useMemo(
    () =>
      selectedCompetition && kindId
        ? findKindPreset(selectedCompetition, kindId)
        : null,
    [selectedCompetition, kindId],
  );

  const allowedScopeModes = selectedKind?.allowedScopeModes ?? [];

  const hydrateFromDefinition = useCallback(
    (def: BolaoDefinition, comps: AdminCompetitionOption[]) => {
      setCompetitionId(def.competitionId);
      const comp = comps.find((c) => c.id === def.competitionId);
      if (comp) {
        const presets = getBolaoKindPresets(comp);
        const match =
          presets.find((p) => p.ticketType === def.ticketType) ?? presets[0];
        if (match) setKindId(match.id);
      }
      setScopeMode(def.scopeMode);
      setDisplayName(def.displayName);
      setSubtitle(def.subtitle ?? "");
      setUnitPriceCents(def.unitPriceCents);
      setScopeDates([...def.scopeDates]);
      setRoundNumber(def.roundNumber != null ? String(def.roundNumber) : "");
      setEditionNumber(def.editionNumber != null ? String(def.editionNumber) : "");
      setPrizePoolPercent(String(def.prizePoolBps / 100));
      setPrizeTiers(def.prizeTiers.length > 0 ? def.prizeTiers : [...DEFAULT_TIERS]);
      setSaleEnabled(def.saleEnabled);
      setShopVisible(def.shopVisible);
      setStep(3);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/boloes/definitions/competitions", {
          credentials: "include",
        });
        const d = (await r.json()) as { competitions?: AdminCompetitionOption[] };
        if (cancelled) return;
        const comps = d.competitions ?? [];
        setCompetitions(comps);
        if (mode === "edit" && initialDefinition) {
          hydrateFromDefinition(initialDefinition, comps);
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

  useEffect(() => {
    if (!competitionId || step < 3) return;
    let cancelled = false;
    setScopeMetaLoading(true);
    void (async () => {
      try {
        const needsDates =
          scopeMode === "daily_dates" ||
          allowedScopeModes.includes("daily_dates");
        const needsRounds =
          scopeMode === "round" || allowedScopeModes.includes("round");

        const fetches: Promise<void>[] = [];

        if (needsDates) {
          fetches.push(
            fetch(
              `/api/admin/boloes/definitions/competitions?matchDatesFor=${competitionId}`,
              { credentials: "include" },
            )
              .then((r) => r.json())
              .then((d: { dates?: string[] }) => {
                if (!cancelled) setMatchDates(d.dates ?? []);
              }),
          );
        }

        if (needsRounds) {
          fetches.push(
            fetch(
              `/api/admin/boloes/definitions/competitions?matchRoundsFor=${competitionId}`,
              { credentials: "include" },
            )
              .then((r) => r.json())
              .then((d: { rounds?: MatchRoundOption[] }) => {
                if (!cancelled) setMatchRounds(d.rounds ?? []);
              }),
          );
        }

        await Promise.all(fetches);
      } catch {
        if (!cancelled) {
          setMatchDates([]);
          setMatchRounds([]);
        }
      } finally {
        if (!cancelled) setScopeMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId, step, scopeMode, allowedScopeModes]);

  useEffect(() => {
    if (selectedKind && allowedScopeModes.length === 1 && !scopeMode) {
      setScopeMode(allowedScopeModes[0]!);
    }
  }, [selectedKind, allowedScopeModes, scopeMode]);

  function applyKindPreset(kind: BolaoKindPreset) {
    setKindId(kind.id);
    if (!displayName.trim()) setDisplayName(kind.suggestedName);
    if (!subtitle.trim()) setSubtitle(kind.suggestedSubtitle ?? "");
    setUnitPriceCents(kind.defaultPriceCents);
    const defaultScope = kind.allowedScopeModes[0] ?? "round";
    setScopeMode(defaultScope);
    setScopeDates([]);
    setRoundNumber("");
    setEditionNumber("");
    if (
      defaultScope === "round" &&
      selectedCompetition?.currentRound != null
    ) {
      setRoundNumber(String(selectedCompetition.currentRound));
    }
  }

  function selectCompetition(id: number) {
    setCompetitionId(id);
    setKindId(null);
    setScopeMode(null);
    setScopeDates([]);
    const comp = competitions.find((c) => c.id === id);
    if (comp) {
      const presets = getBolaoKindPresets(comp);
      if (presets.length === 1) applyKindPreset(presets[0]!);
    }
  }

  function selectScopeMode(mode: BolaoScopeMode) {
    setScopeMode(mode);
    if (mode !== "daily_dates") setScopeDates([]);
    if (mode !== "round") setRoundNumber("");
    if (
      mode === "round" &&
      !roundNumber &&
      selectedCompetition?.currentRound != null
    ) {
      setRoundNumber(String(selectedCompetition.currentRound));
    }
  }

  function toggleDate(date: string) {
    setScopeDates((prev) => {
      const set = new Set(prev);
      if (set.has(date)) set.delete(date);
      else set.add(date);
      return [...set].sort();
    });
  }

  function buildInput(): BolaoDefinitionInput {
    if (!selectedKind || !competitionId || !scopeMode) {
      throw new Error("Configuração incompleta");
    }
    return {
      displayName: displayName.trim(),
      subtitle: subtitle.trim() || null,
      ticketType: selectedKind.ticketType,
      competitionId,
      scopeMode,
      scopeDates: scopeMode === "daily_dates" ? scopeDates : [],
      roundNumber:
        scopeMode === "round" && roundNumber ? Number(roundNumber) : null,
      editionNumber:
        selectedKind.showEditionNumber && editionNumber
          ? Number(editionNumber)
          : null,
      unitPriceCents,
      saleEnabled,
      shopVisible,
      enabled: true,
      prizePoolBps: Math.round(Number(prizePoolPercent) * 100) || 6000,
      prizeTiers,
    };
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 2 && !competitionId) return "Selecione um campeonato";
    if (targetStep >= 3 && !kindId) return "Selecione a modalidade do bolão";
    if (targetStep >= 4) {
      if (!displayName.trim()) return "Informe o nome do bolão";
      if (unitPriceCents <= 0) return "Informe um preço válido";
      if (!scopeMode) return "Selecione como definir os jogos";
      if (scopeMode === "daily_dates" && scopeDates.length === 0) {
        return "Selecione ao menos um dia";
      }
      if (scopeMode === "round" && !roundNumber.trim()) {
        return "Selecione ou informe a rodada";
      }
    }
    if (targetStep >= 5) {
      const pool = Number(prizePoolPercent);
      if (!Number.isFinite(pool) || pool <= 0 || pool > 100) {
        return "Pool de premiação deve ser entre 1% e 100%";
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
    if (step === 1 && kindPresets.length === 1 && kindId) {
      setStep(3);
      return;
    }
    if (step === 1 && kindPresets.length > 1) {
      setStep(2);
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setError(null);
    if (step === 3 && kindPresets.length === 1) {
      setStep(1);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = buildInput();
      const isEdit = mode === "edit" && definitionId;
      const r = await fetch(
        isEdit
          ? `/api/admin/boloes/definitions/${definitionId}`
          : "/api/admin/boloes/definitions",
        {
          method: isEdit ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const d = (await r.json()) as { item?: BolaoDefinition; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      const id = d.item?.id ?? definitionId;
      router.push(id ? `/admin/boloes/definicoes/${id}` : "/admin/boloes/definicoes");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-[12px] border border-white/8 bg-[#080808] px-4 py-3 text-[14px] font-medium text-white outline-none focus:border-white/20";

  const scopePillClass = (active: boolean) =>
    `rounded-[10px] border px-4 py-2.5 text-[12px] font-bold transition-colors ${
      active
        ? "border-white/20 bg-[#1a1a1a] text-white"
        : "border-white/6 bg-[#0a0a0a] text-white/45 hover:border-white/12 hover:text-white/70"
    }`;

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
          href="/admin/boloes/definicoes"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-white/40 hover:text-white/70"
        >
          <ChevronLeft className="size-4" />
          Voltar ao catálogo
        </Link>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
          {mode === "edit" ? "Editar" : "Novo bolão"} · passo {step}/5
        </span>
      </div>

      {/* Stepper — só texto, sem ícones */}
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

      {error ? (
        <div className="rounded-[10px] border border-red-400/20 bg-red-950/40 px-4 py-3 text-[13px] text-red-200/90">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <section className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-white">Campeonato</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            O tipo de cota e as opções de escopo são ajustados automaticamente.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {competitions.map((c) => (
              <CompetitionCard
                key={c.id}
                competition={c}
                selected={competitionId === c.id}
                onSelect={() => selectCompetition(c.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 && selectedCompetition ? (
        <section className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-white">Modalidade</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            {selectedCompetition.displayName}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {kindPresets.map((kind) => {
              const selected = kindId === kind.id;
              return (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => applyKindPreset(kind)}
                  className={`rounded-[12px] border p-4 text-left transition-all ${
                    selected
                      ? "border-white/20 bg-[#141414]"
                      : "border-white/6 bg-[#0a0a0a] hover:border-white/12"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-bold text-white">{kind.label}</p>
                    <span className="text-[10px] font-medium uppercase text-white/35">
                      {ticketTypeLabel(kind.ticketType)}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                    {kind.description}
                  </p>
                  <p className="mt-3 text-[13px] font-semibold tabular-nums text-white/70">
                    {formatCentsBRL(kind.defaultPriceCents)} / cota
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 && selectedKind ? (
        <section className="space-y-4">
          <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
            <h2 className="text-[17px] font-bold text-white">Nome e preço</h2>
            <p className="mt-1 mb-5 text-[13px] text-white/40">
              {selectedKind.label} · {ticketTypeLabel(selectedKind.ticketType)}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                  Nome do bolão
                </span>
                <input
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex.: Bolão Diário #01"
                />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                  Subtítulo
                </span>
                <input
                  className={inputClass}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                  Preço por cota
                </span>
                <BolaoCurrencyInput
                  valueCents={unitPriceCents}
                  onChangeCents={setUnitPriceCents}
                />
              </label>
            </div>
          </div>

          {/* Escopo dinâmico */}
          {allowedScopeModes.length > 1 ? (
            <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
              <h3 className="text-[14px] font-bold text-white">Jogos do bolão</h3>
              <p className="mt-1 mb-4 text-[12px] text-white/40">
                Escolha como delimitar as partidas desta cota.
              </p>
              <div className="flex flex-wrap gap-2">
                {allowedScopeModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => selectScopeMode(mode)}
                    className={scopePillClass(scopeMode === mode)}
                  >
                    {SCOPE_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
          ) : allowedScopeModes.length === 1 ? (
            <input type="hidden" value={allowedScopeModes[0]} />
          ) : null}

          {scopeMode === "daily_dates" ? (
            <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
              <h3 className="text-[14px] font-bold text-white">Selecione os dias</h3>
              <p className="mt-1 mb-4 text-[12px] text-white/40">
                Apenas partidas nestas datas entram no bolão e no ranking.
              </p>
              {scopeMetaLoading ? (
                <p className="text-[13px] text-white/40">Carregando datas…</p>
              ) : matchDates.length === 0 ? (
                <p className="text-[13px] text-amber-200/70">
                  Nenhuma partida no cache. Sincronize os jogos primeiro.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {matchDates.map((date) => {
                    const active = scopeDates.includes(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => toggleDate(date)}
                        className={scopePillClass(active)}
                      >
                        {date}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedKind.showEditionNumber ? (
                <label className="mt-4 block max-w-xs space-y-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                    Número da edição
                  </span>
                  <input
                    className={inputClass}
                    value={editionNumber}
                    onChange={(e) => setEditionNumber(e.target.value)}
                    placeholder="Ex.: 1"
                    inputMode="numeric"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {scopeMode === "round" ? (
            <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
              <h3 className="text-[14px] font-bold text-white">Selecione a rodada</h3>
              <p className="mt-1 mb-4 text-[12px] text-white/40">
                O ranking considera só os jogos desta rodada.
              </p>
              {scopeMetaLoading ? (
                <p className="text-[13px] text-white/40">Carregando rodadas…</p>
              ) : matchRounds.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {matchRounds.map((r) => {
                    const active = roundNumber === String(r.round);
                    return (
                      <button
                        key={r.round}
                        type="button"
                        onClick={() => setRoundNumber(String(r.round))}
                        className={scopePillClass(active)}
                      >
                        {r.label}
                        <span className="ml-1 text-[10px] font-normal text-white/35">
                          ({r.matchCount})
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="block max-w-xs space-y-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                    Número da rodada
                  </span>
                  <input
                    className={inputClass}
                    value={roundNumber}
                    onChange={(e) => setRoundNumber(e.target.value)}
                    placeholder={
                      selectedCompetition?.currentRound != null
                        ? String(selectedCompetition.currentRound)
                        : "Ex.: 18"
                    }
                    inputMode="numeric"
                  />
                </label>
              )}
            </div>
          ) : null}

          {scopeMode === "full_competition" ? (
            <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] px-5 py-4">
              <p className="text-[13px] text-white/45">
                Todas as partidas do campeonato entram neste bolão.
              </p>
            </div>
          ) : null}

          {scopeMode === "weekend" ? (
            <div className="rounded-[16px] border border-white/6 bg-[#0c0c0c] px-5 py-4">
              <p className="text-[13px] text-white/45">
                Inclui automaticamente partidas de sábado e domingo.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-white">Premiação</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            Percentual da arrecadação e divisão por colocação.
          </p>
          <label className="mb-5 block max-w-xs space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
              Pool (% da arrecadação)
            </span>
            <div className="relative">
              <input
                className={inputClass}
                value={prizePoolPercent}
                onChange={(e) => setPrizePoolPercent(e.target.value)}
                inputMode="decimal"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                %
              </span>
            </div>
          </label>
          <div className="space-y-2">
            {prizeTiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
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
                  { rank: prizeTiers.length + 1, poolBps: 1000 },
                ])
              }
              className="text-[12px] font-medium text-white/50 hover:text-white/70"
            >
              + Adicionar colocação
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 && selectedKind && selectedCompetition ? (
        <section className="rounded-[16px] border border-white/6 bg-[#0c0c0c] p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-white">Revisão</h2>
          <p className="mt-1 mb-5 text-[13px] text-white/40">
            Confira antes de {mode === "edit" ? "salvar" : "publicar"}.
          </p>

          <dl className="grid gap-3 rounded-[12px] border border-white/6 bg-[#080808] p-4 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-white/35">Nome</dt>
              <dd className="font-medium text-white">{displayName || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/35">Campeonato</dt>
              <dd className="font-medium text-white">{selectedCompetition.displayName}</dd>
            </div>
            <div>
              <dt className="text-white/35">Modalidade</dt>
              <dd className="font-medium text-white">{selectedKind.label}</dd>
            </div>
            <div>
              <dt className="text-white/35">Escopo</dt>
              <dd className="font-medium text-white">
                {scopeMode ? SCOPE_MODE_LABELS[scopeMode] : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-white/35">Preço</dt>
              <dd className="font-semibold tabular-nums text-white">
                {formatCentsBRL(unitPriceCents)}
              </dd>
            </div>
            <div>
              <dt className="text-white/35">Pool prêmios</dt>
              <dd className="font-medium text-white">{prizePoolPercent}%</dd>
            </div>
            {scopeDates.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="text-white/35">Dias</dt>
                <dd className="font-medium text-white">{scopeDates.join(", ")}</dd>
              </div>
            ) : null}
            {scopeMode === "round" && roundNumber ? (
              <div>
                <dt className="text-white/35">Rodada</dt>
                <dd className="font-medium text-white">{roundNumber}ª</dd>
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
      ) : null}

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
        {step < 5 ? (
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
              const err = validateStep(5);
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
