import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function SaquesPage() {
  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 md:py-8 max-w-lg md:max-w-2xl mx-auto w-full">
      <Link
        href="/indique"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-6 w-fit transition-opacity hover:opacity-80"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para indicações
      </Link>

      <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight mb-2">
        Sacar ganhos
      </h1>
      <p className="text-[14px] leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.42)" }}>
        Área de solicitação de saques. Em breve você poderá transferir seu saldo de indicações para sua conta.
      </p>

      <div
        className="rounded-2xl p-6 border border-white/8"
        style={{ background: "#0A0E19" }}
      >
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Fluxo de saque em construção.
        </p>
      </div>
    </div>
  );
}
