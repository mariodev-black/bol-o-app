"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { useBolaoToast } from "@/app/components/BolaoToast";
import {
  AuthField,
  AuthLegalFooter,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthSmsCodeInput,
  AuthStepNav,
  AuthStepper,
} from "@/app/(auth)/_components/auth-form-ui";

const RESEND_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function isValidEmail(v: string): boolean {
  const t = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && t.length <= 200;
}

export function RecuperarSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();

  const emailFromUrl = useMemo(() => {
    const raw = searchParams.get("email")?.trim() ?? "";
    return isValidEmail(raw) ? raw : "";
  }, [searchParams]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [codeLocked, setCodeLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    if (step === 3 && !codeVerified) setStep(2);
  }, [step, codeVerified]);

  const busy = sending || verifying || submitting;
  const emailValid = isValidEmail(email);
  const codeValid = code.replace(/\D/g, "").length === 6;
  const passwordValid = password.length >= 8;
  const confirmValid = confirmPassword === password && passwordValid;
  const step2Ready = codeValid && !codeLocked;
  const step3Ready = confirmValid;
  const showEmailError = submitAttempted && step === 1 && !emailValid && email.trim().length > 0;

  const stepSubtitle =
    step === 1
      ? "E-mail da conta."
      : step === 2
        ? "Código de 6 dígitos no e-mail."
        : "Nova senha.";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  function resetCodeState() {
    setCode("");
    setCodeVerified(false);
    setCodeLocked(false);
    setAttemptsRemaining(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function sendCode(): Promise<boolean> {
    if (!emailValid) {
      toast.error("Informe um e-mail válido.");
      return false;
    }
    setSending(true);
    try {
      const r = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await r.json()) as {
        error?: string;
        message?: string;
        retryAfterSeconds?: number;
        devMode?: boolean;
      };
      if (!r.ok) {
        if (data.retryAfterSeconds) setResendCooldown(data.retryAfterSeconds);
        toast.error(data.error ?? "Não foi possível enviar o código.");
        return false;
      }
      setDevMode(Boolean(data.devMode));
      setResendCooldown(RESEND_SECONDS);
      resetCodeState();
      setAttemptsRemaining(MAX_ATTEMPTS);
      toast.success(data.message ?? "Código enviado por e-mail.");
      return true;
    } catch {
      toast.error("Erro de rede. Tente novamente.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!emailValid) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    const ok = await sendCode();
    if (ok) setStep(2);
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (step !== 2) return;
    if (!codeValid) {
      toast.error("Informe o código de 6 dígitos enviado por e-mail.");
      return;
    }

    setVerifying(true);
    try {
      const r = await fetch("/api/auth/forgot-password/verify-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.replace(/\D/g, ""),
        }),
      });
      const data = (await r.json()) as {
        error?: string;
        attemptsRemaining?: number;
        locked?: boolean;
      };
      if (!r.ok) {
        if (typeof data.attemptsRemaining === "number") {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        if (data.locked) {
          setCodeLocked(true);
          setCode("");
          setCodeVerified(false);
        }
        toast.error(data.error ?? "Código inválido.");
        return;
      }
      setCodeVerified(true);
      setPassword("");
      setConfirmPassword("");
      setStep(3);
      toast.success("Código confirmado.");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || sending) return;
    const ok = await sendCode();
    if (ok && step === 3) setStep(2);
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (step !== 3 || !codeVerified) return;
    if (!passwordValid) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas informadas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.replace(/\D/g, ""),
          newPassword: password,
          confirmPassword,
        }),
      });
      const data = (await r.json()) as {
        error?: string;
        attemptsRemaining?: number;
        locked?: boolean;
      };
      if (!r.ok) {
        if (data.locked) {
          setCodeLocked(true);
          setCodeVerified(false);
          setCode("");
          setStep(2);
        }
        toast.error(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }
      router.push("/login?msg=senha_alterada");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) void handleStep1(e);
    else if (step === 2) void handleVerifyCode(e);
    else void handleReset(e);
  }

  return (
    <form onSubmit={handleFormSubmit} noValidate className="flex flex-col">
      <div className="mb-5">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-white/55 transition-colors hover:text-[#B1EB0B]"
        >
          ← Voltar ao login
        </Link>
        <h1 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-white">
          Recuperar senha
        </h1>
        <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/50">{stepSubtitle}</p>
      </div>

      {step > 1 ? <AuthStepper step={step} total={3} /> : null}

      {step === 1 ? (
        <div key="step-1" className="auth-step-panel flex flex-col gap-4">
          <AuthField
            id="recover-email"
            label="E-mail da conta"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSubmitAttempted(false);
            }}
            disabled={busy}
            success={emailValid && email.trim().length > 0}
            error={showEmailError}
            trailing={<Mail className="text-white/32" size={16} strokeWidth={2} />}
          />

          <p className="text-[12px] leading-relaxed text-white/45">
            Mesmo e-mail do cadastro. Confira a caixa de entrada e o spam.
          </p>

          <AuthPrimaryButton type="submit" disabled={!emailValid || busy}>
            {sending ? "Enviando..." : "Continuar"}
          </AuthPrimaryButton>
        </div>
      ) : null}

      {step === 2 ? (
        <div key="step-2" className="auth-step-panel">
          <div className="mb-6 text-center">
            <h2 className="text-[18px] font-bold text-white">Código no e-mail</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Código enviado para{" "}
              <span className="font-semibold text-white/85">{email.trim()}</span>
            </p>
            <p className="mt-2 text-[11px] text-white/40">Válido por 10 min.</p>
            {devMode ? (
              <p className="mt-2 text-[11px] font-medium text-[#B1EB0B]/90">
                Modo desenvolvimento: confira o código no log do servidor.
              </p>
            ) : null}
          </div>

          <AuthSmsCodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeVerified(false);
            }}
            disabled={busy || codeLocked}
            ariaLabel="Código de verificação por e-mail"
          />

          {codeLocked ? (
            <p className="mt-3 text-center text-[12px] font-medium text-red-300">
              Muitas tentativas. Solicite um novo código.
            </p>
          ) : typeof attemptsRemaining === "number" &&
            attemptsRemaining > 0 &&
            attemptsRemaining < MAX_ATTEMPTS ? (
            <p className="mt-3 text-center text-[12px] text-white/55">
              {attemptsRemaining === 1
                ? "Última tentativa restante."
                : `${attemptsRemaining} tentativas restantes.`}
            </p>
          ) : null}

          <div className="mt-5 text-center">
            <button
              type="button"
              disabled={resendCooldown > 0 || sending}
              onClick={() => void handleResend()}
              className="text-[13px] font-semibold text-[#B1EB0B] transition-opacity hover:underline disabled:cursor-not-allowed disabled:text-white/35"
            >
              {resendCooldown > 0
                ? `Reenviar código em ${formatCooldown(resendCooldown)}`
                : "Reenviar código por e-mail"}
            </button>
          </div>

          <div className="mt-6">
            <AuthStepNav
              onBack={() => {
                resetCodeState();
                setStep(1);
              }}
              backDisabled={busy}
            >
              <AuthPrimaryButton type="submit" disabled={!step2Ready || busy}>
                {verifying ? "Verificando..." : "Confirmar código"}
              </AuthPrimaryButton>
            </AuthStepNav>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div key="step-3" className="auth-step-panel flex flex-col gap-4">
          <div className="mb-2 text-center">
            <h2 className="text-[18px] font-bold text-white">Nova senha</h2>
            <p className="mt-2 text-[13px] text-white/55">Mínimo 8 caracteres.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-[16px] border border-white/8 bg-[#151515] p-[18px]">
            <AuthPasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              show={showPw}
              onToggleShow={() => setShowPw((v) => !v)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              disabled={busy}
            />
            <AuthPasswordField
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPw}
              onToggleShow={() => setShowConfirmPw((v) => !v)}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              disabled={busy}
            />
            {confirmPassword.length > 0 && password !== confirmPassword ? (
              <p className="text-center text-[12px] font-medium text-red-300">
                As senhas não coincidem.
              </p>
            ) : null}
          </div>

          <AuthStepNav
            onBack={() => {
              setCodeVerified(false);
              setPassword("");
              setConfirmPassword("");
              setStep(2);
            }}
            backDisabled={busy}
          >
            <AuthPrimaryButton type="submit" disabled={!step3Ready || busy}>
              {submitting ? "Salvando..." : "Redefinir senha"}
            </AuthPrimaryButton>
          </AuthStepNav>
        </div>
      ) : null}

      <p className="mt-5 text-center text-[14px] font-medium text-white/80">
        Lembrou sua senha?{" "}
        <Link href="/login" className="font-black text-primary hover:underline">
          Entrar agora
        </Link>
      </p>

      <AuthLegalFooter />
    </form>
  );
}
