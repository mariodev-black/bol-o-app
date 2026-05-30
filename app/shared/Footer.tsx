import Link from "next/link";
import Image from "next/image";
import { ProductLink } from "@/app/shared/ProductLink";
import {
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Send,
  Headphones,
  Phone,
  Mail,
  Megaphone,
  Building2,
  BookOpen,
} from "lucide-react";
import logo        from "@/app/assets/logo.svg";
import lexisNexis from "@/app/assets/lexis-nexis.png";
import sportsradar from "@/app/assets/sportsradar.png";

// ── Ícone TikTok (não existe no lucide) ──────────────────────
function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" />
    </svg>
  );
}

// ── Divisória ─────────────────────────────────────────────────
function Divider() {
  return (
    <div
      className="w-full h-px block lg:hidden"
      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
    />
  );
}

// ── Coluna de links ───────────────────────────────────────────
function LinkColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: { label: string; href: string; product?: boolean }[];
  className?: string;
}) {
  const linkClass =
    "text-sm leading-snug transition-colors hover:text-white";
  const linkStyle = { color: "rgba(255,255,255,0.55)" };

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <span className="text-sm font-semibold text-white mb-1">{title}</span>
      {links.map(({ label, href, product }) =>
        product ? (
          <ProductLink key={label} href={href} className={linkClass} style={linkStyle}>
            {label}
          </ProductLink>
        ) : (
          <Link key={label} href={href} className={linkClass} style={linkStyle}>
            {label}
          </Link>
        ),
      )}
    </div>
  );
}

// ── Dados ─────────────────────────────────────────────────────
const SOCIAL_LINKS = [
  { Icon: Facebook,   label: "Facebook",   href: "#" },
  { Icon: Twitter,    label: "Twitter/X",  href: "#" },
  { Icon: Youtube,    label: "YouTube",    href: "#" },
  { Icon: Instagram,  label: "Instagram",  href: "#" },
  { Icon: Send,       label: "Telegram",   href: "#" },
  { Icon: TikTokIcon, label: "TikTok",     href: "#" },
] as const;

const APOSTE_LINKS = [
  { label: "Como Participar", href: "/#como-funciona" },
  { label: "Comprar Ticket", href: "/cadastrar?from=/tickets", product: true },
  { label: "Meus Bolões", href: "/boloes", product: true },
  { label: "Ranking", href: "/ranking", product: true },
];

const LINKS_UTEIS = [
  { label: "Comunidade",       href: "#" },
  { label: "Ofertas",          href: "#" },
  { label: "Glossário",        href: "#" },
  { label: "Jogo responsável", href: "#" },
  { label: "Blog",             href: "#" },
  { label: "Seja um Afiliado", href: "#" },
];

const REGRAS_LINKS = [
  { label: "Termos e Condições Gerais",          href: "/termos" },
  { label: "Jogo responsável",                    href: "#" },
  { label: "Regulamento do Bolão",               href: "/regulamento" },
  { label: "Termos e condições gerais de bônus", href: "#" },
  { label: "Política de privacidade",            href: "/privacidade" },
  { label: "Regras de pagamento",                href: "#" },
  { label: "Indique e ganhe",                    href: "#" },
];

const OUTROS_LINKS = [
  { Icon: Megaphone,  label: "Ouvidoria" },
  { Icon: Building2,  label: "Procon" },
  { Icon: BookOpen,   label: "Código de Defesa do Consumidor" },
];

