import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminPredictionStats, listAdminPredictions } from "@/lib/admin/sections";
import { AdminPalpitesClient } from "./AdminPalpitesClient";

export default async function AdminPalpitesPage() {
  const [stats, predictions] = await Promise.all([
    getAdminPredictionStats(),
    listAdminPredictions(),
  ]);
  const cards = [
    { label: "Palpites enviados", value: stats.predictionsCount.toLocaleString("pt-BR") },
    { label: "Jogadores únicos", value: stats.playersCount.toLocaleString("pt-BR") },
    { label: "Cotas com palpites", value: stats.ticketsCount.toLocaleString("pt-BR") },
  ];

  return (
    <>
      <AdminPageTitle title="Palpites" subtitle="Monitore o volume de palpites enviados pelos jogadores." />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">{card.label}</p>
            <p className="mt-4 text-[30px] font-black leading-none tracking-[-0.05em] text-primary">{card.value}</p>
          </article>
        ))}
      </div>
      <AdminPalpitesClient predictions={predictions} />
    </>
  );
}
