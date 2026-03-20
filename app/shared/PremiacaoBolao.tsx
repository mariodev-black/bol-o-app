import Image from "next/image";
import dinheiroSaco from "@/app/assets/dinheiro-saco.png";
import cardPixel from "@/app/assets/card-pixel.png";

const PLACES = [
  "1º Lugar",
  "2º Lugar",
  "3º Lugar",
  "4º Lugar",
  "5º a 10º Lugar",
];

function PlaceCard({ label, featured }: { label: string; featured?: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl overflow-hidden py-8 px-2
        ${featured ? "col-span-2 md:col-span-1 md:flex-1" : "flex-1"}
      `}
      style={{ backgroundColor: "#070707" }}
    >
      {/* Textura pixel como overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${cardPixel.src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "auto",
          opacity: 1,
          mixBlendMode: "overlay",
        }}
      />

      {/* Glow atrás da imagem */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: featured ? 120 : 90,
          height: featured ? 120 : 90,
          background: 'radial-gradient(circle, rgba(254,197,84,0.4) 0%, rgba(255,120,0,0.15) 55%, transparent 75%)',
          filter: 'blur(14px)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -62%)',
        }}
      />

      {/* Imagem flutuando */}
      <div className="animate-float relative z-10">
        <Image
          src={dinheiroSaco}
          alt={label}
          width={featured ? 140 : 100}
          height={featured ? 140 : 100}
          className="object-contain"
        />
      </div>
      <span
        className="relative z-10 font-semibold text-center leading-tight text-[20px] md:text-[20px]"
        style={{
          background: "linear-gradient(180deg, #FEC554 0%, #FFE8BA 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function PremiacaoBolao() {
  return (
    <section className="flex flex-col items-center px-5 pt-10 pb-10">
      {/* Título: seta ao lado alinhada ao bottom */}
      <div className="flex flex-row items-end gap-2 mb-5">
        <h1
          className="text-3xl sm:text-5xl font-light text-center leading-tight md:font-light"
          style={{
            background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Premiação do Bolão
        </h1>
        <svg
          className="mb-1 shrink-0"
          width="27"
          height="23"
          viewBox="0 0 27 23"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20.3278 14.7369C18.9743 12.3952 17.3076 10.7216 15.5946 9.1439C12.6488 6.4309 9.40006 4.35207 5.78146 3.31266C4.29447 2.88575 2.70988 2.94452 1.17153 2.78057C0.534612 2.71251 -0.0175513 2.55476 0.000426126 1.54628C0.0158353 0.60895 0.585977 -0.136601 1.41294 0.0211677C3.14134 0.352173 4.90827 0.605842 6.55706 1.26166C8.98658 2.22993 11.4572 3.24769 13.6684 4.75732C15.8206 6.22673 17.7236 8.26535 19.6318 10.1988C20.6282 11.2104 21.4218 12.5158 22.2693 13.7316C22.7547 14.4276 23.2221 14.4987 23.9207 14.1523C24.6269 13.8027 25.4128 13.6016 26.1756 13.549C26.4504 13.5305 27.0051 14.1492 27 14.4678C26.982 15.9279 26.8022 17.385 26.6995 18.842C26.6507 19.5164 26.5711 20.2063 26.643 20.8683C26.7406 21.7839 26.6687 22.7058 25.9111 22.944C25.3743 23.1141 24.6167 22.8759 24.1159 22.5078C22.7573 21.5024 21.4912 20.3176 20.1762 19.2256C19.8989 18.9967 19.5753 18.8389 19.2568 18.6873C18.584 18.3687 17.9676 17.9944 18.0215 16.9488C18.0626 16.1476 19.0771 14.8359 19.7114 14.7339C19.8629 14.7091 20.0196 14.7308 20.3329 14.7308L20.3278 14.7369Z"
            fill="#FFE8BA"
          />
        </svg>
      </div>

      {/* Container geral — grid 2 cols mobile, linha no desktop */}
      <div
        className="grid grid-cols-2 md:flex md:flex-row gap-1 w-full max-w-[934px] rounded-[14px] border border-[#202020] p-1 md:my-5"
        style={{
          background: "linear-gradient(180deg, #FFEA9566 0%, #000000 100%)",
          boxShadow:
            "inset 0px 0px 3.5px rgba(255,255,255,0.25), 0px 32px 27px rgba(0,0,0,0.21)",
        }}
      >
        {PLACES.map((label, i) => (
          <PlaceCard key={label} label={label} featured={i === PLACES.length - 1} />
        ))}
      </div>

      {/* Rodapé */}
      <p className="mt-5 text-[11px] md:text-sm text-center tracking-widest uppercase text-[#FFEA95]">
        50% do valor arrecadado será distribuído em premiações
      </p>
    </section>
  );
}
