const TEAMS = [
  // América do Sul
  { flag: "🇧🇷", name: "Brasil" },
  { flag: "🇦🇷", name: "Argentina" },
  { flag: "🇺🇾", name: "Uruguai" },
  { flag: "🇨🇴", name: "Colômbia" },
  { flag: "🇪🇨", name: "Equador" },
  { flag: "🇵🇾", name: "Paraguai" },
  { flag: "🇻🇪", name: "Venezuela" },
  { flag: "🇧🇴", name: "Bolívia" },
  // América do Norte e Central
  { flag: "🇺🇸", name: "EUA" },
  { flag: "🇲🇽", name: "México" },
  { flag: "🇨🇦", name: "Canadá" },
  { flag: "🇵🇦", name: "Panamá" },
  { flag: "🇨🇷", name: "Costa Rica" },
  { flag: "🇭🇳", name: "Honduras" },
  { flag: "🇯🇲", name: "Jamaica" },
  // Europa
  { flag: "🇫🇷", name: "França" },
  { flag: "🇪🇸", name: "Espanha" },
  { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "Inglaterra" },
  { flag: "🇩🇪", name: "Alemanha" },
  { flag: "🇵🇹", name: "Portugal" },
  { flag: "🇳🇱", name: "Holanda" },
  { flag: "🇧🇪", name: "Bélgica" },
  { flag: "🇮🇹", name: "Itália" },
  { flag: "🇭🇷", name: "Croácia" },
  { flag: "🇨🇭", name: "Suíça" },
  { flag: "🇩🇰", name: "Dinamarca" },
  { flag: "🇷🇸", name: "Sérvia" },
  { flag: "🇵🇱", name: "Polônia" },
  { flag: "🇦🇹", name: "Áustria" },
  { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", name: "Escócia" },
  { flag: "🇹🇷", name: "Turquia" },
  { flag: "🇺🇦", name: "Ucrânia" },
  { flag: "🇸🇰", name: "Eslováquia" },
  { flag: "🇸🇮", name: "Eslovênia" },
  { flag: "🇬🇷", name: "Grécia" },
  { flag: "🇨🇿", name: "Rep. Tcheca" },
  { flag: "🇷🇴", name: "Romênia" },
  { flag: "🇭🇺", name: "Hungria" },
  // África
  { flag: "🇲🇦", name: "Marrocos" },
  { flag: "🇸🇳", name: "Senegal" },
  { flag: "🇳🇬", name: "Nigéria" },
  { flag: "🇪🇬", name: "Egito" },
  { flag: "🇨🇲", name: "Camarões" },
  { flag: "🇩🇿", name: "Argélia" },
  { flag: "🇬🇭", name: "Gana" },
  { flag: "🇿🇦", name: "África do Sul" },
  { flag: "🇹🇳", name: "Tunísia" },
  // Ásia
  { flag: "🇯🇵", name: "Japão" },
  { flag: "🇰🇷", name: "Coreia do Sul" },
  { flag: "🇮🇷", name: "Irã" },
  { flag: "🇸🇦", name: "Arábia Saudita" },
  { flag: "🇦🇺", name: "Austrália" },
  { flag: "🇶🇦", name: "Catar" },
  { flag: "🇯🇴", name: "Jordânia" },
  { flag: "🇺🇿", name: "Uzbequistão" },
  // Oceania
  { flag: "🇳🇿", name: "Nova Zelândia" },
];

function FlagItem({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 shrink-0">
      <span className="text-4xl sm:text-5xl leading-none">{flag}</span>
      <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap" style={{ color: "#8a9bb0" }}>
        {name}
      </span>
    </div>
  );
}

export function FlagsMarquee() {
  const doubled = [...TEAMS, ...TEAMS];

  return (
    <section className="py-0 overflow-hidden">
      <div
        className="h-px w-full mb-5"
        style={{ background: "linear-gradient(90deg, transparent, #DAB682 30%, #DAB682 70%, transparent)" }}
      />

      <div className="flex overflow-hidden mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex animate-marquee">
          {doubled.map((team, i) => (
            <FlagItem key={i} flag={team.flag} name={team.name} />
          ))}
        </div>
      </div>

      <div
        className="h-px w-full mt-5"
        style={{ background: "linear-gradient(90deg, transparent, #DAB682 30%, #DAB682 70%, transparent)" }}
      />
    </section>
  );
}
