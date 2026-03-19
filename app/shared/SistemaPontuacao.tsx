const PONTUACOES = [
  { label: "PLACAR EXATO", pontos: "3 Pontos" },
  { label: "ACERTAR VENCEDOR", pontos: "1 Ponto" },
  { label: "EMPATE EXATO", pontos: "1 Ponto" },
];

export function SistemaPontuacao() {
  return (
    <section
      className="flex flex-col items-center px-5 pt-10 pb-16"
    >
      {/* Título com gradiente linear */}
      <h2
        className="w-full max-w-md text-3xl sm:text-4xl font-bold text-center mb-8 leading-tight"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #DAB682 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Sistema de <br /> pontuação
      </h2>

      {/* Cards */}
      <div className="flex flex-col gap-4 w-full max-w-md">
        {PONTUACOES.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center rounded-2xl px-10 py-5"
            style={{
              backgroundColor: "#3131311A",
              border: "1px solid #5656561A",
            }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest mb-2"
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
        ))}
      </div>

      {/* FINAL VALE 6 PONTOS — card com bg e border */}
      <div
        className="mt-4 w-full max-w-md flex items-center justify-center rounded-2xl px-10 py-6"
        style={{
          backgroundColor: "#3131311A",
          border: "1px solid #5656561A",
        }}
      >
        <p
          className="text-3xl sm:text-4xl font-black uppercase text-center leading-tight"
          style={{
            background: "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          FINAL VALE
          <br />6 PONTOS
        </p>
      </div>
    </section>
  );
}
