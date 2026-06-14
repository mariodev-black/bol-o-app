import type { Metadata } from "next";
import { PalpitesJogadoresTab } from "@/app/(authenticated)/palpites/_components/PalpitesJogadoresTab";
import { buildPageMetadata } from "@/lib/seo/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Palpites dos Jogadores — Bolão do Milhão",
  description: "Veja os últimos palpites dos outros jogadores no bolão da Copa.",
  path: "/palpites-jogadores",
  noIndex: true,
});

export default function PalpitesJogadoresPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6 pb-10 lg:max-w-3xl lg:pt-10">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-[28px] font-black leading-tight text-white lg:text-[40px]">
          Palpites dos Jogadores
        </h1>
        <p className="mt-1 text-[15px] font-bold text-white/70 lg:text-[17px]">
          Veja os últimos palpites da galera no bolão da Copa do Mundo.
        </p>
      </div>

      <PalpitesJogadoresTab ticketId={null} bolaoType="principal" />
    </div>
  );
}
