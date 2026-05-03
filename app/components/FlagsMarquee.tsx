const TEAMS = [
  // América do Sul
  { code: "br", name: "Brasil" },
  { code: "ar", name: "Argentina" },
  { code: "uy", name: "Uruguai" },
  { code: "co", name: "Colômbia" },
  { code: "ec", name: "Equador" },
  { code: "py", name: "Paraguai" },
  { code: "ve", name: "Venezuela" },
  { code: "bo", name: "Bolívia" },
  // América do Norte e Central
  { code: "us", name: "EUA" },
  { code: "mx", name: "México" },
  { code: "ca", name: "Canadá" },
  { code: "pa", name: "Panamá" },
  { code: "cr", name: "Costa Rica" },
  { code: "hn", name: "Honduras" },
  { code: "jm", name: "Jamaica" },
  // Europa
  { code: "fr", name: "França" },
  { code: "es", name: "Espanha" },
  { code: "gb-eng", name: "Inglaterra" },
  { code: "de", name: "Alemanha" },
  { code: "pt", name: "Portugal" },
  { code: "nl", name: "Holanda" },
  { code: "be", name: "Bélgica" },
  { code: "it", name: "Itália" },
  { code: "hr", name: "Croácia" },
  { code: "ch", name: "Suíça" },
  { code: "dk", name: "Dinamarca" },
  { code: "rs", name: "Sérvia" },
  { code: "pl", name: "Polônia" },
  { code: "at", name: "Áustria" },
  { code: "gb-sct", name: "Escócia" },
  { code: "tr", name: "Turquia" },
  { code: "ua", name: "Ucrânia" },
  { code: "sk", name: "Eslováquia" },
  { code: "si", name: "Eslovênia" },
  { code: "gr", name: "Grécia" },
  { code: "cz", name: "Rep. Tcheca" },
  { code: "ro", name: "Romênia" },
  { code: "hu", name: "Hungria" },
  // África
  { code: "ma", name: "Marrocos" },
  { code: "sn", name: "Senegal" },
  { code: "ng", name: "Nigéria" },
  { code: "eg", name: "Egito" },
  { code: "cm", name: "Camarões" },
  { code: "dz", name: "Argélia" },
  { code: "gh", name: "Gana" },
  { code: "za", name: "África do Sul" },
  { code: "tn", name: "Tunísia" },
  // Ásia
  { code: "jp", name: "Japão" },
  { code: "kr", name: "Coreia do Sul" },
  { code: "ir", name: "Irã" },
  { code: "sa", name: "Arábia Saudita" },
  { code: "au", name: "Austrália" },
  { code: "qa", name: "Catar" },
  { code: "jo", name: "Jordânia" },
  { code: "uz", name: "Uzbequistão" },
  // Oceania
  { code: "nz", name: "Nova Zelândia" },
];

function FlagItem({ code, name }: { code: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 shrink-0">
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
        width={40}
        height={30}
        alt={name}
        className="rounded-sm object-cover"
        style={{ width: 40, height: 30 }}
      />
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
        style={{ background: "linear-gradient(90deg, transparent, #C6FF00 30%, #C6FF00 70%, transparent)" }}
      />

      <div className="flex overflow-hidden mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex animate-flags-marquee">
          {doubled.map((team, i) => (
            <FlagItem key={i} code={team.code} name={team.name} />
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
