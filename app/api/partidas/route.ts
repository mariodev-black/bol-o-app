import { NextResponse } from "next/server";
import { fetchProviderMatches } from "@/lib/football-api";
import { readMatchesCache, syncMatchesCache } from "@/lib/matches-cache";

export const runtime = "nodejs";

type NestedRounds = Record<string, Array<Record<string, unknown>>>;
type PhaseMap = Record<string, NestedRounds | Record<string, NestedRounds>>;

function todayBRDateMs(): number {
  const now = new Date();
  const br = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [d, m, y] = br.split("/");
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

function brDateToUtcMs(dateBR: string): number | null {
  const [d, m, y] = String(dateBR || "").split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month - 1, day);
}

function brDateFromIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  if (!day || !month || !year) return "";
  return `${day}/${month}/${year}`;
}

function brHourFromIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
}

function rowToPartida(row: Awaited<ReturnType<typeof readMatchesCache>>[number]) {
  let dateBR = String(row.date_br ?? "").trim();
  const hourRaw = String(row.hour_br ?? "").trim();
  if ((!dateBR || dateBR === "undefined" || dateBR === "null") && row.kickoff_at) {
    dateBR = brDateFromIso(row.kickoff_at);
  }
  const hourBR =
    /^\d{2}:\d{2}$/.test(hourRaw.slice(0, 5))
      ? hourRaw.slice(0, 5)
      : row.kickoff_at
        ? brHourFromIso(row.kickoff_at)
        : "--:--";
  return {
    partida_id: row.match_id,
    status: row.status,
    data_realizacao: dateBR,
    hora_realizacao: hourBR,
    data_realizacao_iso: row.kickoff_at,
    placar_mandante: row.result_casa,
    placar_visitante: row.result_visitante,
    time_mandante: {
      nome_popular: row.home_name,
      sigla: row.home_sigla,
      escudo: row.home_logo,
    },
    time_visitante: {
      nome_popular: row.away_name,
      sigla: row.away_sigla,
      escudo: row.away_logo,
    },
  };
}

function buildPartidasPayload(rows: Awaited<ReturnType<typeof readMatchesCache>>) {
  const stableRows = rows.sort((a, b) => a.match_id - b.match_id);
  const todayMs = todayBRDateMs();
  const displayRows = stableRows.filter((row) => {
    const dateMs = brDateToUtcMs(String(row.date_br ?? ""));
    if (dateMs != null) return dateMs >= todayMs;
    if (row.kickoff_at) {
      const kickoff = new Date(row.kickoff_at).getTime();
      if (Number.isFinite(kickoff)) return kickoff >= Date.now() - 12 * 60 * 60 * 1000;
    }
    return false;
  });

  const fases: PhaseMap = {};
  for (const row of displayRows) {
    const phaseKey = row.phase_key || "fase-de-grupos";
    const groupKey = row.group_key || "grupo-indefinido";
    const roundKey = row.round_key || "rodada-unica";

    if (!fases[phaseKey]) fases[phaseKey] = {};
    if (row.group_key) {
      const phaseObj = fases[phaseKey] as Record<string, NestedRounds>;
      if (!phaseObj[groupKey]) phaseObj[groupKey] = {};
      if (!phaseObj[groupKey][roundKey]) phaseObj[groupKey][roundKey] = [];
      phaseObj[groupKey][roundKey].push(rowToPartida(row));
    } else {
      const phaseObj = fases[phaseKey] as NestedRounds;
      if (!phaseObj[roundKey]) phaseObj[roundKey] = [];
      phaseObj[roundKey].push(rowToPartida(row));
    }
  }

  return { partidas: fases, stableRows, displayRows };
}

export async function GET() {
  try {
    const dbg = ["1", "true", "yes"].includes((process.env.DEBUG_MATCHES_SYNC || "").trim().toLowerCase());
    let rows = await readMatchesCache();

    // Caminho rápido: responde do cache imediatamente e sincroniza sem bloquear a UI.
    if (rows.length > 0) {
      void syncMatchesCache({ fetchProviderMatches, force: false }).catch(() => {});
      const payload = buildPartidasPayload(rows);
      if (dbg) {
        console.log("[api/partidas] return-cache-fast", {
          count: payload.stableRows.length,
          displayCount: payload.displayRows.length,
        });
      }
      return NextResponse.json({ partidas: payload.partidas }, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
        },
      });
    }

    // Primeiro acesso/ambiente frio: só aqui esperamos a sincronização externa.
    if (rows.length === 0) {
      await syncMatchesCache({ fetchProviderMatches, force: true });
      rows = await readMatchesCache();
      if (dbg) console.log("[api/partidas] forced-sync-on-empty-cache", { currentCount: rows.length });
    }
    const payload = buildPartidasPayload(rows);
    if (dbg) {
      const phases = new Set(payload.stableRows.map((r) => r.phase_key || "fase-de-grupos"));
      const withDate = payload.stableRows.filter((r) => String(r.date_br || "").trim() !== "").length;
      const withHour = payload.stableRows.filter((r) => /^\d{2}:\d{2}$/.test(String(r.hour_br || "").slice(0, 5))).length;
      const sample = payload.displayRows.slice(0, 5).map((r) => ({
        match_id: r.match_id,
        phase: r.phase_key,
        round: r.round_key,
        status: r.status,
        date_br: r.date_br,
        hour_br: r.hour_br,
        kickoff_at: r.kickoff_at,
      }));
      console.log("[api/partidas] stable-rows", {
        count: payload.stableRows.length,
        displayCount: payload.displayRows.length,
        phases: Array.from(phases),
        withDate,
        withoutDate: payload.stableRows.length - withDate,
        withHour,
        withoutHour: payload.stableRows.length - withHour,
        sample,
      });
    }

    return NextResponse.json({ partidas: payload.partidas }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar partidas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
