"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, type AuthUser } from "@/app/shared/AuthContext";
import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { Eye, EyeOff, ChevronDown, Search } from "lucide-react";
import * as Flags from "country-flag-icons/react/3x2";

/* ── Lista completa de países ──────────────────────────────────── */
const COUNTRIES = [
  { iso: "br", name: "Brasil",                  code: "+55"  },
  { iso: "us", name: "Estados Unidos",           code: "+1"   },
  { iso: "pt", name: "Portugal",                 code: "+351" },
  { iso: "ar", name: "Argentina",                code: "+54"  },
  { iso: "mx", name: "México",                   code: "+52"  },
  { iso: "co", name: "Colômbia",                 code: "+57"  },
  { iso: "cl", name: "Chile",                    code: "+56"  },
  { iso: "pe", name: "Peru",                     code: "+51"  },
  { iso: "uy", name: "Uruguai",                  code: "+598" },
  { iso: "py", name: "Paraguai",                 code: "+595" },
  { iso: "bo", name: "Bolívia",                  code: "+591" },
  { iso: "ec", name: "Equador",                  code: "+593" },
  { iso: "ve", name: "Venezuela",                code: "+58"  },
  { iso: "gb", name: "Reino Unido",              code: "+44"  },
  { iso: "de", name: "Alemanha",                 code: "+49"  },
  { iso: "fr", name: "França",                   code: "+33"  },
  { iso: "it", name: "Itália",                   code: "+39"  },
  { iso: "es", name: "Espanha",                  code: "+34"  },
  { iso: "nl", name: "Holanda",                  code: "+31"  },
  { iso: "be", name: "Bélgica",                  code: "+32"  },
  { iso: "ch", name: "Suíça",                    code: "+41"  },
  { iso: "at", name: "Áustria",                  code: "+43"  },
  { iso: "se", name: "Suécia",                   code: "+46"  },
  { iso: "no", name: "Noruega",                  code: "+47"  },
  { iso: "dk", name: "Dinamarca",                code: "+45"  },
  { iso: "fi", name: "Finlândia",                code: "+358" },
  { iso: "pl", name: "Polônia",                  code: "+48"  },
  { iso: "cz", name: "República Tcheca",         code: "+420" },
  { iso: "ro", name: "Romênia",                  code: "+40"  },
  { iso: "hu", name: "Hungria",                  code: "+36"  },
  { iso: "gr", name: "Grécia",                   code: "+30"  },
  { iso: "ua", name: "Ucrânia",                  code: "+380" },
  { iso: "ru", name: "Rússia",                   code: "+7"   },
  { iso: "tr", name: "Turquia",                  code: "+90"  },
  { iso: "jp", name: "Japão",                    code: "+81"  },
  { iso: "cn", name: "China",                    code: "+86"  },
  { iso: "kr", name: "Coreia do Sul",            code: "+82"  },
  { iso: "in", name: "Índia",                    code: "+91"  },
  { iso: "id", name: "Indonésia",                code: "+62"  },
  { iso: "ph", name: "Filipinas",                code: "+63"  },
  { iso: "vn", name: "Vietnã",                   code: "+84"  },
  { iso: "th", name: "Tailândia",                code: "+66"  },
  { iso: "my", name: "Malásia",                  code: "+60"  },
  { iso: "sg", name: "Singapura",                code: "+65"  },
  { iso: "au", name: "Austrália",                code: "+61"  },
  { iso: "nz", name: "Nova Zelândia",            code: "+64"  },
  { iso: "za", name: "África do Sul",            code: "+27"  },
  { iso: "ng", name: "Nigéria",                  code: "+234" },
  { iso: "eg", name: "Egito",                    code: "+20"  },
  { iso: "ke", name: "Quênia",                   code: "+254" },
  { iso: "gh", name: "Gana",                     code: "+233" },
  { iso: "ma", name: "Marrocos",                 code: "+212" },
  { iso: "tn", name: "Tunísia",                  code: "+216" },
  { iso: "dz", name: "Argélia",                  code: "+213" },
  { iso: "et", name: "Etiópia",                  code: "+251" },
  { iso: "tz", name: "Tanzânia",                 code: "+255" },
  { iso: "ao", name: "Angola",                   code: "+244" },
  { iso: "mz", name: "Moçambique",               code: "+258" },
  { iso: "cv", name: "Cabo Verde",               code: "+238" },
  { iso: "sa", name: "Arábia Saudita",           code: "+966" },
  { iso: "ae", name: "Emirados Árabes Unidos",   code: "+971" },
  { iso: "il", name: "Israel",                   code: "+972" },
  { iso: "ir", name: "Irã",                      code: "+98"  },
  { iso: "iq", name: "Iraque",                   code: "+964" },
  { iso: "pk", name: "Paquistão",                code: "+92"  },
  { iso: "bd", name: "Bangladesh",               code: "+880" },
  { iso: "lk", name: "Sri Lanka",                code: "+94"  },
  { iso: "np", name: "Nepal",                    code: "+977" },
  { iso: "mm", name: "Mianmar",                  code: "+95"  },
  { iso: "kh", name: "Camboja",                  code: "+855" },
  { iso: "ca", name: "Canadá",                   code: "+1"   },
  { iso: "pa", name: "Panamá",                   code: "+507" },
  { iso: "cr", name: "Costa Rica",               code: "+506" },
  { iso: "gt", name: "Guatemala",                code: "+502" },
  { iso: "hn", name: "Honduras",                 code: "+504" },
  { iso: "sv", name: "El Salvador",              code: "+503" },
  { iso: "ni", name: "Nicarágua",                code: "+505" },
  { iso: "do", name: "Rep. Dominicana",          code: "+1"   },
  { iso: "cu", name: "Cuba",                     code: "+53"  },
  { iso: "jm", name: "Jamaica",                  code: "+1"   },
  { iso: "ht", name: "Haiti",                    code: "+509" },
  { iso: "tt", name: "Trinidad e Tobago",        code: "+1"   },
  { iso: "gf", name: "Guiana Francesa",          code: "+594" },
  { iso: "gy", name: "Guiana",                   code: "+592" },
  { iso: "sr", name: "Suriname",                 code: "+597" },
  { iso: "ie", name: "Irlanda",                  code: "+353" },
  { iso: "is", name: "Islândia",                 code: "+354" },
  { iso: "lu", name: "Luxemburgo",               code: "+352" },
  { iso: "sk", name: "Eslováquia",               code: "+421" },
  { iso: "hr", name: "Croácia",                  code: "+385" },
  { iso: "rs", name: "Sérvia",                   code: "+381" },
  { iso: "bg", name: "Bulgária",                 code: "+359" },
  { iso: "lt", name: "Lituânia",                 code: "+370" },
  { iso: "lv", name: "Letônia",                  code: "+371" },
  { iso: "ee", name: "Estônia",                  code: "+372" },
  { iso: "mk", name: "Macedônia do Norte",       code: "+389" },
  { iso: "ba", name: "Bósnia e Herzegovina",     code: "+387" },
  { iso: "al", name: "Albânia",                  code: "+355" },
  { iso: "me", name: "Montenegro",               code: "+382" },
  { iso: "md", name: "Moldávia",                 code: "+373" },
  { iso: "by", name: "Bielorrússia",             code: "+375" },
  { iso: "kz", name: "Cazaquistão",              code: "+7"   },
  { iso: "uz", name: "Uzbequistão",              code: "+998" },
  { iso: "az", name: "Azerbaijão",               code: "+994" },
  { iso: "ge", name: "Geórgia",                  code: "+995" },
  { iso: "am", name: "Armênia",                  code: "+374" },
  { iso: "jo", name: "Jordânia",                 code: "+962" },
  { iso: "lb", name: "Líbano",                   code: "+961" },
  { iso: "sy", name: "Síria",                    code: "+963" },
  { iso: "kw", name: "Kuwait",                   code: "+965" },
  { iso: "qa", name: "Catar",                    code: "+974" },
  { iso: "bh", name: "Bahrein",                  code: "+973" },
  { iso: "om", name: "Omã",                      code: "+968" },
  { iso: "ye", name: "Iêmen",                    code: "+967" },
  { iso: "af", name: "Afeganistão",              code: "+93"  },
  { iso: "tw", name: "Taiwan",                   code: "+886" },
  { iso: "hk", name: "Hong Kong",                code: "+852" },
  { iso: "mo", name: "Macau",                    code: "+853" },
  { iso: "mn", name: "Mongólia",                 code: "+976" },
  { iso: "fj", name: "Fiji",                     code: "+679" },
  { iso: "pg", name: "Papua Nova Guiné",         code: "+675" },
  { iso: "cm", name: "Camarões",                 code: "+237" },
  { iso: "ci", name: "Costa do Marfim",          code: "+225" },
  { iso: "sn", name: "Senegal",                  code: "+221" },
  { iso: "ml", name: "Mali",                     code: "+223" },
  { iso: "bf", name: "Burkina Faso",             code: "+226" },
  { iso: "ne", name: "Níger",                    code: "+227" },
  { iso: "td", name: "Chade",                    code: "+235" },
  { iso: "sd", name: "Sudão",                    code: "+249" },
  { iso: "so", name: "Somália",                  code: "+252" },
  { iso: "rw", name: "Ruanda",                   code: "+250" },
  { iso: "ug", name: "Uganda",                   code: "+256" },
  { iso: "zw", name: "Zimbábue",                 code: "+263" },
  { iso: "zm", name: "Zâmbia",                   code: "+260" },
  { iso: "bw", name: "Botsuana",                 code: "+267" },
  { iso: "na", name: "Namíbia",                  code: "+264" },
  { iso: "mg", name: "Madagascar",               code: "+261" },
  { iso: "mu", name: "Maurício",                 code: "+230" },
] as const;

