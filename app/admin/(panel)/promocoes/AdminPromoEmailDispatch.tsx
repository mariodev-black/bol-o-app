"use client";

import { adminStatGridClass } from "@/app/admin/_components/admin-layout";
import { AdminEmailButtonFields } from "@/app/admin/(panel)/notifications/AdminEmailButtonFields";
import {
  AdminNotificationChannelPicker,
  channelIncludesApp,
  channelIncludesEmail,
  channelIncludesPush,
} from "@/app/admin/(panel)/notifications/AdminNotificationChannelPicker";
import { AdminPushUrlField } from "@/app/admin/(panel)/notifications/AdminPushUrlField";
import type { AdminBrasilMarrocosPromoDashboard } from "@/lib/admin/brasil-marrocos-placar-promo";
import {
  buildBrasilMarrocosPromoEmailPresets,
  listBrasilMarrocosPromoWinnerRows,
  listBrasilMarrocosPromoWinnerUserIds,
  type PromoEmailAudience,
} from "@/lib/admin/promo-email-presets";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Megaphone,
  Send,
  Shirt,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

const DEFAULT_CHANNELS: AdminBroadcastChannel[] = ["app", "push", "email"];

const AUDIENCE_META: Record<
  PromoEmailAudience,
  {
    label: string;
    shortLabel: string;
    subtitle: string;
    icon: typeof Ticket;
  }
> = {
  free_ticket: {
    label: "Cota grátis",
    shortLabel: "Placar exato",
    subtitle: "Quem acertou o placar oficial",
    icon: Ticket,
  },
  shirt: {
    label: "Camisa oficial",
    shortLabel: "Placar + indicações",
    subtitle: "Placar exato e meta de indicações",
    icon: Shirt,
  },
};

function formatDispatchSuccess(
  channels: AdminBroadcastChannel[],
  d: {
    requested?: number;
    app?: { created?: number };
    push?: { sent?: number; failed?: number };
    email?: { sent?: number; failed?: number; queued?: boolean };
  },
): string {
  const parts: string[] = [];
  const requested = d.requested ?? 0;
  parts.push(`${requested.toLocaleString("pt-BR")} destinatário(s)`);

  if (channelIncludesApp(channels) && (d.app?.created ?? 0) > 0) {
    parts.push(`${(d.app?.created ?? 0).toLocaleString("pt-BR")} no sininho`);
  }
  if (channelIncludesPush(channels)) {
    const pushSent = d.push?.sent ?? 0;
    const pushFailed = d.push?.failed ?? 0;
    if (pushSent > 0) parts.push(`${pushSent.toLocaleString("pt-BR")} push PWA`);
    if (pushFailed > 0) {
      parts.push(`${pushFailed.toLocaleString("pt-BR")} falha(s) no push`);
    }
  }
  if (channelIncludesEmail(channels)) {
    if (d.email?.queued) {
      parts.push(`e-mail em fila para ${requested.toLocaleString("pt-BR")}`);
    } else if ((d.email?.sent ?? 0) > 0) {
      parts.push(`${(d.email?.sent ?? 0).toLocaleString("pt-BR")} e-mail(s)`);
    }
    if ((d.email?.failed ?? 0) > 0) {
      parts.push(`${(d.email?.failed ?? 0).toLocaleString("pt-BR")} falha(s) no e-mail`);
    }
  }

  return `Disparo concluído: ${parts.join(" · ")}.`;
}

function submitButtonLabel(channels: AdminBroadcastChannel[]): string {
  const labels: string[] = [];
  if (channelIncludesApp(channels)) labels.push("sininho");
  if (channelIncludesPush(channels)) labels.push("push");
  if (channelIncludesEmail(channels)) labels.push("e-mail");
  if (labels.length === 0) return "Disparar";
  return `Disparar (${labels.join(" + ")})`;
}

