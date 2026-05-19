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
  useCallback,
  type FormEvent,
} from "react";
import { Check } from "lucide-react";
import {
  AuthCpfVerifiedBanner,
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

type CpfLookupStatus = "idle" | "loading" | "verified" | "error";

const CPF_VERIFIED_STORAGE_KEY = "bm_cadastro_cpf_verified";
const SMS_RESEND_SECONDS = 60;

export function CadastrarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();
  const { refresh, applySessionUser } = useAuth();

  const [showPw, setShowPw] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [cpf, setCpf] = useState("");
  const [cpfLookupStatus, setCpfLookupStatus] = useState<CpfLookupStatus>("idle");
  const [cpfMaskedName, setCpfMaskedName] = useState<string | null>(null);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const [verifiedCpfDigits, setVerifiedCpfDigits] = useState<string | null>(null);
  const cpfLookupAbortRef = useRef<AbortController | null>(null);
  const cpfLookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cpfAwaitingLookup, setCpfAwaitingLookup] = useState(false);

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
  const cpfVerified =
    cpfLookupStatus === "verified" &&
    verifiedCpfDigits === cpfDigits &&
    Boolean(cpfMaskedName);

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = isValidBrazilNationalDigits(phoneDigits);

  const resetCpfLookup = useCallback(() => {
    cpfLookupAbortRef.current?.abort();
    cpfLookupAbortRef.current = null;
    setCpfAwaitingLookup(false);
    setCpfLookupStatus("idle");
    setCpfMaskedName(null);
    setCpfLookupError(null);
    setVerifiedCpfDigits(null);
    try {
      sessionStorage.removeItem(CPF_VERIFIED_STORAGE_KEY);
    } catch {
      /* modo privado */
    }
  }, []);

  const runCpfLookup = useCallback(async (digits: string) => {
    cpfLookupAbortRef.current?.abort();
    const controller = new AbortController();
    cpfLookupAbortRef.current = controller;
    setCpfAwaitingLookup(false);
    setCpfLookupStatus("loading");
    setCpfLookupError(null);
    setCpfMaskedName(null);
    setVerifiedCpfDigits(null);

    try {
      const r = await fetch("/api/auth/cpf-lookup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: digits }),
        signal: controller.signal,
      });
      const data = (await r.json()) as {
        error?: string;
        maskedName?: string;
        verified?: boolean;
      };

      if (controller.signal.aborted) return;

      if (!r.ok || !data.verified || !data.maskedName) {
        setCpfLookupStatus("error");
        setCpfLookupError(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Não foi possível validar este CPF.",
        );
        return;
      }

      setCpfMaskedName(data.maskedName);
      setVerifiedCpfDigits(digits);
      setCpfLookupStatus("verified");
      try {
        sessionStorage.setItem(CPF_VERIFIED_STORAGE_KEY, digits);
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setCpfLookupStatus("error");
      setCpfLookupError(
        err instanceof Error && err.name === "AbortError"
          ? null
          : "Falha na conexão. Verifique a internet e tente novamente.",
      );
    } finally {
      if (cpfLookupAbortRef.current === controller) {
        cpfLookupAbortRef.current = null;
      }
    }
  }, []);

  function handleCpfChange(raw: string) {
    const masked = maskCPF(raw);
    const nextDigits = masked.replace(/\D/g, "");
    setCpf((prev) => {
      const prevDigits = prev.replace(/\D/g, "");
      if (prevDigits !== nextDigits) resetCpfLookup();
      return masked;
    });
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
    if (step < 2 || cpfVerified) return;
    setStep(1);
    toast.error("Valide seu CPF antes de continuar o cadastro.");
  }, [step, cpfVerified, toast]);

  useEffect(() => {
    if (cpfLookupDebounceRef.current) {
      clearTimeout(cpfLookupDebounceRef.current);
      cpfLookupDebounceRef.current = null;
    }

    if (!cpfValid) {
      if (cpfDigits.length < 11) resetCpfLookup();
      return;
    }

    if (verifiedCpfDigits === cpfDigits) {
      setCpfAwaitingLookup(false);
      return;
    }

    setCpfAwaitingLookup(true);
    cpfLookupDebounceRef.current = setTimeout(() => {
      cpfLookupDebounceRef.current = null;
      void runCpfLookup(cpfDigits);
    }, 500);

    return () => {
      if (cpfLookupDebounceRef.current) {
        clearTimeout(cpfLookupDebounceRef.current);
        cpfLookupDebounceRef.current = null;
      }
    };
  }, [cpfDigits, cpfValid, verifiedCpfDigits, runCpfLookup, resetCpfLookup]);

  useEffect(() => {
    if (!cpfValid) return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(CPF_VERIFIED_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === cpfDigits && !cpfVerified) {
      void runCpfLookup(cpfDigits);
    }
  }, [cpfDigits, cpfValid, cpfVerified, runCpfLookup]);

  useEffect(() => {
    return () => {
      cpfLookupAbortRef.current?.abort();
      if (cpfLookupDebounceRef.current) clearTimeout(cpfLookupDebounceRef.current);
    };
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
          // Só repassamos o email (já validado no step 2).
          // O NOME REAL é resolvido server-side via CPF (LGPD) — o cliente
          // nunca recebe nome completo, apenas o `maskedName` para UI.
          email: email.trim() || undefined,
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
      return true;
    } catch {
      toast.error("Erro de rede ao enviar o código pelo WhatsApp.");
      return false;
    } finally {
      setSmsSending(false);
    }
  }

  function goFromStep1() {
    if (!cpfValid) {
      toast.error("Informe um CPF válido.");
      return;
    }
    if (cpfLookupStatus === "loading" || cpfAwaitingLookup) {
      toast.error("Aguarde a validação do CPF.");
      return;
    }
    if (!cpfVerified) {
      toast.error(cpfLookupError ?? "Valide o CPF para continuar.");
      void runCpfLookup(cpfDigits);
      return;
    }
    setStep(2);
  }

  async function goFromStep2() {
    if (!cpfVerified) {
      toast.error("Valide seu CPF novamente.");
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

    if (!cpfVerified) {
      toast.error("Valide seu CPF antes de finalizar.");
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
          email: email.trim(),
          cpf,
          password,
          phone: phoneDigits,
          smsCode: smsCode.replace(/\D/g, ""),
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
      try {
        sessionStorage.removeItem(CPF_VERIFIED_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      router.replace(safeReturnPath(fromParam) ?? "/tickets");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const showCpfLoading =
    cpfLookupStatus === "loading" || (cpfAwaitingLookup && cpfValid && !cpfVerified);

  const step1Ready = cpfVerified && !showCpfLoading;

  const step2Ready =
    phoneValid &&
    email.trim().length > 0 &&
    confirmEmail.trim().length > 0 &&
    password.length >= 8 &&
    !smsSending &&
    !loading;

  const step3Ready = smsCode.replace(/\D/g, "").length === 6 && !loading;

  const busy = loading || smsSending;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {step > 1 ? <AuthStepper step={step} total={3} /> : null}

      {step === 1 && (
        <div key="step-1" className="auth-step-panel">
          <div className="auth-cpf-field-wrap">
            <AuthField
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => handleCpfChange(e.target.value)}
              disabled={busy}
              loading={showCpfLoading}
              success={cpfVerified}
              error={cpfLookupStatus === "error"}
            />
            {cpfVerified && cpfMaskedName ? (
              <AuthCpfVerifiedBanner name={cpfMaskedName} />
            ) : null}
          </div>

          {cpfLookupStatus === "error" && cpfLookupError ? (
            <p className="mt-2 text-[12px] font-medium text-red-300/95">{cpfLookupError}</p>
          ) : null}

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
              Autorizo receber atualizações via e-mail e WhatsApp.
            </span>
          </button>

          <div className="mt-6">
            <AuthPrimaryButton type="button" disabled={!step1Ready || busy} onClick={goFromStep1}>
              Avançar
            </AuthPrimaryButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="step-2" className="auth-step-panel flex flex-col gap-4">
          <AuthField
            label="Telefone"
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
            </p>
            {smsDevMode ? (
              <p className="mt-2 text-[11px] font-medium text-[#B1EB0B]/90">
                Modo desenvolvimento: confira o código no log do servidor.
              </p>
            ) : null}
          </div>

          <AuthSmsCodeInput value={smsCode} onChange={setSmsCode} disabled={busy} />

          <div className="mt-5 text-center">
            <button
              type="button"
              disabled={resendCooldown > 0 || smsSending}
              onClick={() => void handleResendSms()}
              className="text-[13px] font-semibold text-[#B1EB0B] transition-opacity hover:underline disabled:cursor-not-allowed disabled:text-white/35"
            >
              {resendCooldown > 0
                ? `Reenviar código em ${resendCooldown}s`
                : "Reenviar código"}
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