type Country = typeof COUNTRIES[number];

/* ── Máscaras ──────────────────────────────────────────────────── */
const EMAIL_DOMAINS = [
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
  "icloud.com", "live.com", "uol.com.br", "bol.com.br", "ig.com.br",
];

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string, countryCode: string) {
  const d = v.replace(/\D/g, "");
  if (countryCode === "+55") {
    return d.slice(0, 11)
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }
  if (countryCode === "+1") {
    return d.slice(0, 10)
      .replace(/(\d{3})(\d)/, "($1) $2")
      .replace(/(\d{3})(\d{1,4})$/, "$1-$2");
  }
  /* genérico: grupos de 3 */
  return d.slice(0, 15).replace(/(\d{3})(?=\d)/g, "$1 ");
}

/* ── Flag SVG ──────────────────────────────────────────────────── */
function Flag({ iso }: { iso: string }) {
  const key = iso.toUpperCase() as keyof typeof Flags;
  const FlagSvg = Flags[key];
  if (!FlagSvg) return <span style={{ width: 22, height: 15, display: "inline-block", background: "rgba(255,255,255,0.1)", borderRadius: 2 }} />;
  return <FlagSvg style={{ width: 22, height: 15, borderRadius: 2, flexShrink: 0, display: "block" }} />;
}

