type MatchMap = Map<number, {
  id: number;
  kickoffAt: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  home: string;
  away: string;
  dateBR: string;
  hour: string;
}>;

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "live_21fbe3f95b03a101ba8883edcf6e60").trim();
}

function competitionId(): string {
  return (process.env.FOOTBALL_COMPETITION_ID || "72").trim();
}

function parseKickoffISO(dataRealizacao: string | null | undefined, hora: string | null | undefined): string | null {
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = dataRealizacao.split("/");
  if (!d || !m || !y) return null;
  const hhmm = hora.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickScore(p: any, side: "casa" | "visitante"): number | null {
  const keys =
    side === "casa"
      ? ["placar_mandante", "placar", "gols_mandante", "resultado_mandante"]
      : ["placar_visitante", "gols_visitante", "resultado_visitante"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

export async function fetchMatchesMap(): Promise<MatchMap> {
  const url = `https://api.api-futebol.com.br/v1/campeonatos/${competitionId()}/partidas`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar partidas (${res.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const fase = data?.partidas?.["fase-de-grupos"] as Record<string, unknown> | undefined;
  const out: MatchMap = new Map();
  if (!fase) return out;

  for (const [, grupo] of Object.entries(fase)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = grupo as any;
    for (const key of ["1a-rodada", "2a-rodada", "3a-rodada"]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr = (g?.[key] ?? []) as any[];
      for (const p of arr) {
        const id = Number(p?.partida_id);
        if (!Number.isFinite(id)) continue;
        out.set(id, {
          id,
          kickoffAt: parseKickoffISO(p.data_realizacao, p.hora_realizacao),
          status: String(p?.status ?? "aberto"),
          resultCasa: pickScore(p, "casa"),
          resultVisitante: pickScore(p, "visitante"),
          home: String(p?.time_mandante?.sigla ?? p?.time_mandante?.nome_popular ?? "CASA"),
          away: String(p?.time_visitante?.sigla ?? p?.time_visitante?.nome_popular ?? "VISIT"),
          dateBR: String(p?.data_realizacao ?? ""),
          hour: String(p?.hora_realizacao ?? ""),
        });
      }
    }
  }
  return out;
}

