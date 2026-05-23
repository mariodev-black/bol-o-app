"use client";

import { AdminTabBar } from "@/app/admin/_components/AdminTabBar";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import { adminTabButtonClass } from "@/app/admin/_components/admin-layout";
import { formatAdminDateTime } from "@/lib/admin/format";
import {
  adminDeliveryMethodLabel,
  type AdminBroadcastHistoryItem,
  type AdminDeliveryMethod,
} from "@/lib/notifications/admin-broadcast-shared";
import {
  AdminNotificationMethodPicker,
  methodIncludesApp,
  methodIncludesEmail,
} from "@/app/admin/(panel)/notifications/AdminNotificationMethodPicker";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AdminEmailButtonFields } from "@/app/admin/(panel)/notifications/AdminEmailButtonFields";
import {
  AdminNotificationRecipientPicker,
  type RecipientUser,
} from "@/app/admin/(panel)/notifications/AdminNotificationRecipientPicker";

type Tab = "send" | "history";

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

export function AdminNotificationsClient({
  eligibleUsers,
  initialHistory,
}: {
  eligibleUsers: number;
  initialHistory: AdminBroadcastHistoryItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("send");
  const [history, setHistory] = useState(initialHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Enviar palpites");
  const [buttonUrl, setButtonUrl] = useState("/palpites");
  const [method, setMethod] = useState<AdminDeliveryMethod>("app");
  const [sendToAll, setSendToAll] = useState(true);
  const [selected, setSelected] = useState<RecipientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/admin/notifications/history", {
        credentials: "include",
      });
      const d = (await r.json()) as {
        items?: AdminBroadcastHistoryItem[];
        error?: string;
      };
      if (!r.ok) throw new Error(d.error ?? "Falha ao carregar");
      setHistory(d.items ?? []);
    } catch {
      /* mantém lista anterior */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") void loadHistory();
  }, [tab, loadHistory]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const r = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          preview,
          body,
          method,
          audience: sendToAll ? "all" : "selected",
          userIds: sendToAll ? undefined : selected.map((u) => u.id),
          ...(methodIncludesEmail(method)
            ? { buttonLabel, buttonUrl }
            : {}),
        }),
      });
      const d = (await r.json()) as {
        ok?: boolean;
        requested?: number;
        app?: { created?: number };
        push?: { sent?: number; failed?: number };
        email?: { sent?: number; failed?: number; queued?: boolean };
        error?: string;
      };
      if (!r.ok || !d.ok) throw new Error(d.error ?? "Falha ao enviar");

      const parts: string[] = [];
      const appCount = d.app?.created ?? 0;
      const emailSent = d.email?.sent ?? 0;
      const emailFailed = d.email?.failed ?? 0;
      const emailQueued = d.email?.queued ?? false;
      const requested = d.requested ?? (sendToAll ? appCount : selected.length);

      if (methodIncludesApp(method) && appCount > 0) {
        parts.push(`${appCount.toLocaleString("pt-BR")} no app`);
      }
      const pushSent = d.push?.sent ?? 0;
      if (methodIncludesApp(method) && pushSent > 0) {
        parts.push(`${pushSent.toLocaleString("pt-BR")} push PWA`);
      }
      if (methodIncludesEmail(method)) {
        if (emailQueued) {
          parts.push(
            `e-mail em fila para ${requested.toLocaleString("pt-BR")} destinatário(s) (envio em background)`,
          );
        } else if (emailSent > 0) {
          parts.push(`${emailSent.toLocaleString("pt-BR")} e-mail(s) enviado(s)`);
        }
        if (emailFailed > 0) {
          parts.push(`${emailFailed.toLocaleString("pt-BR")} falha(s) no e-mail`);
        }
      }

      setSuccess(
        parts.length > 0
          ? `Disparo concluído: ${parts.join("; ")}.`
          : "Disparo registrado.",
      );
      setTitle("");
      setPreview("");
      setBody("");
      if (!sendToAll) setSelected([]);
      router.refresh();
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminTabBar>
        {(
          [
            { id: "send" as const, label: "Enviar" },
            { id: "history" as const, label: "Histórico" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              adminTabButtonClass,
              tab === item.id
                ? "bg-primary text-black"
                : "border border-white/10 bg-white/5 text-white/48 hover:text-white",
            ].join(" ")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </AdminTabBar>

      {tab === "send" ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:p-6"
        >
          <AdminNotificationMethodPicker method={method} onMethodChange={setMethod} />

          <p className="mt-4 text-[12px] font-medium text-white/40">
            {method === "app" ? (
              <>
                Mensagem no <strong className="text-white/70">sininho</strong> do app.
              </>
            ) : method === "email" ? (
              <>
                E-mail marketing via Resend (pausa entre envios; use{" "}
                <code className="text-white/55">EMAIL_REPLY_TO</code> em produção).
              </>
            ) : (
              <>
                Mesma mensagem no <strong className="text-white/70">sininho</strong> e na caixa de
                entrada.
              </>
            )}
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                {methodIncludesEmail(method) && !methodIncludesApp(method)
                  ? "Assunto do e-mail"
                  : "Título"}
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Nova rodada do Brasileirão"
                maxLength={200}
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                {methodIncludesApp(method) && methodIncludesEmail(method)
                  ? "Resumo (sininho + prévia do e-mail)"
                  : methodIncludesApp(method)
                    ? "Resumo (lista do sininho)"
                    : "Prévia do e-mail (preheader)"}
              </span>
              <input
                className={inputClass}
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="Uma linha curta visível na lista ou na caixa de entrada"
                maxLength={500}
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                Mensagem completa
              </span>
              <textarea
                className={`${inputClass} min-h-[140px] resize-y`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  methodIncludesEmail(method)
                    ? "Corpo do e-mail (parágrafos separados por linha em branco)"
                    : "Texto ao abrir a notificação no app"
                }
                maxLength={8000}
                required
              />
            </label>

            {methodIncludesEmail(method) ? (
              <AdminEmailButtonFields
                buttonLabel={buttonLabel}
                buttonUrl={buttonUrl}
                onButtonLabelChange={setButtonLabel}
                onButtonUrlChange={setButtonUrl}
              />
            ) : null}
          </div>

          <AdminNotificationRecipientPicker
            eligibleUsers={eligibleUsers}
            sendToAll={sendToAll}
            onSendToAllChange={setSendToAll}
            selected={selected}
            onSelectedChange={setSelected}
          />

          <button
            type="submit"
            disabled={loading || (!sendToAll && selected.length === 0)}
            className="mt-6 h-12 w-full rounded-[12px] bg-primary px-5 text-[12px] font-black uppercase tracking-[0.14em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
          >
            {loading
              ? "Enviando..."
              : method === "both"
                ? "Enviar no app e por e-mail"
                : method === "email"
                  ? "Enviar por e-mail"
                  : "Enviar no app"}
          </button>

          {error ? (
            <p className="mt-3 text-[12px] font-bold text-red-300">{error}</p>
          ) : null}
          {success ? (
            <p className="mt-3 text-[12px] font-bold text-primary">{success}</p>
          ) : null}
        </form>
      ) : (
        <section className="rounded-[18px] border border-white/8 bg-[#101010]">
          {historyLoading && history.length === 0 ? (
            <p className="p-6 text-[13px] text-white/40">Carregando histórico...</p>
          ) : history.length === 0 ? (
            <p className="p-6 text-[13px] text-white/40">
              Nenhum envio em massa registrado ainda.
            </p>
          ) : (
            <AdminTableScroll>
              <table className="min-w-[640px] w-full text-left">
                <thead className="border-b border-white/8 bg-white/2.5">
                  <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                    <th className="px-4 py-4">Enviado em</th>
                    <th className="px-4 py-4">Canal</th>
                    <th className="px-4 py-4">Título</th>
                    <th className="px-4 py-4">Resumo</th>
                    <th className="px-4 py-4">App</th>
                    <th className="px-4 py-4">E-mail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {history.map((item) => (
                    <tr key={item.batchId} className="text-[13px] text-white/72">
                      <td className="px-4 py-4 whitespace-nowrap text-white/80">
                        {formatAdminDateTime(item.sentAt)}
                      </td>
                      <td className="px-4 py-4 font-bold text-white/88">
                        {adminDeliveryMethodLabel(item.channels)}
                      </td>
                      <td className="px-4 py-4 font-bold text-white">{item.title}</td>
                      <td className="max-w-[220px] px-4 py-4 text-white/55">
                        <span className="line-clamp-2">{item.preview}</span>
                      </td>
                      <td className="px-4 py-4 font-black text-primary">
                        {item.appRecipients > 0
                          ? item.appRecipients.toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-white/80">
                        {item.emailQueued ? (
                          <span className="text-[12px] font-bold text-amber-300/90">
                            Em fila…
                          </span>
                        ) : item.emailSent > 0 || item.emailFailed > 0 ? (
                          <span>
                            <span className="font-black text-primary">
                              {item.emailSent.toLocaleString("pt-BR")}
                            </span>
                            {item.emailFailed > 0 ? (
                              <span className="mt-0.5 block text-[11px] text-red-300">
                                {item.emailFailed} falha(s)
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
          )}
        </section>
      )}
    </>
  );
}