/* ── Country Selector ──────────────────────────────────────────── */
function CountrySelector({ selected, onChange }: { selected: Country; onChange: (c: Country) => void }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef<HTMLDivElement>(null);

  const filtered = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.includes(query)
  );

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(""); }}
        style={{
          height: 52, padding: "0 12px", borderRadius: 8,
          background: "#0D1E30",
          border: open ? "2px solid rgba(218,182,130,0.85)" : "2px solid rgba(218,182,130,0.3)",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600,
          whiteSpace: "nowrap", transition: "border-color 0.15s",
        }}
      >
        <Flag iso={selected.iso} />
        <span>{selected.code}</span>
        <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.35)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          width: 260, borderRadius: 10, overflow: "hidden",
          background: "#0D1E30", border: "1px solid rgba(218,182,130,0.25)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={13} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país ou código..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "white" }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.map((c) => {
              const sel = c.iso === selected.iso;
              return (
                <button
                  key={c.iso}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(c); setOpen(false); setQuery(""); }}
                  style={{
                    width: "100%", padding: "9px 14px", textAlign: "left", cursor: "pointer",
                    background: sel ? "rgba(218,182,130,0.1)" : "none", border: "none",
                    display: "flex", alignItems: "center", gap: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "none"; }}
                >
                  <Flag iso={c.iso} />
                  <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "#DAB682", fontWeight: 700 }}>{c.code}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ padding: 14, fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: 0 }}>
                Nenhum país encontrado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────────── */
