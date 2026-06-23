"use client";

import { formatAdminDateTime } from "@/lib/admin/format";
import type { AdminTicketPredictionItem } from "@/lib/admin/sections";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type TabId = "resultado" | "palpite";

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[12px] font-black text-white/80">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white">
      <Image src={src} alt={alt} width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
    </span>
  );
}

function scoreInputClassName() {
  return "h-12 w-16 rounded-[12px] border border-white/10 bg-black/50 text-center text-[18px] font-black text-white outline-none focus:border-primary/45";
}

export function AdminCotaPredictionEditDialog({
  open,
  prediction,
  ticketId,
  error,
  onClose,
  onSaved,
}: {
  open: boolean;
  prediction: AdminTicketPredictionItem | null;
  ticketId: string;
  error: string | null;
  onClose: () => void;
  onSaved: (updated: AdminTicketPredictionItem) => void;
}) {
  const [tab, setTab] = useState<TabId>("resultado");
  const [resultCasa, setResultCasa] = useState("");
  const [resultVisitante, setResultVisitante] = useState("");
  const [scoreCasa, setScoreCasa] = useState("");
  const [scoreVisitante, setScoreVisitante] = useState("");
  const [pointsOverride, setPointsOverride] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !prediction) return;
    setTab("resultado");
    setResultCasa(
      prediction.resultCasa != null ? String(prediction.resultCasa) : "",
    );
    setResultVisitante(
      prediction.resultVisitante != null ? String(prediction.resultVisitante) : "",
    );
    setScoreCasa(prediction.scoreCasa != null ? String(prediction.scoreCasa) : "");
    setScoreVisitante(
      prediction.scoreVisitante != null ? String(prediction.scoreVisitante) : "",
    );
    setPointsOverride(prediction.hasPrediction ? String(prediction.points) : "");
    setLocalError(null);
  }, [open, prediction]);

  if (!open || !prediction) return null;

  const parseScore = (value: string, label: string) => {
    if (value.trim() === "") return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 99) {
      throw new Error(`${label} deve ser um número entre 0 e 99.`);
    }
    return n;
  };

  const handleSave = async () => {
    setLocalError(null);
    setSaving(true);
    try {
      const palpiteCasa = parseScore(scoreCasa, "Palpite casa");
      const palpiteVisitante = parseScore(scoreVisitante, "Palpite visitante");
      if (palpiteCasa == null || palpiteVisitante == null) {
        throw new Error("Informe o palpite do usuário na aba Palpite.");
      }

      let resultCasaValue: number | null = null;
      let resultVisitanteValue: number | null = null;
      if (resultCasa.trim() !== "" || resultVisitante.trim() !== "") {
        resultCasaValue = parseScore(resultCasa, "Resultado casa");
        resultVisitanteValue = parseScore(resultVisitante, "Resultado visitante");
        if (resultCasaValue == null || resultVisitanteValue == null) {
          throw new Error("Informe o placar oficial completo ou deixe em branco.");
        }
      }

      let pointsOverrideValue: number | null = null;
      if (pointsOverride.trim() !== "") {
        pointsOverrideValue = parseScore(pointsOverride, "Pontos");
      }

      const response = await fetch(`/api/admin/cotas/${ticketId}/predictions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: prediction.matchId,
          competitionId: prediction.competitionId,
          resultCasa: resultCasaValue,
          resultVisitante: resultVisitanteValue,
          scoreCasa: palpiteCasa,
          scoreVisitante: palpiteVisitante,
          pointsOverride: pointsOverrideValue,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        prediction?: AdminTicketPredictionItem;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao salvar");
      }
      if (data.prediction) onSaved(data.prediction);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const displayError = localError ?? error;

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-[560px] rounded-[22px] border border-white/10 bg-[#080808] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Editar jogo</p>
        <div className="mt-4 flex items-center gap-3 pr-10">
          <TeamLogo src={prediction.homeLogo} alt={prediction.homeName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-black text-white">
              {prediction.homeName} x {prediction.awayName}
            </p>
            <p className="mt-1 text-[12px] text-white/38">
              Partida #{prediction.matchId} · {prediction.dateBR ?? "Sem data"}
              {prediction.hourBR ? ` · ${prediction.hourBR}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 border-b border-white/8">
          <button
            type="button"
            onClick={() => setTab("resultado")}
            className={[
              "px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] transition-colors",
              tab === "resultado" ? "border-b-2 border-primary text-primary" : "text-white/45 hover:text-white/70",
            ].join(" ")}
          >
            Resultado do jogo
          </button>
          <button
            type="button"
            onClick={() => setTab("palpite")}
            className={[
              "px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] transition-colors",
              tab === "palpite" ? "border-b-2 border-primary text-primary" : "text-white/45 hover:text-white/70",
            ].join(" ")}
          >
            Palpite da cota
          </button>
        </div>

        {tab === "resultado" ? (
          <div className="mt-5 space-y-4">
            <p className="text-[13px] leading-relaxed text-white/55">
              Placar oficial da partida. Ao salvar, todos os palpites deste jogo são recalculados
              automaticamente.
            </p>
            <div className="flex items-center justify-center gap-3 rounded-[14px] border border-white/8 bg-white/2.5 p-5">
              <input
                value={resultCasa}
                onChange={(event) => setResultCasa(event.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                placeholder="0"
                className={scoreInputClassName()}
              />
              <span className="text-[14px] font-black text-white/35">x</span>
              <input
                value={resultVisitante}
                onChange={(event) =>
                  setResultVisitante(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                inputMode="numeric"
                placeholder="0"
                className={scoreInputClassName()}
              />
            </div>
            <p className="text-[12px] text-white/35">
              Status atual: {prediction.status ?? "Não informado"}
              {prediction.submittedAt ? ` · Palpite enviado em ${formatAdminDateTime(prediction.submittedAt)}` : ""}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-[13px] leading-relaxed text-white/55">
              Palpite do usuário nesta cota. Use o campo de pontos abaixo apenas se quiser forçar um
              valor diferente do cálculo automático.
            </p>
            <div className="flex items-center justify-center gap-3 rounded-[14px] border border-white/8 bg-white/2.5 p-5">
              <input
                value={scoreCasa}
                onChange={(event) => setScoreCasa(event.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                placeholder="0"
                className={scoreInputClassName()}
              />
              <span className="text-[14px] font-black text-white/35">x</span>
              <input
                value={scoreVisitante}
                onChange={(event) =>
                  setScoreVisitante(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                inputMode="numeric"
                placeholder="0"
                className={scoreInputClassName()}
              />
            </div>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
                Pontos (opcional — sobrescreve o cálculo)
              </span>
              <input
                value={pointsOverride}
                onChange={(event) => setPointsOverride(event.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                placeholder="Automático"
                className="h-11 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none focus:border-primary/45"
              />
            </label>
          </div>
        )}

        {displayError ? (
          <p className="mt-4 text-[12px] font-semibold text-red-300">{displayError}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[12px] font-black uppercase tracking-[0.12em] text-white/65 hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/35 bg-primary/15 px-5 text-[12px] font-black uppercase tracking-[0.12em] text-primary hover:bg-primary/25 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
