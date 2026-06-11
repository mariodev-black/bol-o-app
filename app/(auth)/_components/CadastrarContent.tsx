"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useAuth, type AuthUser } from "@/app/shared/AuthContext";
import { isValidCpf } from "@/lib/auth/cpf";
import { NICKNAME_MAX_LENGTH } from "@/lib/user/nickname";
import {
  getBrazilPhoneValidationMessage,
  isValidBrazilNationalDigits,
} from "@/lib/auth/phone";
import {
  clearPendingReferral,
  normalizePendingReferralInput,
  readPendingReferralCode,
} from "@/lib/referrals/pending-referral-client";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type FormEvent,
} from "react";
import { Check } from "lucide-react";
import {
  AuthField,
  AuthLegalFooter,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthStepNav,
  AuthStepper,
  maskCPF,
} from "@/app/(auth)/_components/auth-form-ui";

const EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "uol.com.br",
  "bol.com.br",
  "ig.com.br",
];

function maskBrazilPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function isValidEmailLoose(v: string): boolean {
  const t = v.trim();
  if (t.length < 5) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function CadastrarContent({
  embedded = false,
  fromPath: fromPathProp,
  onAuthSuccess,
}: {
  embedded?: boolean;
  fromPath?: string | null;
  onAuthSuccess?: () => void;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();
  const { refresh, applySessionUser } = useAuth();

  const [showPw, setShowPw] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [cpf, setCpf] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const emailRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [step1Attempted, setStep1Attempted] = useState(false);
  const [step2Attempted, setStep2Attempted] = useState(false);

  const refFromUrl = useMemo(
    () => normalizePendingReferralInput(searchParams.get("ref")),
    [searchParams],
  );
  const [storedReferral, setStoredReferral] = useState<string | null>(null);
  useEffect(() => {
    setStoredReferral(readPendingReferralCode());
  }, []);
  const referralCodeResolved = refFromUrl ?? storedReferral;
  const fromParam = useMemo(
    () => fromPathProp ?? searchParams.get("from"),
    [fromPathProp, searchParams],
  );

  const cpfDigits = cpf.replace(/\D/g, "");
  const cpfValid = cpfDigits.length === 11 && isValidCpf(cpfDigits);
  const nameTrim = fullName.trim();
  const nameValid = nameTrim.length >= 2;

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = isValidBrazilNationalDigits(phoneDigits);
  const phoneErrorMessage = getBrazilPhoneValidationMessage(phoneDigits);
  const emailTrim = email.trim();
  const confirmEmailTrim = confirmEmail.trim();
  const emailValid = emailTrim.length > 0 && isValidEmailLoose(email);
  const emailsMatch =
    emailValid &&
    confirmEmailTrim.length > 0 &&
    emailTrim.toLowerCase() === confirmEmailTrim.toLowerCase();
  const passwordValid = password.length >= 8;

  const showNameError = step1Attempted && !nameValid;
  const showCpfError =
    step1Attempted && cpfDigits.length > 0 && !cpfValid;
  const showPhoneError =
    step2Attempted && !phoneValid
      ? phoneErrorMessage ?? "Informe um celular válido com DDD."
      : phoneDigits.length >= 8 && !phoneValid
        ? phoneErrorMessage
        : null;
  const showEmailError =
    step2Attempted && emailTrim.length > 0 && !emailValid
      ? "Digite um e-mail válido."
      : step2Attempted && !emailTrim
        ? "Informe seu e-mail."
        : null;
  const showConfirmEmailError =
    step2Attempted && confirmEmailTrim.length > 0 && !emailsMatch
      ? emailTrim.length === 0
        ? "Informe o e-mail antes de confirmar."
        : !emailValid
          ? "Corrija o e-mail acima antes de confirmar."
          : "Os e-mails informados não coincidem."
      : step2Attempted && !confirmEmailTrim
        ? "Confirme seu e-mail."
        : null;
  const showPasswordError =
    step2Attempted && password.length > 0 && !passwordValid
      ? "A senha deve ter pelo menos 8 caracteres."
      : step2Attempted && !password
        ? "Crie uma senha."
        : null;

  function handleCpfChange(raw: string) {
    setCpf(maskCPF(raw));
  }

  function safeReturnPath(from: string | null): string | null {
    if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
    if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
    return from;
  }

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

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
    setStep1Attempted(true);
    if (!nameValid || !cpfValid) return;
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step !== 2) return;

    setStep2Attempted(true);

    if (!nameValid || !cpfValid) {
      setStep1Attempted(true);
      setStep(1);
      return;
    }
    if (
      !phoneValid ||
      !emailValid ||
      !emailsMatch ||
      !passwordValid
    ) {
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrim,
          nickname: nickname.trim() || undefined,
          email: email.trim(),
          cpf: cpfDigits,
          password,
          phone: phoneDigits,
          referralCode: referralCodeResolved,
          acceptTerms: true,
        }),
      });
      const raw = await r.text();
      let data: {
        error?: string;
        user?: AuthUser;
        referralWarning?: string;
      } = {};
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
      if (embedded && onAuthSuccess) {
        onAuthSuccess();
        return;
      }
      router.replace(safeReturnPath(fromParam) ?? "/tickets");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {step > 1 ? <AuthStepper step={step} total={2} /> : null}

      {step === 1 && (
        <div key="step-1" className="auth-step-panel flex flex-col gap-4">
          <AuthField
            label="Nome completo"
            type="text"
            autoComplete="name"
            placeholder="Como está no seu documento"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={busy}
            success={nameValid && step1Attempted}
            error={showNameError}
            hint={
              showNameError
                ? nameTrim.length === 0
                  ? "Informe seu nome completo."
                  : "Nome muito curto (mínimo 2 caracteres)."
                : undefined
            }
          />

          <AuthField
            label="Nickname (opcional)"
            type="text"
            autoComplete="off"
            placeholder="Como você aparece no ranking"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={busy}
            maxLength={NICKNAME_MAX_LENGTH}
            hint="Aparece no ranking. Em branco, usamos seu nome."
          />

          <AuthField
            label="CPF"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => handleCpfChange(e.target.value)}
            disabled={busy}
            success={cpfValid}
            error={Boolean(showCpfError)}
            hint={
              showCpfError
                ? cpfDigits.length < 11
                  ? `CPF incompleto (${cpfDigits.length} de 11 dígitos).`
                  : "CPF inválido. Confira os números."
                : cpfDigits.length > 0 && cpfDigits.length < 11
                  ? `CPF: ${cpfDigits.length} de 11 dígitos.`
                  : undefined
            }
          />

          <button
            type="button"
            onClick={() => setMarketingOptIn((v) => !v)}
            className="flex items-start gap-3 text-left"
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
              Autorizo receber atualizações via e-mail e WhatsApp.
            </span>
          </button>

          <AuthPrimaryButton type="button" disabled={busy} onClick={goFromStep1}>
            Avançar
          </AuthPrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div key="step-2" className="auth-step-panel flex flex-col gap-4">
          <AuthField
            label="WhatsApp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(maskBrazilPhone(e.target.value))}
            disabled={busy}
            success={phoneValid}
            error={Boolean(showPhoneError)}
            hint={showPhoneError ?? undefined}
          />

          <div ref={emailRef} className="relative">
            <AuthField
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              disabled={busy}
              success={emailValid}
              error={Boolean(showEmailError)}
              hint={showEmailError ?? undefined}
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#B1EB0B]/25 bg-[#0A0A0A] shadow-lg">
                {suggestions.map((domain) => {
                  const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
                  return (
                    <button
                      key={domain}
                      type="button"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
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

          <AuthField
            label="Confirmar e-mail"
            type="email"
            autoComplete="email"
            placeholder="Repita seu e-mail"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={busy}
            success={emailsMatch}
            error={Boolean(showConfirmEmailError)}
            hint={showConfirmEmailError ?? undefined}
          />

          <AuthPasswordField
            label="Senha"
            value={password}
            onChange={setPassword}
            show={showPw}
            onToggleShow={() => setShowPw((v) => !v)}
            disabled={busy}
            autoComplete="new-password"
            success={passwordValid}
            error={Boolean(showPasswordError)}
            hint={showPasswordError ?? undefined}
          />

          <AuthStepNav
            onBack={() => {
              setStep(1);
              setStep2Attempted(false);
            }}
            backDisabled={busy}
          >
            <AuthPrimaryButton type="submit" disabled={busy}>
              {loading ? "Criando conta..." : "Finalizar cadastro"}
            </AuthPrimaryButton>
          </AuthStepNav>
        </div>
      )}

      <AuthLegalFooter />
    </form>
  );
}
