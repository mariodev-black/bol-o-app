"use client";

import {
  AdminNotificationChannelPicker,
  channelIncludesEmail,
} from "@/app/admin/(panel)/notifications/AdminNotificationChannelPicker";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import { Loader2, Megaphone, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type WinnerPreview = {
  position: 1 | 2 | 3;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  prizeLabel: string;
};

const DEFAULT_CHANNELS: AdminBroadcastChannel[] = ["email", "app", "push"];

export function AdminAmistososPrizeDispatch({
  allMatchesFinalized,
}: {
  allMatchesFinalized: boolean;
}) {
  const [winners, setWinners] = useState<WinnerPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [channels, setChannels] = useState<AdminBroadcastChannel[]>(DEFAULT_CHANNELS);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWinners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/amistosos-matches/dispatch-prizes", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await r.json()) as {
        winners?: WinnerPreview[];
        error?: string;
      };
      if (!r.ok) throw new Error(data.error ?? "Falha ao carregar pódio");
      setWinners(data.winners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar ganhadores");
      setWinners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWinners();
  }, [loadWinners]);

  async function handleDispatch() {
    if (channels.length === 0) {
      setError("Selecione pelo menos um canal.");
      return;
    }
    setDispatching(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/admin/amistosos-matches/dispatch-prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channels }),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        email?: { sent?: number; failed?: number };
        app?: { created?: number };
        push?: { sent?: number; failed?: number };
        error?: string;
      };
      if (!r.ok || !data.ok) {
        throw new Error(data.error ?? "Falha ao disparar premiação");
      }
      const parts: string[] = [];
      if (channelIncludesEmail(channels) && (data.email?.sent ?? 0) > 0) {
        parts.push(`${data.email?.sent} e-mail(s)`);
      }
      if ((data.app?.created ?? 0) > 0) {
        parts.push(`${data.app?.created} sininho`);
      }
      if ((data.push?.sent ?? 0) > 0) {
        parts.push(`${data.push?.sent} push`);
      }
      setSuccess(
        parts.length > 0
          ? `Premiação enviada: ${parts.join(" · ")}.`
          : "Disparo registrado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao disparar");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <section className="rounded-[18px] border border-primary/20 bg-primary/[0.03] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <Trophy className="size-5 text-primary" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-[15px] font-black uppercase tracking-wide text-white">
            Premiação do pódio
          </h2>
          <p className="mt-1 text-[13px] text-white/55">
            1º <strong className="text-white/80">R$ 1.000</strong> · 2º{" "}
            <strong className="text-white/80">R$ 500</strong> · 3º{" "}
            <strong className="text-white/80">R$ 300</strong> — dispare e-mail,
            sininho e push para os 3 primeiros do ranking.
          </p>
        </div>
      </div>

      {!allMatchesFinalized ? (
        <p className="mt-4 rounded-[12px] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[13px] font-medium text-amber-200">
          Finalize todos os placares antes de disparar a premiação.
        </p>
      ) : null}

      <div className="mt-5 rounded-[14px] border border-white/10 bg-black/25 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
          Top 3 — ranking atual
        </p>
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-white/45">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </p>
        ) : winners.length === 0 ? (
          <p className="mt-3 text-[13px] text-white/45">
            Nenhum ganhador no ranking ainda.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {winners.map((w) => (
              <li
                key={w.ticketId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-[#101010] px-3 py-2.5 text-[13px]"
              >
                <span>
                  <strong className="text-primary">{w.position}º</strong>{" "}
                  <span className="font-semibold text-white">{w.displayName}</span>
                  <span className="text-white/45">
                    {" "}
                    · {w.totalPoints} pts
                  </span>
                </span>
                <span className="font-black text-primary">{w.prizeLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <AdminNotificationChannelPicker
          channels={channels}
          onChannelsChange={setChannels}
        />
      </div>

      {error ? (
        <p className="mt-4 text-[13px] font-medium text-red-300">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-4 text-[13px] font-medium text-primary">{success}</p>
      ) : null}

      <button
        type="button"
        disabled={
          dispatching ||
          loading ||
          winners.length === 0 ||
          channels.length === 0 ||
          !allMatchesFinalized
        }
        onClick={() => void handleDispatch()}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[240px]"
      >
        {dispatching ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />
        ) : (
          <Megaphone className="size-4" strokeWidth={2.4} />
        )}
        Disparar premiação
      </button>
    </section>
  );
}
