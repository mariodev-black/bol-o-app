import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Crown,
  Gift,
  LockKeyhole,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import bannerPremiacao from "@/app/assets/banner-presentes.jpeg";

const GREEN = "#B1EB0B";

const PRIZE_ROWS = [
  {
    place: "1º",
    tone: "gold",
    title: "Campeão",
    subtitle: "1º lugar geral",
    prize: "R$500.000",
    share: "50% do prêmio total",
  },
  {
    place: "2º",
    tone: "silver",
    title: "Vice-campeão",
    subtitle: "2º lugar geral",
    prize: "R$200.000",
    share: "20% do prêmio total",
  },
  {
    place: "3º",
    tone: "bronze",
    title: "3º colocado",
    subtitle: "3º lugar geral",
    prize: "R$100.000",
    share: "10% do prêmio total",
  },
  {
    place: "4º",
    tone: "dark",
    title: "4º ao 10º lugar",
    subtitle: "Do 4º ao 10º lugar",
    prize: "R$100.000",
    share: "10% do prêmio total",
  },
  {
    place: "11º",
    tone: "dark",
    title: "11º ao 100º lugar",
    subtitle: "Do 11º ao 100º lugar",
    prize: "R$100.000",
    share: "10% do prêmio total",
  },
] as const;

const HOW_IT_WORKS = [
  {
    icon: UsersRound,
    title: "Entre no bolão",
    text: "Cada cota participa do ranking oficial do Bolão do Milhão.",
  },
  {
    icon: Trophy,
    title: "Some pontos",
    text: "Acerte palpites, placares e resultados para subir posições.",
  },
  {
    icon: ShieldCheck,
    title: "Receba seguro",
    text: "A premiação é validada e paga diretamente aos vencedores.",
  },
] as const;

function medalStyle(tone: (typeof PRIZE_ROWS)[number]["tone"]) {
  if (tone === "gold") {
    return {
      background:
        "linear-gradient(145deg, #FFF7A8 0%, #F8C341 42%, #9E6500 100%)",
      color: "#160F00",
      boxShadow: "0 0 28px rgba(248,195,65,0.28)",
    };
  }
  if (tone === "silver") {
    return {
      background:
        "linear-gradient(145deg, #FFFFFF 0%, #AEB5BF 52%, #525B66 100%)",
      color: "#101419",
      boxShadow: "0 0 24px rgba(226,232,240,0.18)",
    };
  }
  if (tone === "bronze") {
    return {
      background:
        "linear-gradient(145deg, #FFD0A3 0%, #C56F27 48%, #67330F 100%)",
      color: "#190A02",
      boxShadow: "0 0 24px rgba(197,111,39,0.2)",
    };
  }
  return {
    background: "linear-gradient(145deg, #1A1A1A 0%, #0D0D0D 100%)",
    color: "rgba(255,255,255,0.86)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
  };
}

function PrizeRow({
  row,
  featured,
}: {
  row: (typeof PRIZE_ROWS)[number];
  featured?: boolean;
}) {
  return (
    <article
      className="relative grid grid-cols-[58px_minmax(0,1fr)_112px] items-center overflow-hidden border-b border-white/7 px-3 py-3 last:border-b-0 sm:grid-cols-[74px_minmax(0,1fr)_150px] sm:px-5 sm:py-4"
      style={{
        background: featured
          ? "linear-gradient(90deg, rgba(177,235,11,0.22), rgba(177,235,11,0.06) 58%, rgba(177,235,11,0.02))"
          : "linear-gradient(90deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
      }}
    >
      {featured ? (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(177,235,11,0.72), transparent)",
          }}
        />
      ) : null}
      <div
        className="flex size-11 items-center justify-center rounded-full text-[16px] font-black ring-1 ring-white/12 sm:size-13 sm:text-[18px]"
        style={medalStyle(row.tone)}
      >
        {row.place}
      </div>

      <div className="min-w-0 border-l border-white/8 pl-3 sm:pl-5">
        <h2 className="truncate text-[13px] font-black uppercase tracking-[0.02em] text-white sm:text-[16px]">
          {row.title}
        </h2>
        <p className="mt-1 text-[10px] font-medium leading-none text-white/48 sm:text-[12px]">
          {row.subtitle}
        </p>
      </div>

      <div className="border-l border-white/8 pl-3 text-right sm:pl-5">
        <p className="text-[18px] font-black leading-none text-primary drop-shadow-[0_0_10px_rgba(177,235,11,0.18)] sm:text-[23px]">
          {row.prize}
        </p>
        <p className="mt-1 text-[9px] font-semibold leading-tight text-white/45 sm:text-[11px]">
          {row.share}
        </p>
      </div>
    </article>
  );
}