// ── Footer ────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer
      className="w-full flex flex-col"
      style={{ backgroundColor: "#004C3D" }}
    >
      {/* ── Corpo principal ─────────────────────────────────── */}
      <div className="w-full max-w-7xl mx-auto px-5 py-10 flex flex-col gap-10">

        {/* Grid principal — Mobile: logo centralizada + 2 cols links | Desktop: 5 cols alinhadas */}

        {/* Logo — mobile only (centralizada, antes do grid) */}
        <div className="flex flex-col items-center gap-4 lg:hidden">
          <Link href="/" aria-label="Início">
            <Image src={logo} alt="Bolão do Milhão" height={72} />
          </Link>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {SOCIAL_LINKS.map(({ Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                aria-label={label}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/15"
                style={{
                  color: "rgba(255,255,255,0.65)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Icon className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>

        {/* Grid de colunas — mobile: 2 cols | desktop: 5 cols (logo + 4 links) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Col 0 — Logo (apenas desktop) */}
          <div className="hidden lg:flex flex-col gap-4">
            <Link href="/" aria-label="Início">
              <Image src={logo} alt="Bolão do Milhão" height={64} />
            </Link>
          </div>

          <LinkColumn title="Aposte"      links={APOSTE_LINKS} />
          <LinkColumn title="Links úteis" links={LINKS_UTEIS} />
          <LinkColumn title="Regras"      links={REGRAS_LINKS} className="col-span-2 lg:col-span-1" />

          {/* Suporte + Outros na mesma coluna */}
          <div className="flex flex-col gap-3 col-span-2 lg:col-span-1">
              <span className="text-sm font-semibold text-white mb-1">Suporte</span>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Conte com nossa equipe sempre que precisar. Atendimento disponível 24
                horas por dia, 7 dias por semana.
              </p>
              <div className="flex flex-col gap-2 mt-1">
                <Link
                  href="#"
                  className="flex items-center gap-2 text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  <Headphones className="w-4 h-4 shrink-0" />
                  Central de ajuda
                </Link>
                
                <Link
                  href="#"
                  className="flex items-center gap-2 text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  atendimento@bolaodomilhao.com.br
                </Link>
              </div>

              {/* Outros */}
              <span className="text-sm font-semibold text-white mt-5 mb-1">Outros</span>
              <div className="flex flex-col gap-2">
                {OUTROS_LINKS.map(({ Icon, label }) => (
                  <Link
                    key={label}
                    href="#"
                    className="flex items-center gap-2 text-sm transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </Link>
                ))}
          </div>
          </div>
        </div>

        <Divider />

        {/* Aviso de jogo responsável */}
        <p
          className="text-sm text-center leading-relaxed max-w-2xl mx-auto"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          O jogo, se não controlado e feito com responsabilidade, pode ser
          prejudicial. Todas as informações disponíveis na página de{" "}
          <Link
            href="#"
            className="underline font-semibold"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Jogo responsável
          </Link>
          .
        </p>
      </div>

      <Divider />

      {/* ── Barra inferior ──────────────────────────────────────── */}
      {/* Mobile: empilhado | Desktop: grid 3 colunas */}
      <div className="w-full max-w-7xl mx-auto px-5 py-6 flex flex-col lg:grid lg:items-center gap-6" style={{ gridTemplateColumns: "auto 1fr auto" }}>

        {/* Col 1 — Card autorização */}
        <div
          className="grid grid-cols-2 items-stretch rounded-lg overflow-hidden w-full lg:w-fit shrink-0"
          style={{ border: "1px solid rgba(255,255,255,0.18)" }}
        >
          {/* Texto de autorização */}
          <div className="flex items-center px-2 py-2 lg:px-3 lg:py-2">
            <span className="text-[12px] lg:text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              Autorização SPA/MF nº 320/2025
            </span>
          </div>

          {/* 18+ + avisos */}
          <div
            className="flex items-center gap-1.5 lg:gap-2 px-2 py-2 lg:px-3 lg:py-2"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}
          >
            <div
              className="flex items-center justify-center w-6 h-6 lg:w-7 lg:h-7 rounded-full text-[12px] lg:text-[11px] font-bold shrink-0"
              style={{ border: "1.5px solid rgba(255,255,255,0.45)", color: "rgba(255,255,255,0.9)" }}
            >
              18+
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="flex items-center justify-center w-3 h-3 rounded-full text-[7px] font-bold shrink-0" style={{ backgroundColor: "#F59E0B", color: "#000" }}>!</span>
                <span className="text-[9px] lg:text-[12px] leading-tight" style={{ color: "rgba(255,255,255,0.75)" }}>Aposte com responsabilidade</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="flex items-center justify-center w-3 h-3 rounded-full text-[7px] font-bold shrink-0" style={{ backgroundColor: "#EF4444", color: "#fff" }}>✕</span>
                <span className="text-[9px] lg:text-[12px] leading-tight" style={{ color: "rgba(255,255,255,0.75)" }}>Aposta não é investimento</span>
              </div>
            </div>
          </div>
        </div>

        {/* Col 2 — Texto legal (centro) */}
        <p className="text-[12px] leading-relaxed lg:text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
          Este site é operado por EB INTERMEDIAÇÕES E JOGOS S/A, empresa brasileira
          inscrita no CNPJ sob o nº 61.349.217/0001-04 e devidamente autorizada pela
          Secretaria de Prêmios e Apostas através da Portaria SPA/MF nº 320, de 17 de
          fevereiro de 2025.
        </p>

        {/* Col 3 — Logos (direita) */}
        <div className="flex items-center gap-4 lg:justify-end">
          <Image src={lexisNexis}  alt="LexisNexis Risk Solutions" height={28} className="object-contain" />
          <Image src={sportsradar} alt="Sportradar"                height={28} className="object-contain" />
        </div>

      </div>
    </footer>
  );
}
