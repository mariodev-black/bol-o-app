import { Button } from "@/app/(authenticated)/components/ui/button";
import Link from "next/link";
import Fred from "@/app/assets/fred.png";
import Benjamin from "@/app/assets/benjamin.png";
import Caze from "@/app/assets/caze.png";

interface Influencer {
  name: string;
  followers: string;
  followUrl: string;
  image: string | null;
}

const INFLUENCERS: Influencer[] = [
  {
    name: "Benjamin Back",
    followers: "3 Milhões de seguidores",
    followUrl: "#",
    image: Fred.src,
  },
  {
    name: "Benjamin Back",
    followers: "3 Milhões de seguidores",
    followUrl: "#",
    image: Benjamin.src,
  },
  {
    name: "Caze TV",
    followers: "3 Milhões de seguidores",
    followUrl: "#",
    image: Caze.src,
  },
];

function InfluencerCard({ influencer }: { influencer: Influencer }) {
  return (
    <div className="relative w-full h-[185.2850341796875px] md:h-[250px] rounded-2xl overflow-hidden">
      {/* Foto de fundo em P&B */}
      {influencer.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={influencer.image}
          alt={influencer.name}
          className="absolute inset-0 w-full h-full object-cover object-top-right grayscale"
        />
      ) : (
        <div className="absolute inset-0 bg-[#1a2535]" />
      )}

      {/* Overlay escuro — mais escuro na direita para o texto ser legível */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/50 to-black/85" />

      {/* Conteúdo — posicionado na direita */}
      <div className="absolute top-0 right-0 bottom-0 w-[55%] flex flex-col justify-center items-start px-6 sm:px-8">
        <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">
          {influencer.name}
        </h3>
        <p className="mt-1 text-sm text-white/60">{influencer.followers}</p>

        <Button asChild size="sm" className="mt-4 rounded-full px-5">
          <Link href={influencer.followUrl}>Seguir influenciador</Link>
        </Button>

        <p className="mt-3 text-xs text-white/40">
          Participando do Bolão do Milhão
        </p>
      </div>
    </div>
  );
}

export function InfluencersSection() {
  return (
    <section
      className="px-4 sm:px-10 lg:px-20 py-12"
    >
      <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-8 leading-tight block md:hidden"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #DAB682 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
        Influenciadores <br />
        parceiros
      </h2>

      <div className="items-center gap-3 mb-20 mt-4 justify-center hidden md:flex">
        <span className="h-[1.5px] w-32 bg-[#FFFFFF26]" />
        <span
          className="text-2xl sm:text-3xl lg:text-5xl font-extrabold md:font-light md:font-black tracking-widest text-nowrap"
          style={{
            background: "linear-gradient(90deg, #FFF9F3, #999692)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Influenciadores parceiros
        </span>
        <span className="h-[2px] w-32 bg-[#FFFFFF26]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[1440px] mx-auto">
        {INFLUENCERS.map((inf, i) => (
          <InfluencerCard key={i} influencer={inf} />
        ))}
      </div>
    </section>
  );
}
