import Link from "next/link";
import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { listAmistososAdminMatches } from "@/lib/football/amistosos-friendlies-persistence";
import { AMISTOSOS_FRIENDLIES_DISPLAY_NAME } from "@/lib/football/amistosos-friendlies";
import { AdminAmistososPlacarClient } from "./AdminAmistososPlacarClient";

export default async function AdminAmistososBolaoPage() {
  const matches = await listAmistososAdminMatches();

  return (
    <>
      <div className="mb-5">
        <Link
          href="/admin/boloes"
          className="inline-flex rounded-full border border-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/58 transition-colors hover:border-primary/25 hover:text-primary"
        >
          Voltar para bolões
        </Link>
      </div>
      <AdminPageTitle
        title={`${AMISTOSOS_FRIENDLIES_DISPLAY_NAME} — Placares`}
        subtitle="Marque o placar oficial de cada jogo. A pontuação dos usuários é atualizada na hora (sem ao vivo)."
      />
      <AdminAmistososPlacarClient initialMatches={matches} />
    </>
  );
}
