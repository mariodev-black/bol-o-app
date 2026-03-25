import Link from "next/link";
import { ChevronLeft, Wallet } from "lucide-react";

export default function DepositoPage() {
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

      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center border"
          style={{
            background: "rgba(212,175,55,0.10)",
            borderColor: "rgba(212,175,55,0.28)",
          }}
          aria-hidden="true"
        >
          <Wallet className="w-5 h-5" style={{ color: "#D4AF37" }} />
        </div>
        <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight">Depositar</h1>
      </div>

      <p className="text-[14px] leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.42)" }}>
        Área de depósito em construção. Em breve você poderá adicionar créditos via PIX.
      </p>

      <div
        className="rounded-2xl border p-6"
        style={{
          background: "#0A0E19",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Fluxo de depósito em breve.
        </p>
      </div>
    </div>
  );
}

