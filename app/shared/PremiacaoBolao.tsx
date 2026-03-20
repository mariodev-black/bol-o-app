const PLACES = [
  { place: "1º LUGAR", variant: "gold" },
  { place: "2º LUGAR", variant: "border" },
  { place: "3º LUGAR", variant: "border" },
  { place: "4º LUGAR", variant: "border" },
  { place: "5º LUGAR", variant: "border" },
  { place: "6º LUGAR", variant: "border" },
  { place: "7º LUGAR", variant: "border" },
  { place: "8º LUGAR", variant: "border" },
  { place: "9º LUGAR", variant: "muted" },
  { place: "10º LUGAR", variant: "muted" },
] as const;

const BORDER_GRADIENT =
  "linear-gradient(#03060D, #03060D) padding-box, linear-gradient(145.12deg, rgba(245,201,98,0.6) 3.44%, rgba(232,173,63,0.05) 48.06%, rgba(245,201,98,0.6) 92.67%) border-box";

export function PremiacaoBolao() {
  return (
    <section
      className="flex flex-col items-center px-5 pt-12 pb-10"
    >
      {/* Título com gradiente */}
      <h2
        className="text-3xl sm:text-4xl font-bold text-center mb-8 leading-tight"
        style={{
          background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Premiação do Bolão
      </h2>

      {/* Lista de lugares */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {PLACES.map(({ place, variant }) => {
          /* ── 1º LUGAR: botão dourado ── */
          if (variant === "gold") {
            return (
              <div
                key={place}
                className="flex items-center justify-center rounded-xl py-4"
                style={{
                  background:
                    "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)",
                }}
              >
                <span className="text-[#0E141B] font-extrabold text-[20px] tracking-wide">
                  {place}
                </span>
              </div>
            );
          }

          /* ── 9º-10º LUGAR: muted ── */
          if (variant === "muted") {
            return (
              <div
                key={place}
                className="flex items-center justify-center rounded-xl py-4"
                style={{
                  background: BORDER_GRADIENT,
                  border: "0.95px solid transparent",
                }}
              >
                <span className="font-bold text-[20px] tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {place}
                </span>
              </div>
            );
          }

          /* ── 2º-8º LUGAR: borda gradiente ── */
          return (
            <div
              key={place}
              className="flex items-center justify-center rounded-xl py-4"
              style={{
                background: BORDER_GRADIENT,
                border: "0.95px solid transparent",
              }}
            >
              <span className="text-white font-bold text-[20px] tracking-wide">
                {place}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rodapé */}
      <p className="mt-8 text-sm text-center leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
        50% do valor arrecadado será
        <br />
        destinado à premiação!
      </p>
    </section>
  );
}