export function CadastrarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, applySessionUser } = useAuth();
  const [showPw, setShowPw]       = useState(false);
  const [accepted, setAccepted]   = useState(false);
  const [fullName, setFullName]   = useState("");
  const [cpf, setCpf]             = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [phone, setPhone]         = useState("");
  const [country, setCountry]     = useState<Country>(COUNTRIES[0]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [notice, setNotice]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const emailRef = useRef<HTMLDivElement>(null);

  /** Código de indicação vindo só da URL (`/cadastrar?ref=...`) — enviado no body, sem campo no formulário. */
  const referralFromUrl = useMemo(() => {
    const ref = searchParams.get("ref");
    if (!ref?.trim()) return null;
    const norm = ref.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    return norm.length > 0 ? norm : null;
  }, [searchParams]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) setSuggestions([]);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function handleCountryChange(c: Country) {
    setCountry(c);
    setPhone(""); // reseta o campo ao mudar país
  }

  function handleEmailChange(v: string) {
    setEmail(v);
    const atIdx = v.indexOf("@");
    if (atIdx === -1) { setSuggestions([]); return; }
    const afterAt = v.slice(atIdx + 1).toLowerCase();
    setSuggestions(EMAIL_DOMAINS.filter((d) => afterAt === "" || d.startsWith(afterAt)));
  }

  function applySuggestion(domain: string) {
    const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
    setEmail(`${local}@${domain}`);
    setSuggestions([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Confirme que tem mais de 18 anos e aceite os termos.");
      return;
    }
    const nameTrim = fullName.trim();
    if (nameTrim.length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    const phoneFull = digits.length > 0 ? `${country.code}${digits}` : null;

    setLoading(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrim,
          email: email.trim(),
          cpf,
          password,
          phone: phoneFull,
          referralCode: referralFromUrl,
          acceptTerms: true,
        }),
      });
      const data = (await r.json()) as {
        error?: string;
        user?: AuthUser;
        referralWarning?: string;
      };
      if (!r.ok) {
        setError(data.error ?? "Não foi possível criar a conta.");
        return;
      }
      if (data.user) {
        applySessionUser(data.user);
      } else {
        await refresh();
      }
      if (data.referralWarning) {
        setNotice(data.referralWarning);
        await new Promise((resolve) => setTimeout(resolve, 2200));
      }
      router.replace("/boloes");
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "32px 24px 28px" }}>

      {/* ── Headline ── */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ fontSize: 18, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.2 }}>AQUI TEM</p>
        <p style={{ fontSize: 46, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.0, background: "linear-gradient(90deg, #D4AF37 0%, #FFE085 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>CASHBACK</p>
        <p style={{ fontSize: 15, fontWeight: 900, color: "white", textTransform: "uppercase", marginTop: 2 }}>DE ATÉ 25% TODOS OS DIAS</p>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#FCA5A5",
            background: "rgba(127,29,29,0.25)",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#FDE68A",
            background: "rgba(120, 53, 15, 0.35)",
            border: "1px solid rgba(252, 211, 77, 0.35)",
          }}
        >
          {notice}
        </p>
      )}

      {/* ── Form ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Nome */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
            Nome completo
          </label>
          <input
            className="auth-input"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Como no documento"
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* CPF */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>CPF</label>
          <input className="auth-input" type="text" inputMode="numeric" placeholder="123.456.789-00"
            value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} />
        </div>

        {/* E-mail */}
        <div ref={emailRef} style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>E-mail</label>
          <input className="auth-input" type="email" placeholder="exemplo@email.com" autoComplete="off"
            value={email} onChange={(e) => handleEmailChange(e.target.value)} />
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, borderRadius: 10, overflow: "hidden", background: "#0D1E30", border: "1px solid rgba(218,182,130,0.25)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              {suggestions.map((domain) => {
                const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
                return (
                  <button key={domain} type="button"
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(domain); }}
                    style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(218,182,130,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{local}</span>
                    <span style={{ color: "#DAB682", fontWeight: 700 }}>@{domain}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Telefone */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>Telefone</label>
          <div style={{ display: "flex", gap: 8 }}>
            <CountrySelector selected={country} onChange={handleCountryChange} />
            <input className="auth-input" type="tel" placeholder={country.code === "+55" ? "(11) 99999-9999" : "Telefone"}
              value={phone} onChange={(e) => setPhone(maskPhone(e.target.value, country.code))}
              style={{ flex: 1, width: "auto" }} />
          </div>
        </div>

        {/* Senha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>Senha</label>
          <div style={{ position: "relative" }}>
            <input className="auth-input" type={showPw ? "text" : "password"} placeholder="••••••••"
              style={{ paddingRight: 46 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", padding: 0 }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Checkbox */}
        <div onClick={() => setAccepted(!accepted)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1, border: accepted ? "2px solid #D4AF37" : "2px solid rgba(255,255,255,0.2)", background: accepted ? "rgba(255,175,47,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {accepted && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>
            Confirmo que tenho mais de 18 anos e aceito os{" "}
            <Link href="/termos" style={{ color: "#DAB682", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>Termos e Condições</Link>{" "}e a{" "}
            <Link href="/privacidade" style={{ color: "#DAB682", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>Política de Privacidade</Link>.
          </p>
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", height: 56, borderRadius: 8, border: "none",
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1,
            background: "linear-gradient(90deg, #D4AF37 0%, #FFD96A 100%)", color: "#0E141B", fontSize: 16, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4,
          }}
        >
          {loading ? "CRIANDO…" : "CRIAR CONTA"}
        </button>
      </div>

      <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
        JÁ POSSUI CONTA?{" "}
        <Link href="/login" style={{ color: "#DAB682", fontWeight: 900, textDecoration: "none", letterSpacing: "0.03em" }}>CLIQUE AQUI</Link>
      </p>
    </form>
  );
}
