"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, type AuthUser } from "@/app/shared/AuthContext";
import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, FileText, Lock, Mail, Phone, Search, User } from "lucide-react";
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
          height: 44, padding: "0 12px", borderRadius: 9,
          background: "#050505",
          border: open ? "1px solid rgba(177,235,11,0.55)" : "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600,
          whiteSpace: "nowrap", transition: "border-color 0.15s", boxSizing: "border-box",
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
          background: "#0A0A0A", border: "1px solid rgba(177,235,11,0.22)",
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
                    background: sel ? "rgba(177,235,11,0.1)" : "none", border: "none",
                    display: "flex", alignItems: "center", gap: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "none"; }}
                >
                  <Flag iso={c.iso} />
                  <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "#D7FF59", fontWeight: 700 }}>{c.code}</span>
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
  const [step, setStep]           = useState(1);
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

  function handleGoogleSignup() {
    window.location.href = referralFromUrl
      ? `/api/auth/google?ref=${encodeURIComponent(referralFromUrl)}`
      : "/api/auth/google";
  }

  function goToNextStep() {
    setError(null);
    if (step === 1) {
      if (fullName.trim().length < 2) {
        setError("Informe seu nome completo.");
        return;
      }
      if (!email.trim()) {
        setError("Informe seu e-mail.");
        return;
      }
    }
    if (step === 2 && cpf.replace(/\D/g, "").length !== 11) {
      setError("Informe um CPF válido.");
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
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
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      setStep(1);
      return;
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      setError("Informe um CPF válido.");
      setStep(2);
      return;
    }
    if (password.length < 8) {
      setError("Crie uma senha com pelo menos 8 caracteres.");
      setStep(3);
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
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full py-8 lg:py-0">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/35 transition-colors hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" />
          Ir para login
        </Link>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span
                className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-full border text-[11px] font-black ${
                  step === item
                    ? "border-primary bg-primary/20 text-primary shadow-[0_0_18px_rgba(177,235,11,0.22)]"
                    : step > item
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-white/10 bg-white/3 text-white/22"
                }`}
              >
                {step > item ? <Check className="h-3.5 w-3.5" /> : item}
              </span>
              {item < 3 && <span className="h-px w-5 bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[18px]">
        <h1 className="text-[28px] font-black leading-none tracking-[-0.035em] text-white">
          {step === 1 ? "Crie sua conta" : step === 2 ? "Complete seus dados" : "Finalize o cadastro"}
        </h1>
        <p className="mt-3 text-[13px] font-medium text-white/34">
          {step === 1 ? "Preencha seus dados básicos para começar" : step === 2 ? "Precisamos desses dados para validar sua conta" : "Crie sua senha e aceite os termos para jogar"}
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[8px] border border-red-400/25 bg-red-950/25 px-3.5 py-3 text-[13px] font-semibold text-red-200">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mb-4 rounded-[8px] border border-yellow-300/30 bg-yellow-950/30 px-3.5 py-3 text-[13px] font-semibold text-yellow-100">
          {notice}
        </p>
      )}

      <div className="min-h-[206px] rounded-[16px] border border-white/8 bg-[#151515] p-[22px] shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
        {step === 1 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-[10px]">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Nome completo</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
                <input
                  className="auth-input"
                  style={{ paddingLeft: 46 }}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="João Silva"
                  minLength={2}
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div ref={emailRef} className="relative flex flex-col gap-[10px]">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">E-mail</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
                <input
                  className="auth-input"
                  style={{ paddingLeft: 46 }}
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  disabled={loading}
                />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border border-primary/20 bg-[#0A0A0A] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                  {suggestions.map((domain) => {
                    const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
                    return (
                      <button
                        key={domain}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); applySuggestion(domain); }}
                        className="flex w-full items-center gap-1 border-b border-white/5 px-4 py-3 text-left text-[13px] transition-colors hover:bg-primary/8"
                      >
                        <span className="text-white/40">{local}</span>
                        <span className="font-bold text-[#D7FF59]">@{domain}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/7" />
              <span className="text-[10px] font-semibold uppercase text-white/18">ou</span>
              <div className="h-px flex-1 bg-white/7" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignup}
              className="flex h-[40px] w-full items-center justify-center gap-3 rounded-[9px] border border-white/8 bg-white/4.5 text-[12px] font-bold text-white/68 transition-colors hover:bg-white/7 disabled:cursor-wait"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Cadastrar com Google
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-[10px]">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">CPF</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
                <input
                  className="auth-input"
                  style={{ paddingLeft: 46 }}
                  type="text"
                  inputMode="numeric"
                  placeholder="123.456.789-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-[10px]">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Telefone</label>
              <div className="flex w-full gap-2">
                <CountrySelector selected={country} onChange={handleCountryChange} />
                <div className="relative min-w-0 flex-1">
                  <Phone className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
                  <input
                    className="auth-input"
                    style={{ paddingLeft: 46 }}
                    type="tel"
                    placeholder={country.code === "+55" ? "(11) 99999-9999" : "Telefone"}
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value, country.code))}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-[10px]">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
                <input
                  className="auth-input"
                  style={{ paddingLeft: 46, paddingRight: 46 }}
                  type={showPw ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-[15px] top-1/2 flex -translate-y-1/2 text-white/36 transition-colors hover:text-white/65"
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAccepted(!accepted)}
              className="flex items-start gap-3 rounded-[10px] border border-white/8 bg-white/3.5 px-3.5 py-3 text-left transition-colors hover:bg-white/5.5"
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${accepted ? "border-primary bg-primary/15" : "border-white/20 bg-transparent"}`}>
                {accepted && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />}
              </span>
              <span className="text-[12px] font-medium leading-relaxed text-white/45">
                Confirmo que tenho mais de 18 anos e aceito os{" "}
                <Link href="/termos" className="font-bold text-[#D7FF59] underline" onClick={(e) => e.stopPropagation()}>Termos e Condições</Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="font-bold text-[#D7FF59] underline" onClick={(e) => e.stopPropagation()}>Política de Privacidade</Link>.
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-[14px] flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => { setError(null); setStep((current) => current - 1); }}
            disabled={loading}
            className="flex h-[48px] w-[76px] items-center justify-center rounded-[10px] border border-white/8 bg-white/4 text-white/58 transition-colors hover:bg-white/7 disabled:opacity-60"
            aria-label="Voltar etapa"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={goToNextStep}
            disabled={loading}
            className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary text-[13px] font-black text-[#0E141B] shadow-[0_0_24px_rgba(177,235,11,0.42)] transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-75"
          >
            Continuar para o próximo passo
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary text-[13px] font-black text-[#0E141B] shadow-[0_0_24px_rgba(177,235,11,0.42)] transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-75"
          >
            {loading ? "Criando..." : "Criar conta"}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <p className="mt-[18px] text-center text-[12px] font-medium text-white/25">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-black text-primary hover:underline">Entrar agora</Link>
      </p>
    </form>
  );
}
