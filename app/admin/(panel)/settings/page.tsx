import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminBRL } from "@/lib/admin/format";
import { getAppServerConfig } from "@/lib/app-server-config";
import { getExtraTicketPriceCents, getTicketPriceCents } from "@/lib/payments/ticket-config";

export default function AdminSettingsPage() {
  const { extraGiftPromo, extraChampionshipIds } = getAppServerConfig();
  const items = [
    { label: "APP_URL", value: process.env.APP_URL ?? "Não configurado" },
    { label: "Webhook Skale", value: process.env.SKALE_POSTBACK_URL ?? `${process.env.APP_URL ?? ""}/api/webhooks/skale` },
    { label: "Cota principal", value: formatAdminBRL(getTicketPriceCents("general")) },
    { label: "Cota extra", value: formatAdminBRL(getExtraTicketPriceCents()) },
    { label: "Bolão diário", value: formatAdminBRL(getTicketPriceCents("daily")) },
    { label: "Sessão admin 2FA", value: "2 horas" },
    {
      label: "Brinde extra pós-login",
      value: extraGiftPromo.enabled
        ? `Ativa · ${extraGiftPromo.displayName} (ids ${extraGiftPromo.championshipIds.join(", ") || "—"}) · ${extraGiftPromo.prizeLabel}`
        : "Desativada",
    },
    {
      label: "BOLOES_EXTRA_CHAMPIONSHIP_IDS",
      value: extraChampionshipIds.length > 0 ? extraChampionshipIds.join(", ") : "Não configurado",
    },
  ];

  return (
    <>
      <AdminPageTitle title="Configurações" subtitle="Resumo operacional das configurações públicas e preços ativos." />
      <section className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{item.label}</p>
            <p className="mt-3 wrap-break-word text-[14px] font-bold text-white/82">{item.value}</p>
          </article>
        ))}
      </section>
    </>
  );
}
