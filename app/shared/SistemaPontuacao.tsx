import { BollIcon } from "@/app/components/Icons";
import { TrophyGold } from "@/app/shared/RankingAtual";

const PONTUACOES = [
  { label: "PLACAR EXATO", pontos: "3 Pontos" },
  { label: "ACERTAR VENCEDOR", pontos: "1 Ponto" },
  { label: "EMPATE EXATO", pontos: "1 Ponto" },
];

export function SistemaPontuacao() {
  return (
    <section className="relative flex flex-col items-center px-5 pt-10 pb-16 overflow-hidden">
      {/* Radial background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, #0B1428C4 0%, transparent 70%)",
        }}
      />

      {/* Título */}
      <h2
        className="relative w-full max-w-2xl text-3xl sm:text-5xl font-bold text-center mb-8 leading-tight"
        style={{
          background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Sistema de pontuação
      </h2>

      {/* Wrapper cards */}
      <div className="relative w-full max-w-4xl flex flex-col gap-3">
        {/* 3 cards em linha */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          {PONTUACOES.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center rounded-2xl px-6 py-5 gap-2 w-full sm:flex-1 sm:flex-row sm:items-center sm:justify-start sm:gap-4"
              style={{
                backgroundColor: "#3131311A",
                border: "1px solid #5656561A",
              }}
            >
              <div className="shrink-0">
                <BollIcon />
              </div>
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#FEC554" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-2xl font-bold"
                  style={{
                    background: "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {item.pontos}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* FINAL VALE 6 PONTOS */}
        <div
          className="relative flex items-center justify-center rounded-2xl px-10 py-6 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,175,47,0.10) 0%, rgba(218,182,130,0.06) 100%)",
            border: "1px solid rgba(255,175,47,0.35)",
            boxShadow: "0 0 32px rgba(255,175,47,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* glow atrás do texto */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(255,175,47,0.08) 0%, transparent 70%)",
            }}
          />
          {/* espelho / shine sweep */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 pointer-events-none animate-shine"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
            }}
          />
          <div className="relative flex flex-col items-center justify-center gap-3">
            <TrophyGold size={80} label="6" />
            <p
              className="text-2xl sm:text-4xl font-black uppercase text-center leading-tight tracking-wide"
              style={{
                background: "linear-gradient(180deg, #FFF9F3 0%, #FFE8BA 40%, #D4AF37 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              FINAL VALE 6 PONTOS
            </p>
          </div>

          

        </div>
      </div>
    </section>
  );
}