export function AdminPromoEmailDispatch({
  data,
}: {
  data: AdminBrasilMarrocosPromoDashboard;
}) {
  const presets = useMemo(() => buildBrasilMarrocosPromoEmailPresets(data), [data]);
  const resultLabel =
    data.officialResult != null
      ? `${data.officialResult.casa} x ${data.officialResult.visitante}`
      : null;
  const noResult = resultLabel == null;

  const freeTicketCount = data.stats.freeTicketEligibleCount;
  const shirtCount = data.stats.shirtEligibleCount;

  const [audience, setAudience] = useState<PromoEmailAudience>("free_ticket");
  const [channels, setChannels] = useState<AdminBroadcastChannel[]>(DEFAULT_CHANNELS);
  const [title, setTitle] = useState(presets.free_ticket.title);
  const [preview, setPreview] = useState(presets.free_ticket.preview);
  const [body, setBody] = useState(presets.free_ticket.body);
  const [includeEmailButton, setIncludeEmailButton] = useState(
    presets.free_ticket.includeEmailButton,
  );
  const [buttonLabel, setButtonLabel] = useState(presets.free_ticket.buttonLabel);
  const [buttonUrl, setButtonUrl] = useState(presets.free_ticket.buttonUrl);
  const [pushUrl, setPushUrl] = useState("/boloes");
  const [showRecipients, setShowRecipients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userIds = useMemo(
    () => listBrasilMarrocosPromoWinnerUserIds(data.rows, audience),
    [audience, data.rows],
  );
  const winnerRows = useMemo(
    () => listBrasilMarrocosPromoWinnerRows(data.rows, audience),
    [audience, data.rows],
  );

  const activePreset = presets[audience];
  const activeMeta = AUDIENCE_META[audience];
  const ActiveIcon = activeMeta.icon;

  useEffect(() => {
    const preset = presets[audience];
    setTitle(preset.title);
    setPreview(preset.preview);
    setBody(preset.body);
    setIncludeEmailButton(preset.includeEmailButton);
    setButtonLabel(preset.buttonLabel);
    setButtonUrl(preset.buttonUrl);
    setError(null);
    setSuccess(null);
  }, [audience, presets]);

  const needsBody = channelIncludesApp(channels) || channelIncludesEmail(channels);
  const needsPreview =
    channelIncludesApp(channels) ||
    channelIncludesPush(channels) ||
    channelIncludesEmail(channels);

  function resetPreset() {
    const preset = presets[audience];
    setTitle(preset.title);
    setPreview(preset.preview);
    setBody(preset.body);
    setIncludeEmailButton(preset.includeEmailButton);
    setButtonLabel(preset.buttonLabel);
    setButtonUrl(preset.buttonUrl);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (channels.length === 0) {
      setError("Selecione pelo menos um canal de disparo.");
      return;
    }
    if (userIds.length === 0) {
      setError("Nenhum ganhador neste grupo.");
      return;
    }
    if (noResult) {
      setError("Configure o placar oficial antes de disparar.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          preview,
          body,
          channels,
          audience: "selected",
          userIds,
          pushUrl,
          ...(channelIncludesEmail(channels)
            ? {
                includeEmailButton,
                buttonLabel,
                buttonUrl,
                emailLayout: "default",
              }
            : {}),
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        channels?: AdminBroadcastChannel[];
        requested?: number;
        app?: { created?: number };
        push?: { sent?: number; failed?: number };
        email?: { sent?: number; failed?: number; queued?: boolean };
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao disparar.");
      }

      setSuccess(
        formatDispatchSuccess(payload.channels ?? channels, payload),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao disparar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[#101010]">
        <div className="border-b border-white/8 bg-linear-to-br from-primary/10 via-transparent to-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-primary" strokeWidth={2.2} />
                <h2 className="text-[17px] font-black uppercase tracking-wide text-white">
                  Disparo — Brasil x Marrocos
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/55">
                Comunique os ganhadores por sininho, push PWA e/ou e-mail.
                Escolha o grupo de prêmio, ajuste a mensagem e dispare nos
                canais desejados.
              </p>
            </div>
            {resultLabel ? (
              <div className="rounded-[14px] border border-primary/30 bg-primary/10 px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary/80">
                  Placar oficial
                </p>
                <p className="mt-0.5 text-[28px] font-black tabular-nums leading-none text-white">
                  {resultLabel}
                </p>
              </div>
            ) : (
              <div className="rounded-[14px] border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                <p className="text-[12px] font-semibold text-amber-200">
                  Placar não configurado
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={`${adminStatGridClass} border-0 bg-transparent p-4 sm:p-5`}>
          {[
            {
              label: "Ganhadores cota grátis",
              value: freeTicketCount.toLocaleString("pt-BR"),
              icon: Ticket,
            },
            {
              label: `Ganhadores camisa (${data.friendsGoal} ind.)`,
              value: shirtCount.toLocaleString("pt-BR"),
              icon: Shirt,
            },
            {
              label: "Total de palpites",
              value: data.stats.submissionsCount.toLocaleString("pt-BR"),
              icon: Users,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex items-center gap-3 rounded-[14px] border border-white/8 bg-black/30 px-4 py-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon className="size-4.5 text-primary" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
                    {card.label}
                  </p>
                  <p className="text-[22px] font-black tabular-nums text-white">
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]"
      >
        {/* Coluna esquerda — público e canais */}
        <aside className="space-y-4">
          <section className="rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
              1. Grupo de ganhadores
            </p>
            <div className="mt-3 grid gap-2">
              {(["free_ticket", "shirt"] as const).map((key) => {
                const meta = AUDIENCE_META[key];
                const Icon = meta.icon;
                const count =
                  key === "free_ticket" ? freeTicketCount : shirtCount;
                const active = audience === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAudience(key)}
                    className={[
                      "flex w-full items-start gap-3 rounded-[14px] border p-4 text-left transition-colors",
                      active
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/10 bg-black/25 hover:border-white/20",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                        active
                          ? "border-primary/40 bg-primary/15"
                          : "border-white/10 bg-white/5",
                      ].join(" ")}
                    >
                      <Icon
                        className={active ? "size-4.5 text-primary" : "size-4.5 text-white/45"}
                        strokeWidth={2.2}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={[
                            "text-[13px] font-black uppercase",
                            active ? "text-primary" : "text-white",
                          ].join(" ")}
                        >
                          {meta.label}
                        </span>
                        {active ? (
                          <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/45">
                        {meta.subtitle}
                      </span>
                      <span className="mt-1.5 block text-[18px] font-black tabular-nums text-white">
                        {count.toLocaleString("pt-BR")}
                        <span className="ml-1 text-[11px] font-bold text-white/40">
                          destinatários
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
              2. Canais de disparo
            </p>
            <AdminNotificationChannelPicker
              channels={channels}
              onChannelsChange={setChannels}
            />
            {channelIncludesPush(channels) ? (
              <div className="mt-4">
                <AdminPushUrlField pushUrl={pushUrl} onPushUrlChange={setPushUrl} />
              </div>
            ) : null}
          </section>

          <section className="rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setShowRecipients((value) => !value)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                  Destinatários
                </span>
                <span className="mt-1 block text-[13px] font-semibold text-white/70">
                  {winnerRows.length.toLocaleString("pt-BR")} ganhador(es) —{" "}
                  {activeMeta.shortLabel}
                </span>
              </span>
              {showRecipients ? (
                <ChevronUp className="size-4 shrink-0 text-white/40" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-white/40" />
              )}
            </button>
            {showRecipients ? (
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto border-t border-white/8 pt-3 text-[13px] text-white/80">
                {winnerRows.length === 0 ? (
                  <li className="text-white/45">Nenhum ganhador neste grupo.</li>
                ) : (
                  winnerRows.map((row) => (
                    <li
                      key={row.userId}
                      className="rounded-lg border border-white/6 bg-black/20 px-3 py-2"
                    >
                      <Link
                        href={`/admin/users/${row.userId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {row.userName?.trim() || "Sem nome"}
                      </Link>
                      <p className="text-[12px] text-white/45">{row.userEmail}</p>
                      {audience === "shirt" ? (
                        <p className="mt-0.5 text-[11px] font-bold text-white/55">
                          {row.friendsInvited}/{data.friendsGoal} indicações
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] font-bold tabular-nums text-white/55">
                          Palpite {row.predCasa} x {row.predVisitante}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </section>
        </aside>

        {/* Coluna direita — mensagem */}
        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <ActiveIcon className="size-5 text-primary" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                  3. Mensagem
                </p>
                <h3 className="text-[16px] font-black uppercase text-white">
                  {activeMeta.label}
                </h3>
                <p className="text-[12px] text-white/45">{activeMeta.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetPreset}
              className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white/65 transition hover:border-primary/35 hover:text-primary"
            >
              Restaurar template
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                Título
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Título da notificação / assunto do e-mail"
                maxLength={200}
                required
              />
            </label>

            {needsPreview ? (
              <label className="grid gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                  {channelIncludesPush(channels) && !channelIncludesApp(channels)
                    ? "Texto do push (e prévia do e-mail, se marcado)"
                    : channelIncludesEmail(channels) && !channelIncludesApp(channels)
                      ? "Prévia do e-mail (preheader)"
                      : "Resumo (sininho, push e prévia do e-mail)"}
                </span>
                <input
                  className={inputClass}
                  value={preview}
                  onChange={(event) => setPreview(event.target.value)}
                  maxLength={500}
                  required
                />
              </label>
            ) : null}

            {needsBody ? (
              <label className="grid gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                  Mensagem completa
                </span>
                <textarea
                  className={`${inputClass} min-h-[180px] resize-y leading-relaxed`}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={
                    channelIncludesEmail(channels)
                      ? "Corpo do e-mail e do sininho"
                      : "Texto ao abrir a notificação no sininho"
                  }
                  maxLength={8000}
                  required={needsBody}
                />
              </label>
            ) : null}

            {channelIncludesEmail(channels) ? (
              <AdminEmailButtonFields
                includeButton={includeEmailButton}
                onIncludeButtonChange={setIncludeEmailButton}
                buttonLabel={buttonLabel}
                buttonUrl={buttonUrl}
                onButtonLabelChange={setButtonLabel}
                onButtonUrlChange={setButtonUrl}
              />
            ) : null}
          </div>

          {noResult ? (
            <p className="mt-4 rounded-[12px] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[13px] font-medium text-amber-200">
              Configure o placar oficial no servidor antes de disparar.
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-[12px] border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-4 rounded-[12px] border border-primary/25 bg-primary/10 px-4 py-3 text-[13px] font-medium text-primary">
              {success}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-white/45">
              <Trophy className="mr-1.5 inline size-3.5 text-primary" />
              Enviando para{" "}
              <strong className="text-white/75">
                {userIds.length.toLocaleString("pt-BR")}
              </strong>{" "}
              ganhador(es) · {activeMeta.label}
            </p>
            <button
              type="submit"
              disabled={
                noResult || loading || userIds.length === 0 || channels.length === 0
              }
              className="inline-flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />
              ) : (
                <Send className="size-4" strokeWidth={2.4} />
              )}
              {submitButtonLabel(channels)}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
