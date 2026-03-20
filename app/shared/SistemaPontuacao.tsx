import { BollIcon } from "@/app/components/Icons";

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
                    background: "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)",
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
          className="flex items-center justify-center rounded-2xl px-10 py-5"
          style={{
            backgroundColor: "#3131311A",
            border: "1px solid #5656561A",
          }}
        >
          <p
            className="text-2xl sm:text-3xl font-black uppercase text-center leading-tight"
            style={{
              background:
                "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            FINAL VALE 6 PONTOS
          </p>
        </div>
      </div>
    </section>
  );
}
