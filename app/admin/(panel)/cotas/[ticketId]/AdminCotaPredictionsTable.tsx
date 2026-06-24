"use client";

import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import { formatAdminDateTime } from "@/lib/admin/format";
import type { AdminTicketPredictionItem } from "@/lib/admin/sections";
import { Pencil } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminCotaPredictionEditDialog } from "./AdminCotaPredictionEditDialog";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatMatchId(matchId: number) {
  return Number.isFinite(matchId) && matchId > 0 ? String(matchId) : "—";
}

function predictionResultLabel(prediction: AdminTicketPredictionItem) {
  if (prediction.resultCasa == null || prediction.resultVisitante == null) return "Pendente";
  return `${prediction.resultCasa} x ${prediction.resultVisitante}`;
}

function predictionPointsLabel(prediction: AdminTicketPredictionItem) {
  if (!prediction.hasPrediction) return "-";
  if (prediction.resultCasa == null || prediction.resultVisitante == null) return "0 pts";
  return `${prediction.points} pts`;
}

function palpiteLabel(prediction: AdminTicketPredictionItem) {
  if (!prediction.hasPrediction) return "Sem palpite";
  return `${prediction.scoreCasa} x ${prediction.scoreVisitante}`;
}

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[12px] font-black text-white/80">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white">
      <Image src={src} alt={alt} width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
    </span>
  );
}

export function AdminCotaPredictionsTable({
  ticketId,
  initialPredictions,
}: {
  ticketId: string;
  initialPredictions: AdminTicketPredictionItem[];
}) {
  const router = useRouter();
  const [predictions, setPredictions] = useState(initialPredictions);
  const [query, setQuery] = useState("");
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [editing, setEditing] = useState<AdminTicketPredictionItem | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    setPredictions(initialPredictions);
  }, [initialPredictions]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return predictions.filter((prediction) => {
      if (filterMissingOnly && prediction.hasPrediction) return false;
      if (!q) return true;
      const haystack = [
        prediction.homeName,
        prediction.awayName,
        formatMatchId(prediction.matchId),
        prediction.dateBR,
        palpiteLabel(prediction),
        prediction.status,
      ]
        .map((item) => normalize(String(item ?? "")))
        .join(" ");
      return haystack.includes(q);
    });
  }, [predictions, query, filterMissingOnly]);

  const missingCount = predictions.filter((item) => !item.hasPrediction).length;

  const openEdit = (prediction: AdminTicketPredictionItem) => {
    setDialogError(null);
    setEditing(prediction);
  };

  const closeEdit = () => {
    setEditing(null);
    setDialogError(null);
  };

  const handleSaved = (updated: AdminTicketPredictionItem) => {
    setPredictions((current) =>
      current.map((item) => (item.matchId === updated.matchId ? updated : item)),
    );
    setEditing(null);
    router.refresh();
  };

  if (!predictions.length) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-[15px] font-black text-white">Nenhum jogo no escopo desta cota</p>
        <p className="mt-2 text-[13px] text-white/38">Verifique o tipo de bolão e o cache de partidas.</p>
      </div>
    );
  }

  return (
    <>
      {filtered.length ? (
        <AdminTableScroll>
          <table className="min-w-[1180px] w-full table-fixed text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                <th className="w-[340px] px-4 py-4">Jogo</th>
                <th className="w-[120px] px-4 py-4">Data</th>
                <th className="w-[120px] px-4 py-4 text-center">Palpite</th>
                <th className="w-[110px] px-4 py-4 text-center">Resultado</th>
                <th className="w-[100px] px-4 py-4 text-center">Pontos</th>
                <th className="w-[130px] px-4 py-4">Status</th>
                <th className="w-[140px] px-4 py-4">Enviado em</th>
                <th className="w-[100px] px-4 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filtered.map((prediction) => {
                const rowMuted = !prediction.hasPrediction;
                return (
                  <tr
                    key={`${prediction.matchId}-${prediction.competitionId ?? "x"}`}
                    className={[
                      "text-[13px] text-white/72",
                      rowMuted ? "bg-amber-500/4" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TeamLogo src={prediction.homeLogo} alt={prediction.homeName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-white">{prediction.homeName}</p>
                          <p className="mt-1 font-mono text-[12px] text-white/30">
                            Partida #{formatMatchId(prediction.matchId)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-black text-white/28">x</span>
                        <div className="min-w-0 flex-1 text-right">
                          <p className="truncate font-black text-white">{prediction.awayName}</p>
                          <p className="mt-1 text-[12px] text-white/25">visitante</p>
                        </div>
                        <TeamLogo src={prediction.awayLogo} alt={prediction.awayName} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <p className="font-bold text-white/62">{prediction.dateBR ?? "Sem data"}</p>
                      <p className="mt-1 text-[14px] text-white/32">{prediction.hourBR ?? "Sem hora"}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={[
                          "inline-flex rounded-full border px-3 py-1 text-[12px] font-black",
                          prediction.hasPrediction
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-amber-400/20 bg-amber-400/10 text-amber-200",
                        ].join(" ")}
                      >
                        {palpiteLabel(prediction)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-white">
                      {predictionResultLabel(prediction)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                          prediction.points > 0
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/5 text-white/80",
                        ].join(" ")}
                      >
                        {predictionPointsLabel(prediction)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white/55">{prediction.status ?? "Não informado"}</p>
                      <p className="mt-1 text-[14px] text-white/28">
                        {prediction.resultCasa == null || prediction.resultVisitante == null
                          ? "Aguardando resultado"
                          : "Resultado apurado"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      {prediction.submittedAt ? formatAdminDateTime(prediction.submittedAt) : "-"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => openEdit(prediction)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-white/72 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableScroll>
      ) : (
        <div className="px-5 py-12 text-center">
          <p className="text-[15px] font-black text-white">Nenhum jogo encontrado</p>
          <p className="mt-2 text-[13px] text-white/38">Ajuste os filtros para ver outros jogos.</p>
        </div>
      )}

      <div className="border-t border-white/8 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-white/55">
            <input
              type="checkbox"
              checked={filterMissingOnly}
              onChange={(event) => setFilterMissingOnly(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40 accent-primary"
            />
            Mostrar só jogos sem palpite ({missingCount.toLocaleString("pt-BR")})
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
            Buscar jogo nesta cota
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Time, partida, data ou placar"
            className="h-11 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/45"
          />
        </label>
        <p className="mt-2 text-[12px] font-medium text-white/38">
          {filtered.length.toLocaleString("pt-BR")} de {predictions.length.toLocaleString("pt-BR")} jogo(s) no
          escopo · {missingCount.toLocaleString("pt-BR")} sem palpite
        </p>
      </div>

      <AdminCotaPredictionEditDialog
        open={editing != null}
        prediction={editing}
        ticketId={ticketId}
        error={dialogError}
        onClose={closeEdit}
        onSaved={handleSaved}
      />
    </>
  );
}
