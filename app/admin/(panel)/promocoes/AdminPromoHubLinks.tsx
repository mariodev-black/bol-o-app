"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import {
  buildPromoHubCopyTemplates,
  PROMOTIONS_HUB_PATH,
} from "@/lib/promotions/hub-public-links";

export function AdminPromoHubLinks({ hubUrl }: { hubUrl: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const templates = buildPromoHubCopyTemplates(hubUrl);

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <section className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
      <h2 className="text-[15px] font-black uppercase tracking-wide text-white">
        Link do hub de promoções
      </h2>
      <p className="mt-1 text-[13px] text-white/55">
        Envie este link em campanhas. Ao entrar logado, o painel de promoções
        abre automaticamente para resgatar brindes.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5">
          <Link2 className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
          <code className="min-w-0 truncate text-[13px] font-semibold text-white/90">
            {hubUrl}
          </code>
        </div>
        <button
          type="button"
          onClick={() => void copyText("url", hubUrl)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
        >
          {copiedKey === "url" ? (
            <Check className="size-4" strokeWidth={2.5} />
          ) : (
            <Copy className="size-4" strokeWidth={2.2} />
          )}
          {copiedKey === "url" ? "Copiado" : "Copiar link"}
        </button>
      </div>

      <p className="mt-3 text-[12px] text-white/45">
        Rota interna:{" "}
        <code className="rounded bg-white/8 px-1 py-0.5 text-[11px]">
          {PROMOTIONS_HUB_PATH}
        </code>
      </p>

      <div className="mt-6 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">
          Copies prontas
        </p>
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-lg border border-white/8 bg-[#1a1a1a] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-white/70">
                {template.label}
              </p>
              <button
                type="button"
                onClick={() => void copyText(template.id, template.text)}
                className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary transition hover:opacity-80"
              >
                {copiedKey === template.id ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={2.2} />
                )}
                {copiedKey === template.id ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-white/75">
              {template.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
