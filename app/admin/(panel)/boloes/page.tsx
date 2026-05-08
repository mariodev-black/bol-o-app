import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminBoloesDashboardData } from "@/lib/admin/sections";
import Link from "next/link";

export default async function AdminBoloesPage() {
  const data = await getAdminBoloesDashboardData();

  return (
    <>
      <AdminPageTitle
        title="Bolões apostados"
        subtitle="Bolão principal e bolões diários com apostas. Clique em um card para abrir o ranking detalhado."
      />

      <section className="rounded-[18px] border border-white/8 bg-[#101010] p-4">
        <div className="mb-4">
          <h2 className="text-[15px] font-black text-white">Todos os bolões</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Primeiro o bolão principal; ao lado e abaixo ficam os bolões diários existentes com cotas apostadas.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            href="/admin/boloes/principal"
            className="block rounded-[18px] border border-white/8 bg-white/3 p-5 transition-colors hover:border-primary/20 hover:bg-white/5 lg:col-span-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Principal</p>
                <h3 className="mt-3 text-[24px] font-black leading-none tracking-[-0.04em] text-white">Bolão principal</h3>
                <p className="mt-2 text-[12px] font-bold text-white/38">Ranking geral de cotas principais.</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
                Geral
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ["Cotas", data.principal.ticketsCount],
                ["Jogadores", data.principal.playersCount],
                ["Pontos", data.principal.totalPoints],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[12px] border border-white/8 bg-black/25 px-2 py-3">
                  <p className="text-[10px] font-black uppercase text-white/30">{label}</p>
                  <p className="mt-1 text-[16px] font-black text-white">{Number(value).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[12px] font-black uppercase tracking-[0.14em] text-primary">Abrir detalhes</p>
          </Link>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {data.dailyCards.length ? data.dailyCards.map((card) => {
              return (
                <Link
                  key={card.date}
                  href={`/admin/boloes/diario?data=${encodeURIComponent(card.date)}`}
                  className="block rounded-[18px] border border-white/8 bg-white/3 p-5 transition-colors hover:border-primary/20 hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Diário</p>
                      <h3 className="mt-3 text-[22px] font-black leading-none tracking-[-0.04em] text-white">{card.date}</h3>
                      <p className="mt-2 text-[12px] font-bold text-white/38">Bolão diário com apostas nesta data.</p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
                      {card.totalPoints} pts
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Cotas", card.ticketsCount],
                      ["Jogadores", card.playersCount],
                      ["Fim", card.finishedCount],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[12px] border border-white/8 bg-black/25 px-2 py-3">
                        <p className="text-[10px] font-black uppercase text-white/30">{label}</p>
                        <p className="mt-1 text-[16px] font-black text-white">{Number(value).toLocaleString("pt-BR")}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-[12px] font-black uppercase tracking-[0.14em] text-primary">Abrir detalhes</p>
                </Link>
              );
            }) : (
              <div className="rounded-[18px] border border-white/8 bg-white/3 p-6 text-center sm:col-span-2">
                <p className="text-[14px] font-black text-white">Nenhum bolão diário encontrado</p>
                <p className="mt-2 text-[12px] text-white/38">Quando houver cotas diárias pagas, elas aparecem aqui.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
