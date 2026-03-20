import Link from "next/link";
import Fred from "@/app/assets/fred.png";
import Benjamin from "@/app/assets/benjamin.png";
import Caze from "@/app/assets/caze.png";

interface Influencer {
  name: string;
  followers: string;
  followUrl: string;
  image: string | null;
  platform: "youtube" | "instagram" | "twitch";
}

const INFLUENCERS: Influencer[] = [
  {
    name: "Casimiro",
    followers: "1.5M seguidores",
    followUrl: "#",
    image: Caze.src,
    platform: "twitch",
  },
  {
    name: "Fred Bruno",
    followers: "6.5M seguidores",
    followUrl: "#",
    image: Fred.src,
    platform: "youtube",
  },
  {
    name: "Benjamin Back",
    followers: "1.5M inscritos",
    followUrl: "#",
    image: Benjamin.src,
    platform: "youtube",
  },
];

function PlatformIcon({ platform }: { platform: Influencer["platform"] }) {
  if (platform === "youtube") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#ig)">
        <defs>
          <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F58529" />
            <stop offset="50%" stopColor="#DD2A7B" />
            <stop offset="100%" stopColor="#8134AF" />
          </linearGradient>
        </defs>
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.2 4.8 1.7 5 5 .1 1.3.1 1.6.1 4.8 0 3.2 0 3.6-.1 4.8-.2 3.3-1.7 4.8-5 5-1.3.1-1.6.1-4.9.1-3.2 0-3.6 0-4.8-.1-3.3-.2-4.8-1.7-5-5C2.1 15.6 2 15.2 2 12c0-3.2 0-3.6.1-4.8.2-3.3 1.7-4.8 5-5C8.4 2.1 8.8 2.2 12 2.2zm0-2.2C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12c0 3.3 0 3.7.1 4.9.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24c3.3 0 3.7 0 4.9-.1 4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9 0-3.3 0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 12 5.8zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" />
      </svg>
    );
  }
  // twitch
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF">
      <path d="M11.6 6H13v4.5h-1.4V6zm3.8 0H17v4.5h-1.4V6zM4.5 0L1 3.5V20.5h5V24l3.5-3.5H13L23 11V0H4.5zm17 10.3L18 14h-3.5l-3 3v-3H7V1.5h14.5v8.8z" />
    </svg>
  );
}

function InfluencerCard({ influencer, index }: { influencer: Influencer; index: number }) {
  return (
    <Link href={influencer.followUrl} className="block group">
      {/* Glow externo dourado atrás do card */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: "0 0 40px rgba(254,197,84,0.18), 0 8px 32px rgba(0,0,0,0.6)",
            borderRadius: "16px",
          }}
        />

        <div
          className="relative w-full h-[200px] md:h-[230px] rounded-2xl overflow-hidden border border-[#2a2a2a]"
          style={{ backgroundColor: "#0a0a0a" }}
        >
          {/* Shimmer — reflexo varrendo da esquerda pra direita infinitamente */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden z-20 pointer-events-none">
            <div
              className="animate-shimmer absolute inset-y-0 w-[40%]"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(254,197,84,0.4) 35%, rgba(255,240,180,1) 50%, rgba(254,197,84,0.4) 65%, transparent 100%)",
                animationDelay: `${-(index * 0.7)}s`,
              }}
            />
          </div>
          {/* Foto em P&B cobrindo lado esquerdo */}
          {influencer.image && (
            <img
              src={influencer.image}
              alt={influencer.name}
              className="absolute left-0 top-0 h-full w-[100%] object-cover object-top"
            />
          )}

          {/* Gradiente forte da foto para escuro — garante legibilidade */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, rgba(10,10,10,0) 20%, rgba(10,10,10,0.75) 45%, rgba(10,10,10,0.97) 65%)",
            }}
          />

          {/* Escurecimento bottom para o badge */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16"
            style={{
              background: "linear-gradient(to top, rgba(10,10,10,1) 0%, transparent 100%)",
            }}
          />

          {/* Conteúdo à direita — nome e seguidores */}
          <div className="absolute top-0 right-0 bottom-[44px] w-[55%] flex flex-col justify-center items-start px-5">
            <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">
              {influencer.name}
            </h3>

            <div className="flex items-center gap-1.5 mt-2">
              <PlatformIcon platform={influencer.platform} />
              <span className="text-[12px] text-white/60 font-medium">
                {influencer.followers}
              </span>
            </div>
          </div>

          {/* Badge bottom — pill dourado */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-3 pt-1">
            <div
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(254,197,84,0.1)",
                border: "1px solid rgba(254,197,84,0.3)",
              }}
            >
              {/* Bolinha de status */}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "#FEC554", boxShadow: "0 0 6px #FEC554" }}
              />
              <span
                className="text-[11px] font-semibold tracking-wide whitespace-nowrap"
                style={{
                  background: "linear-gradient(90deg, #FEC554 0%, #FFE8BA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Participando do Bolão do Milhão
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function InfluencersSection() {
  return (
    <section className="px-4 sm:px-10 lg:px-20 py-12">
      <h2
        className="text-4xl sm:text-5xl font-light text-white text-center mb-8 leading-tight block md:hidden"
        style={{
          background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Influenciadores <br />
        parceiros
      </h2>

      <div className="items-center gap-3 mb-10 mt-4 justify-center hidden md:flex">
        <span className="h-[1.5px] w-32 bg-[#FFFFFF26]" />
        <span
          className="text-2xl sm:text-3xl lg:text-5xl font-extrabold md:font-light tracking-widest text-nowrap"
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
          <InfluencerCard key={i} influencer={inf} index={i} />
        ))}
      </div>
    </section>
  );
}
