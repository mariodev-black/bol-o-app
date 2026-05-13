"use client";

import { formatAdminTicketType } from "@/lib/admin/format";
import type { AdminPredictionListItem } from "@/lib/admin/sections";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 50;

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMatchDate(prediction: AdminPredictionListItem) {
  if (!prediction.matchDateBR) return "Sem data";
  return `${prediction.matchDateBR}${prediction.matchHourBR ? ` - ${prediction.matchHourBR}` : ""}`;
}

function resultLabel(prediction: AdminPredictionListItem) {
  if (prediction.resultCasa == null || prediction.resultVisitante == null) return "Pendente";
  return `${prediction.resultCasa} x ${prediction.resultVisitante}`;
}

function pointsLabel(prediction: AdminPredictionListItem) {
  return `${prediction.points.toLocaleString("pt-BR")} pts`;
}

function bolaoLabel(value: string) {
  if (value === "principal") return "Principal";
  if (value === "diario") return "Diário";
  return value || "Nao informado";
}

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[12px] font-black text-white/80">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white">
      <Image src={src} alt={alt} width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
    </span>
  );
}

export function AdminPalpitesClient({ predictions }: { predictions: AdminPredictionListItem[] }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const filteredPredictions = useMemo(() => {
    const q = normalize(query);
    if (!q) return predictions;
    return predictions.filter((prediction) => {
      const haystack = [
        prediction.userName,
        prediction.userEmail,
        prediction.ticketId,
        prediction.homeName,
        prediction.awayName,
        prediction.matchId,
        prediction.bolaoType,
        prediction.ticketType,
      ].map((item) => normalize(String(item ?? ""))).join(" ");
      return haystack.includes(q);
    });
  }, [predictions, query]);

  const visiblePredictions = useMemo(
    () => filteredPredictions.slice(0, visibleCount),
    [filteredPredictions, visibleCount]
  );
  const hasMore = visibleCount < filteredPredictions.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredPredictions.length));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredPredictions.length, hasMore, visibleCount]);

  return (
    <>
      <section className="mt-5 rounded-[18px] border border-white/8 bg-[#101010] p-4">
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
              Buscar palpite
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, email, cota, time ou partida"
              className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/45"
            />
          </label>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Todos os palpites</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Lista completa de palpites enviados, vinculados ao usuário, cota e partida.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full table-fixed text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                <th className="w-[210px] px-4 py-4">Usuário</th>
                <th className="w-[130px] px-4 py-4">Cota</th>
                <th className="w-[110px] px-4 py-4">Bolão</th>
                <th className="w-[280px] px-4 py-4">Jogo</th>
                <th className="w-[100px] px-4 py-4">Palpite</th>
                <th className="w-[110px] px-4 py-4">Resultado</th>
                <th className="w-[110px] px-4 py-4">Pontos</th>
                <th className="w-[150px] px-4 py-4">Data do jogo</th>
                <th className="w-[150px] px-4 py-4">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {visiblePredictions.map((prediction) => (
                <tr key={prediction.id} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${prediction.userId}`} className="block">
                      <p className="truncate font-black text-white group-hover:text-primary">{prediction.userName ?? "Sem nome"}</p>
                      <p className="mt-1 truncate text-white/80">{prediction.userEmail}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/cotas/${prediction.ticketId}`} className="block">
                      <p className="font-mono text-[12px] font-black text-white group-hover:text-primary">#{shortId(prediction.ticketId)}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase text-white/80">
                        {formatAdminTicketType(prediction.ticketType)}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-4 font-bold uppercase text-white/58">{bolaoLabel(prediction.bolaoType)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <TeamLogo src={prediction.homeLogo} alt={prediction.homeName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-white">{prediction.homeName}</p>
                        <p className="mt-1 font-mono text-[12px] text-white/30">Partida #{prediction.matchId}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-black text-white/28">x</span>
                      <div className="min-w-0 flex-1 text-right">
                        <p className="truncate font-black text-white">{prediction.awayName}</p>
                        <p className="mt-1 text-[12px] text-white/25">visitante</p>
                      </div>
                      <TeamLogo src={prediction.awayLogo} alt={prediction.awayName} />
                    </div>
                  </td>
                  <td className="px-4 py-4 font-black text-primary">
                    {prediction.scoreCasa} x {prediction.scoreVisitante}
                  </td>
                  <td className="px-4 py-4 font-black text-white">{resultLabel(prediction)}</td>
                  <td className="px-4 py-4">
                    <span
                      className={[
                        "inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                        prediction.resultCasa == null || prediction.resultVisitante == null
                          ? "border-white/10 bg-white/5 text-white/38"
                          : prediction.points > 0
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/5 text-white/58",
                      ].join(" ")}
                    >
                      {pointsLabel(prediction)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-white/55">{formatMatchDate(prediction)}</p>
                    <p className="mt-1 text-[11px] text-white/30">{prediction.matchStatus ?? "Sem status"}</p>
                  </td>
                  <td className="px-4 py-4 text-white/80">{formatDate(prediction.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPredictions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[15px] font-black text-white">Nenhum palpite encontrado</p>
              <p className="mt-2 text-[13px] text-white/38">Ajuste a busca para ver outros resultados.</p>
            </div>
          ) : null}
          {filteredPredictions.length > 0 ? (
            <div ref={loadMoreRef} className="border-t border-white/8 px-5 py-5 text-center">
              <p className="text-[12px] font-bold text-white/38">
                {hasMore ? `Carregando mais palpites de ${PAGE_SIZE} em ${PAGE_SIZE}...` : "Todos os palpites foram exibidos."}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
