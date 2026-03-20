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

const GOLD_GRADIENT =
  "linear-gradient(145.12deg, rgba(245,201,98,0.6) 3.44%, rgba(232,173,63,0.05) 48.06%, rgba(245,201,98,0.6) 92.67%)";
const DARK_BG = "#07090F";

function PlaceCard({ place, variant }: { place: string; variant: "gold" | "border" | "muted" }) {
  // 1º lugar: dourado sólido
  if (variant === "gold") {
    return (
      <div
        className="flex items-center justify-center rounded-xl py-4 px-2"
        style={{ background: "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)" }}
      >
        <span className="text-[#0E141B] font-extrabold text-[18px] tracking-wide">
          {place}
        </span>
      </div>
    );
  }

  const textColor = variant === "muted" ? "rgba(255,255,255,0.3)" : "#FFFFFF";

  // Borda dupla: outer (1px) → gap escuro (3px) → inner (1px) → conteúdo
  return (
    <div className="rounded-xl p-[1px]" style={{ background: GOLD_GRADIENT }}>
      <div className="rounded-[10px] p-[3px]" style={{ backgroundColor: DARK_BG }}>
        <div className="rounded-[8px] p-[1px]" style={{ background: GOLD_GRADIENT }}>
          <div
            className="flex items-center justify-center rounded-[7px] py-5 px-2"
            style={{ backgroundColor: DARK_BG }}
          >
            <span className="font-bold text-[18px] tracking-wide" style={{ color: textColor }}>
              {place}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PremiacaoBolao() {
  return (
    <section className="flex flex-col items-center px-5 pt-12 pb-10">
      {/* Título */}
      <h2
        className="text-3xl sm:text-5xl font-bold md:font-light text-center mb-8 leading-tight md:mb-12"
        style={{
          background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Premiação do Bolão
      </h2>

      {/* ── MOBILE: lista vertical ── */}
      <div className="flex flex-col gap-3 w-full max-w-md md:hidden">
        {PLACES.map(({ place, variant }) => (
          <PlaceCard key={place} place={place} variant={variant} />
        ))}
      </div>

      {/* ── DESKTOP: grid 5x2 ── */}
      <div className="hidden md:grid grid-cols-5 gap-3 w-full max-w-3xl">
        {PLACES.map(({ place, variant }) => (
          <PlaceCard key={place} place={place} variant={variant} />
        ))}
      </div>

      {/* Rodapé */}
      <p
        className="mt-6 text-sm text-center leading-relaxed md:mt-12 md:text-[21px]"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        50% do valor arrecadado será destinado à premiação!
      </p>
    </section>
  );
}