export default function PremiacaoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black pb-24 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(177,235,11,0.16), transparent 42%), radial-gradient(circle at 88% 8%, rgba(177,235,11,0.08), transparent 28%)",
        }}
      />
      <section className="overflow-hidden shadow-[0_18px_44px_rgba(0,0,0,0.6),0_0_34px_rgba(177,235,11,0.08)]">
        <Image
          src={bannerPremiacao}
          alt="Premiação milionária do Bolão do Milhão"
          priority
          sizes="(max-width: 640px) 100vw, 960px"
          className="h-auto w-full object-cover"
        />
      </section>
      <div className="relative mx-auto w-full max-w-[430px] px-3 sm:max-w-[960px] sm:px-6 lg:px-8">
        <section className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Prêmio total", value: "R$1M", icon: Gift },
            { label: "Campeão", value: "R$500K", icon: Crown },
            { label: "Top 100", value: "Pago", icon: ShieldCheck },
          ].map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="rounded-[14px] border border-white/10 bg-[#101010] px-2.5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Icon className="mx-auto size-4 text-primary" strokeWidth={2.35} />
              <p className="mt-1.5 text-[17px] font-black leading-none text-white">
                {value}
              </p>
              <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.06em] text-white/40">
                {label}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="size-4 text-primary" strokeWidth={2.35} />
            <h1 className="text-[13px] font-black uppercase tracking-[0.08em] text-white">
              Distribuição oficial
            </h1>
            <span className="h-px flex-1 bg-linear-to-r from-primary/30 to-transparent" />
          </div>

          <div className="overflow-hidden rounded-[17px] border border-white/10 bg-[#101010] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_34px_rgba(0,0,0,0.32)]">
            {PRIZE_ROWS.map((row, index) => (
              <PrizeRow key={row.place} row={row} featured={index === 0} />
            ))}
          </div>
        </section>

        <section
          className="mt-3 overflow-hidden rounded-[17px] border border-white/10 p-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)), #101010",
          }}
        >
          <div className="grid grid-cols-[1fr_44px_1fr_44px_1fr] items-center gap-1">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="contents">
                <article className="min-w-0 text-center">
                  <span className="mx-auto flex size-9 items-center justify-center rounded-[12px] border border-primary/28 bg-primary/10">
                    <Icon className="size-4 text-primary" strokeWidth={2.25} />
                  </span>
                  <h2 className="mt-1.5 truncate text-[9px] font-black uppercase tracking-[0.04em] text-white">
                    {title.replace(" no bolão", "")}
                  </h2>
                  <p className="sr-only">{text}</p>
                </article>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <span className="h-px bg-linear-to-r from-primary/40 via-primary/20 to-transparent" />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-3 grid grid-cols-[minmax(0,1fr)_118px] items-center gap-3 rounded-[18px] border border-primary/22 p-3.5"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(177,235,11,0.16), transparent 38%), linear-gradient(135deg, #111 0%, #080808 100%)",
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: GREEN }}>
              Concorra ao milhão
            </p>
            <h2 className="mt-1 text-[16px] font-black leading-tight text-white">
              Entre no ranking oficial.
            </h2>
            <p className="mt-1 text-[11px] font-medium leading-snug text-white/45">
              Faça seus palpites e dispute o Top 100.
            </p>
          </div>

          <Link
            href="/tickets"
            className="flex h-11 items-center justify-center gap-1.5 rounded-[13px] bg-primary px-3 text-[11px] font-black uppercase text-black active:scale-[0.99]"
          >
            Ticket
            <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
          </Link>
        </section>

        <section className="mt-3 flex items-center justify-between rounded-[15px] border border-white/10 bg-[#101010] px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <LockKeyhole className="size-5 text-primary" strokeWidth={2.2} />
            <p className="text-[12px] font-bold text-white/72">
              Premiação garantida e paga aos vencedores.
            </p>
          </div>
          <Medal className="size-5 shrink-0 text-primary" strokeWidth={2} />
        </section>
      </div>
    </main>
  );
}
