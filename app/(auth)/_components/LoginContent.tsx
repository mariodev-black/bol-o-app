"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useAuth } from "@/app/shared/AuthContext";
import {
  AuthField,
  AuthLegalFooter,
  AuthPasswordField,
  AuthPrimaryButton,
  GoogleAuthButton,
  formatLoginIdentifierInput,
  loginInputLooksLikeEmail,
} from "@/app/(auth)/_components/auth-form-ui";
import {
  getLoginIdentifierHint,
  getLoginIdentifierPlaceholder,
  isLoginIdentifierReady,
  resolveLoginIdentifier,
} from "@/lib/auth/login-identifier";
import {
  normalizePendingReferralInput,
  readPendingReferralCode,
} from "@/lib/referrals/pending-referral-client";

const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Login com Google cancelado.",
  google_invalid: "Resposta inválida do Google. Tente novamente.",
  google_state: "Sessão de login expirada. Tente de novo.",
  google_token: "Não foi possível validar o Google. Tente novamente.",
  google_profile: "Não foi possível obter seu perfil do Google.",
  google_conflict: "Esta conta Google já está vinculada a outro usuário.",
  google_email_linked: "Este e-mail já está vinculado a outra conta Google.",
  google_server: "Erro no servidor ao concluir o login. Tente mais tarde.",
};

const ACCOUNT_MSG: Record<string, string> = {
  senha_alterada: "Senha alterada com sucesso. Entre novamente com a nova senha.",
};

export function LoginContent() {
  const [showPw, setShowPw] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const toast = useBolaoToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loginWithPassword, refresh, isLoggedIn, ready } = useAuth();
  const fromParam = useMemo(() => searchParams.get("from"), [searchParams]);
  const errorParam = useMemo(() => searchParams.get("error"), [searchParams]);
  const msgParam = useMemo(() => searchParams.get("msg"), [searchParams]);
  const refFromUrl = useMemo(
    () => normalizePendingReferralInput(searchParams.get("ref")),
    [searchParams],
  );
  const [storedReferral, setStoredReferral] = useState<string | null>(null);

  useEffect(() => {
    setStoredReferral(readPendingReferralCode());
  }, []);

  const referralCodeResolved = refFromUrl ?? storedReferral;
  const looksLikeEmail = loginInputLooksLikeEmail(identifier);
  const identifierReady = isLoginIdentifierReady(identifier);
  const identifierHint = getLoginIdentifierHint(identifier);
  const identifierPlaceholder = getLoginIdentifierPlaceholder(identifier);
  const showIdentifierError = submitAttempted && !identifierReady && identifier.trim().length > 0;
  const canSubmit = identifierReady && password.trim().length > 0 && !loading;

  function safeReturnPath(from: string | null): string | null {
    if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
    if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
    return from;
  }

  function navigateToAfterAuth(next: string) {
    if (pathname === next) {
      router.back();
      return;
    }
    router.replace(next);
  }

  useEffect(() => {
    if (!errorParam) return;
    toast.error(GOOGLE_ERRORS[errorParam] ?? "Não foi possível entrar com o Google.");
  }, [errorParam, toast]);

  useEffect(() => {
    if (!msgParam) return;
    const t = ACCOUNT_MSG[msgParam];
    if (t) toast.success(t);
  }, [msgParam, toast]);

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    const next = safeReturnPath(fromParam) ?? "/";
    navigateToAfterAuth(next);
  }, [ready, isLoggedIn, fromParam, pathname, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) {
      toast.error(
        identifierHint ??
          (looksLikeEmail
            ? "Informe um e-mail válido."
            : "Informe um CPF válido com 11 dígitos."),
      );
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithPassword(resolveLoginIdentifier(identifier), password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await refresh();
      const next = safeReturnPath(fromParam) ?? "/";
      navigateToAfterAuth(next);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    const params = new URLSearchParams();
    if (referralCodeResolved) params.set("ref", referralCodeResolved);
    if (fromParam) params.set("from", fromParam);
    const q = params.toString();
    window.location.href = q ? `/api/auth/google?${q}` : "/api/auth/google";
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="mb-5">
        <h1 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-white">
          Entrar na sua conta
        </h1>
        <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/50">
          Use seu e-mail ou CPF e a senha cadastrados.
        </p>
      </div>

      <AuthField
        id="login-identifier"
        label="E-mail ou CPF"
        type="text"
        inputMode={looksLikeEmail ? "email" : "numeric"}
        autoComplete="username"
        placeholder={identifierPlaceholder}
        value={identifier}
        onChange={(e) => setIdentifier(formatLoginIdentifierInput(e.target.value))}
        disabled={loading}
        success={identifierReady}
        error={showIdentifierError}
        hint={identifierHint ?? undefined}
      />

      <div className="mt-4">
        <AuthPasswordField
          label="Senha"
          placeholder="Digite sua senha"
          value={password}
          onChange={setPassword}
          show={showPw}
          onToggleShow={() => setShowPw((v) => !v)}
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      <Link
        href="/recuperar-senha"
        className="mt-2 block text-right text-[12px] font-semibold text-white/55 hover:text-[#B1EB0B]"
      >
        Esqueceu sua senha?
      </Link>

      <div className="mt-6">
        <AuthPrimaryButton type="submit" disabled={!canSubmit}>
          {loading ? "Entrando..." : "Entrar"}
        </AuthPrimaryButton>
      </div>

      <div className="hidden lg:block">
        <GoogleAuthButton
          label="Continuar com o Google"
          disabled={loading}
          onClick={handleGoogle}
        />
      </div>

      <AuthLegalFooter />
    </form>
  );
}
