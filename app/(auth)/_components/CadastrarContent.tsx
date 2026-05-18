"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useAuth, type AuthUser } from "@/app/shared/AuthContext";
import { isValidCpf } from "@/lib/auth/cpf";
import { isReasonableNationalDigits, isValidBrazilNationalDigits } from "@/lib/auth/phone";
import {
  clearPendingReferral,
  normalizePendingReferralInput,
  readPendingReferralCode,
} from "@/lib/referrals/pending-referral-client";
import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { ArrowLeft, Check, ChevronDown, Phone, Search } from "lucide-react";
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

import {
  AuthField,
  AuthLegalFooter,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthStepper,
  maskCPF,
} from "@/app/(auth)/_components/auth-form-ui";

function isValidEmailLoose(v: string): boolean {
  const t = v.trim();
  if (t.length < 5) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type GenderOption = "masculino" | "feminino" | "nao_informar";

function maskDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return `${part[0] ?? ""}*`;
      return `${part.slice(0, 2)}${"*".repeat(part.length - 2)}`;
    })
    .join(" ");
}

export function CadastrarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();
  const { refresh, applySessionUser } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [gender, setGender] = useState<GenderOption>("nao_informar");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const emailRef = useRef<HTMLDivElement>(null);

  const refFromUrl = useMemo(
    () => normalizePendingReferralInput(searchParams.get("ref")),
    [searchParams],
  );
  const [storedReferral, setStoredReferral] = useState<string | null>(null);
  useEffect(() => {
    setStoredReferral(readPendingReferralCode());
  }, []);
  const referralCodeResolved = refFromUrl ?? storedReferral;
  const fromParam = useMemo(() => searchParams.get("from"), [searchParams]);

  const cpfDigits = cpf.replace(/\D/g, "");
  const cpfValid = cpfDigits.length === 11 && isValidCpf(cpfDigits);

  function safeReturnPath(from: string | null): string | null {
    if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
    if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
    return from;
  }

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) setSuggestions([]);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function handleCountryChange(c: Country) {
    setCountry(c);
    setPhone("");
  }

  function handleEmailChange(v: string) {
    setEmail(v);
    const atIdx = v.indexOf("@");
    if (atIdx === -1) {
      setSuggestions([]);
      return;
    }
    const afterAt = v.slice(atIdx + 1).toLowerCase();
    setSuggestions(EMAIL_DOMAINS.filter((d) => afterAt === "" || d.startsWith(afterAt)));
  }

  function applySuggestion(domain: string) {
    const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
    setEmail(`${local}@${domain}`);
    setSuggestions([]);
  }

  function goFromStep1() {
    if (!accepted) {
      toast.error("Confirme que tem mais de 18 anos e aceite os termos.");
      return;
    }
    if (!cpfValid) {
      toast.error("Informe um CPF válido.");
      return;
    }
    setStep(2);
  }

  function goFromStep2() {
    const nameTrim = fullName.trim();
    if (nameTrim.length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length > 0) {
      if (country.code === "+55") {
        if (!isValidBrazilNationalDigits(phoneDigits)) {
          toast.error("Telefone inválido para o Brasil.");
          return;
        }
      } else if (!isReasonableNationalDigits(phoneDigits)) {
        toast.error("Número de telefone incompleto ou inválido.");
        return;
      }
    }
    setStep(3);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accepted) {
      toast.error("Confirme que tem mais de 18 anos e aceite os termos.");
      return;
    }
    const nameTrim = fullName.trim();
    if (nameTrim.length < 2) {
      toast.error("Informe seu nome completo.");
      setStep(2);
      return;
    }
    if (!email.trim() || !isValidEmailLoose(email)) {
      toast.error("Digite um e-mail válido.");
      return;
    }
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      toast.error("Os e-mails informados não coincidem.");
      return;
    }
    if (!cpfValid) {
      toast.error("Informe um CPF válido.");
      setStep(1);
      return;
    }
    if (password.length < 8) {
      toast.error("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    const phoneDigitsCheck = phone.replace(/\D/g, "");
    if (phoneDigitsCheck.length > 0) {
      if (country.code === "+55") {
        if (!isValidBrazilNationalDigits(phoneDigitsCheck)) {
          toast.error("Telefone inválido para o Brasil.");
          setStep(2);
          return;
        }
      } else if (!isReasonableNationalDigits(phoneDigitsCheck)) {
        toast.error("Número de telefone incompleto ou inválido.");
        setStep(2);
        return;
      }
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
          referralCode: referralCodeResolved,
          acceptTerms: true,
        }),
      });
      const raw = await r.text();
      let data: { error?: string; user?: AuthUser; referralWarning?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        toast.error("Não foi possível ler a resposta do servidor. Tente novamente.");
        return;
      }
      if (!r.ok) {
        toast.error(
          typeof data.error === "string" && data.error.trim().length > 0
            ? data.error
            : "Não foi possível criar a conta.",
        );
        return;
      }
      if (data.user) {
        applySessionUser(data.user);
      } else {
        await refresh();
      }
      if (data.referralWarning) {
        toast.info(data.referralWarning);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      clearPendingReferral();
      router.replace(safeReturnPath(fromParam) ?? "/tickets");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const step1Ready = cpfValid && accepted;
  const step3Ready =
    email.trim().length > 0 &&
    confirmEmail.trim().length > 0 &&
    password.length >= 8 &&
    !loading;

  const genderOptions: { id: GenderOption; label: string }[] = [
    { id: "masculino", label: "Masculino" },
    { id: "feminino", label: "Feminino" },
    { id: "nao_informar", label: "Prefiro não informar" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {step > 1 ? <AuthStepper step={step} total={3} /> : null}

      {step === 1 && (
        <>
          <div>
            <AuthField
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              disabled={loading}
              success={cpfValid}
            />
            {cpfValid ? (
              <p className="auth-field-success-hint">
                {fullName.trim().length >= 2
                  ? maskDisplayName(fullName)
                  : "CPF validado. Continue para completar seu cadastro."}
              </p>
            ) : null}
          </div>

          <p className="mt-5 text-[12px] leading-relaxed text-white/55">
            Ao finalizar o cadastro, certifico que eu sou maior de 18 anos de idade, li e aceito os{" "}
            <a href="/privacidade" className="font-semibold text-[#B1EB0B] hover:underline">
              Termos e Condições Gerais
            </a>
            , a{" "}
            <a href="/privacidade" className="font-semibold text-[#B1EB0B] hover:underline">
              Política de Segurança e Privacidade
            </a>{" "}
            e a declaração de{" "}
            <a href="/privacidade" className="font-semibold text-[#B1EB0B] hover:underline">
              Pessoa Exposta Politicamente (PEP)
            </a>
            .
          </p>

          <button
            type="button"
            onClick={() => setMarketingOptIn((v) => !v)}
            className="mt-4 flex items-start gap-3 text-left"
          >
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                marketingOptIn
                  ? "border-[#B1EB0B] bg-[#B1EB0B]/15"
                  : "border-white/25 bg-transparent"
              }`}
            >
              {marketingOptIn ? (
                <Check className="size-3.5 text-[#B1EB0B]" strokeWidth={3} />
              ) : null}
            </span>
            <span className="text-[13px] font-medium leading-relaxed text-white/72">
              Autorizo receber atualizações via e-mail e SMS.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAccepted((v) => !v)}
            className="mt-3 flex items-start gap-3 text-left"
          >
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                accepted
                  ? "border-[#B1EB0B] bg-[#B1EB0B]/15"
                  : "border-white/25 bg-transparent"
              }`}
            >
              {accepted ? (
                <Check className="size-3.5 text-[#B1EB0B]" strokeWidth={3} />
              ) : null}
            </span>
            <span className="text-[13px] font-medium leading-relaxed text-white/72">
              Li e aceito os termos para criar minha conta.
            </span>
          </button>

          <div className="mt-6">
            <AuthPrimaryButton
              type="button"
              disabled={!step1Ready || loading}
              onClick={goFromStep1}
            >
              Avançar
            </AuthPrimaryButton>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <AuthField
            label="Nome completo"
            type="text"
            autoComplete="name"
            placeholder="Seu nome completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />

          <div className="mt-4 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-white/45">Telefone</span>
            <div className="flex gap-2">
              <CountrySelector selected={country} onChange={handleCountryChange} />
              <AuthField
                label="Número"
                type="tel"
                autoComplete="tel"
                placeholder={country.code === "+55" ? "(11) 99999-9999" : "Telefone"}
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value, country.code))}
                disabled={loading}
                className="min-w-0 flex-1"
              />
            </div>
            <p className="text-[10px] text-white/35">Opcional.</p>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/70"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex-1">
              <AuthPrimaryButton
                type="button"
                disabled={loading || fullName.trim().length < 2}
                onClick={goFromStep2}
              >
                Avançar
              </AuthPrimaryButton>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold text-white/45">Sexo:</p>
            <div className="auth-gender-row">
              {genderOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGender(opt.id)}
                  className={`auth-gender-pill ${gender === opt.id ? "auth-gender-pill--active" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={emailRef} className="relative">
            <AuthField
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              disabled={loading}
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#B1EB0B]/25 bg-[#0A0A0A] shadow-lg">
                {suggestions.map((domain) => {
                  const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
                  return (
                    <button
                      key={domain}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(domain);
                      }}
                      className="flex w-full border-b border-white/5 px-3 py-2.5 text-left text-[13px] last:border-0 hover:bg-white/5"
                    >
                      <span className="text-white/40">{local}</span>
                      <span className="font-bold text-[#B1EB0B]">@{domain}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <AuthField
              label="Confirmar e-mail"
              type="email"
              autoComplete="email"
              placeholder="Repita seu e-mail"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="mt-4">
            <AuthPasswordField
              label="Senha"
              value={password}
              onChange={setPassword}
              show={showPw}
              onToggleShow={() => setShowPw((v) => !v)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={loading}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/70"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex-1">
              <AuthPrimaryButton type="submit" disabled={!step3Ready}>
                {loading ? "Finalizando..." : "Finalizar cadastro"}
              </AuthPrimaryButton>
            </div>
          </div>
        </>
      )}

      <AuthLegalFooter />
    </form>
  );
}
