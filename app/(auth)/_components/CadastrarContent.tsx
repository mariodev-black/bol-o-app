"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useAuth, type AuthUser } from "@/app/shared/AuthContext";
import { isValidCpf } from "@/lib/auth/cpf";
import { isValidBrazilNationalDigits } from "@/lib/auth/phone";
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
  AuthSmsCodeInput,
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

function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return d;
  const masked = maskBrazilPhone(d);
  return `+55 ${masked}`;
}

const SMS_RESEND_SECONDS = 5 * 60;
const SMS_MAX_ATTEMPTS = 5;

function formatCooldown(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return r === 0 ? `${m}m` : `${m}m ${String(r).padStart(2, "0")}s`;
}

export function CadastrarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();
  const { refresh, applySessionUser } = useAuth();

  const [showPw, setShowPw] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const emailRef = useRef<HTMLDivElement>(null);

  const [smsCode, setSmsCode] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsDevMode, setSmsDevMode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [smsAttemptsRemaining, setSmsAttemptsRemaining] = useState<number | null>(null);
  const [smsLocked, setSmsLocked] = useState(false);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

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
  const nameTrim = fullName.trim();
  const nameValid = nameTrim.length >= 2;

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = isValidBrazilNationalDigits(phoneDigits);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

  async function sendSmsCode(): Promise<boolean> {
    setSmsSending(true);
    try {
      const r = await fetch("/api/auth/register/send-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: cpfDigits,
          phone: phoneDigits,
          email: email.trim() || undefined,
          name: nameTrim,
        }),
      });
      const data = (await r.json()) as {
        error?: string;
        retryAfterSeconds?: number;
        devMode?: boolean;
      };
      if (!r.ok) {
        if (data.retryAfterSeconds) setResendCooldown(data.retryAfterSeconds);
        toast.error(data.error ?? "Não foi possível enviar o código pelo WhatsApp.");
        return false;
      }
      setSmsDevMode(Boolean(data.devMode));
      setResendCooldown(SMS_RESEND_SECONDS);
      setSmsCode("");
      setSmsAttemptsRemaining(SMS_MAX_ATTEMPTS);
      setSmsLocked(false);
      return true;
    } catch {
      toast.error("Erro de rede ao enviar o código pelo WhatsApp.");
      return false;
    } finally {
      setSmsSending(false);
    }
  }

  function goFromStep1() {
    if (!nameValid) {
      toast.error("Informe seu nome (mínimo 2 caracteres).");
      return;
    }
    if (!cpfValid) {
      toast.error("Informe um CPF válido.");
      return;
    }
    setStep(2);
  }

  async function goFromStep2() {
    if (!nameValid || !cpfValid) {
      toast.error("Revise nome e CPF.");
      setStep(1);
      return;
    }
    if (!phoneValid) {
      toast.error("Informe um celular válido com DDD.");
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
    if (password.length < 8) {
      toast.error("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }

    const sent = await sendSmsCode();
    if (sent) setStep(3);
  }

  async function handleResendSms() {
    if (resendCooldown > 0 || smsSending) return;
    await sendSmsCode();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step !== 3) return;

    if (!nameValid || !cpfValid) {
      toast.error("Revise nome e CPF.");
      setStep(1);
      return;
    }
    if (!phoneValid) {
      toast.error("Telefone inválido.");
      setStep(2);
      return;
    }
    if (smsCode.replace(/\D/g, "").length !== 6) {
      toast.error("Informe o código de 6 dígitos enviado pelo WhatsApp.");
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
          email: email.trim(),
          cpf: cpfDigits,
          password,
          phone: phoneDigits,
          smsCode: smsCode.replace(/\D/g, ""),
          referralCode: referralCodeResolved,
          acceptTerms: true,
        }),
      });
      const raw = await r.text();
      let data: {
        error?: string;
        user?: AuthUser;
        referralWarning?: string;
        attemptsRemaining?: number;
        locked?: boolean;
      } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        toast.error("Não foi possível ler a resposta do servidor. Tente novamente.");
        return;
      }
      if (!r.ok) {
        if (typeof data.attemptsRemaining === "number") {
          setSmsAttemptsRemaining(data.attemptsRemaining);
        }
        if (data.locked) {
          setSmsLocked(true);
          setSmsCode("");
        }
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

  const step1Ready = cpfValid && nameValid;
  const step2Ready =
    phoneValid &&
    email.trim().length > 0 &&
    confirmEmail.trim().length > 0 &&
    password.length >= 8 &&
    !smsSending &&
    !loading;
  const step3Ready = smsCode.replace(/\D/g, "").length === 6 && !loading && !smsLocked;
  const busy = loading || smsSending;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {step > 1 ? <AuthStepper step={step} total={3} /> : null}

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
            success={nameValid}
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
            error={cpf.length > 0 && !cpfValid && cpfDigits.length >= 11}
            hint={cpfDigits.length > 0 && cpfDigits.length < 11 ? `CPF: ${cpfDigits.length} de 11 dígitos.` : undefined}
          />

          <p className="text-[12px] leading-relaxed text-white/55">
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

          <AuthPrimaryButton type="button" disabled={!step1Ready || busy} onClick={goFromStep1}>
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

          <AuthField
            label="Confirmar e-mail"
            type="email"
            autoComplete="email"
            placeholder="Repita seu e-mail"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={busy}
          />

          <AuthPasswordField
            label="Senha"
            value={password}
            onChange={setPassword}
            show={showPw}
            onToggleShow={() => setShowPw((v) => !v)}
            disabled={busy}
            autoComplete="new-password"
          />

          <AuthStepNav onBack={() => setStep(1)} backDisabled={busy}>
            <AuthPrimaryButton
              type="button"
              disabled={!step2Ready}
              onClick={() => void goFromStep2()}
            >
              {smsSending ? "Enviando WhatsApp..." : "Finalizar cadastro"}
            </AuthPrimaryButton>
          </AuthStepNav>
        </div>
      )}

      {step === 3 && (
        <div key="step-3" className="auth-step-panel">
          <div className="mb-6 text-center">
            <h2 className="text-[18px] font-bold text-white">Confirme seu WhatsApp</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Enviamos um código de 6 dígitos pelo WhatsApp para{" "}
              <span className="font-semibold text-white/85">{formatPhoneDisplay(phoneDigits)}</span>
              .
            </p>
            {smsDevMode ? (
              <p className="mt-2 text-[11px] font-medium text-[#B1EB0B]/90">
                Modo desenvolvimento: confira o código no log do servidor.
              </p>
            ) : null}
          </div>

          <AuthSmsCodeInput
            value={smsCode}
            onChange={setSmsCode}
            disabled={busy || smsLocked}
            ariaLabel="Código de verificação por WhatsApp"
          />

          {smsLocked ? (
            <p className="mt-3 text-center text-[12px] font-medium text-red-300">
              Código bloqueado após várias tentativas. Solicite um novo código pelo WhatsApp.
            </p>
          ) : typeof smsAttemptsRemaining === "number" &&
            smsAttemptsRemaining > 0 &&
            smsAttemptsRemaining < SMS_MAX_ATTEMPTS ? (
            <p className="mt-3 text-center text-[12px] text-white/55">
              {smsAttemptsRemaining === 1
                ? "Última tentativa restante."
                : `${smsAttemptsRemaining} tentativas restantes.`}
            </p>
          ) : null}

          <div className="mt-5 text-center">
            <button
              type="button"
              disabled={resendCooldown > 0 || smsSending}
              onClick={() => void handleResendSms()}
              className="text-[13px] font-semibold text-[#B1EB0B] transition-opacity hover:underline disabled:cursor-not-allowed disabled:text-white/35"
            >
              {resendCooldown > 0
                ? `Reenviar código em ${formatCooldown(resendCooldown)}`
                : "Reenviar código pelo WhatsApp"}
            </button>
          </div>

          <AuthStepNav
            onBack={() => {
              setSmsCode("");
              setStep(2);
            }}
            backDisabled={busy}
          >
            <AuthPrimaryButton type="submit" disabled={!step3Ready}>
              {loading ? "Confirmando..." : "Confirmar conta"}
            </AuthPrimaryButton>
          </AuthStepNav>
        </div>
      )}

      <AuthLegalFooter />
    </form>
  );
}
