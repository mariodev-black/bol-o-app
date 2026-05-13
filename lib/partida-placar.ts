/* eslint-disable @typescript-eslint/no-explicit-any */
/** Extração de placar e apito a partir do JSON da API Futebol / payloads espelhados no cache. */

function parseScoresFromPlacarString(raw: unknown): { casa: number; visita: number } | null {
  if (typeof raw !== "string") return null;
  const matches = [...raw.matchAll(/(\d+)\s*[xX]\s*(\d+)/g)];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1]!;
  const casa = Number(m[1]);
  const visita = Number(m[2]);
  if (!Number.isFinite(casa) || !Number.isFinite(visita)) return null;
  if (casa > 30 || visita > 30) return null;
  return { casa, visita };
}

export function parseKickoffFromPartidaPayload(p: any): string | null {
  const iso = p?.data_realizacao_iso;
  if (iso != null && String(iso).trim() !== "") {
    const parsed = new Date(String(iso));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const dataRealizacao = p?.data_realizacao;
  const hora = p?.hora_realizacao;
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = String(dataRealizacao).split("/");
  if (!d || !m || !y) return null;
  const hhmm = String(hora).slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

export function pickScoreFromPartidaPayload(p: any, side: "casa" | "visitante"): number | null {
  const casaKeys = [
    "placar_mandante",
    "placar_casa",
    "placar_oficial_mandante",
    "gols_mandante",
    "resultado_mandante",
  ];
  const visitKeys = [
    "placar_visitante",
    "placar_oficial_visitante",
    "gols_visitante",
    "resultado_visitante",
  ];
  const keys = side === "casa" ? casaKeys : visitKeys;
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  const parsed = parseScoresFromPlacarString(p?.placar);
  if (parsed) return side === "casa" ? parsed.casa : parsed.visita;
  return null;
}
