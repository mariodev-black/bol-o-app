"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useAuth } from "@/app/shared/AuthContext";

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
  const toast = useBolaoToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loginWithPassword, refresh, isLoggedIn, ready } = useAuth();
  const fromParam = useMemo(() => searchParams.get("from"), [searchParams]);
  const errorParam = useMemo(() => searchParams.get("error"), [searchParams]);
  const msgParam = useMemo(() => searchParams.get("msg"), [searchParams]);
  const signupHref = useMemo(() => {
    const params = new URLSearchParams();
    const ref = searchParams.get("ref")?.trim();
    if (ref) params.set("ref", ref);
    if (fromParam) params.set("from", fromParam);
    const query = params.toString();
    return query ? `/cadastrar?${query}` : "/cadastrar";
  }, [fromParam, searchParams]);

  function safeReturnPath(from: string | null): string | null {
    if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
    if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
    return from;
  }

  function navigateToAfterAuth(next: string) {
    // Em rotas interceptadas (modal), às vezes já estamos na página de destino
    // e só precisamos fechar a camada de autenticação.
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
    const next = safeReturnPath(fromParam) ?? "/boloes";
    navigateToAfterAuth(next);
  }, [ready, isLoggedIn, fromParam, pathname, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const result = await loginWithPassword(identifier, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Garante que a sessão via cookie já está visível no backend
      // antes de navegar para rotas protegidas (evita precisar de F5).
      await refresh();
      const next = safeReturnPath(fromParam) ?? "/boloes";
      navigateToAfterAuth(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-[31px] text-center lg:mb-8 lg:text-left">
        <h1 className="text-[24px] font-black leading-none tracking-[-0.035em] text-white lg:text-[28px]">
          <span className="lg:hidden">Bem-vindo!</span>
          <span className="hidden lg:inline">Bem-vindo de volta!</span>
        </h1>
        <p className="mt-4 text-[15px] font-medium text-white/50 lg:mt-3 lg:text-[14px]">
          <span className="lg:hidden">Entre na sua conta e dispute o milhão</span>
          <span className="hidden lg:inline">Entre na sua conta para continuar jogando</span>
        </p>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-[#050505]/70 px-5 py-[27px] shadow-[0_16px_40px_rgba(0,0,0,0.28)] lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="flex flex-col gap-[17px] lg:gap-5">
        <div className="flex flex-col gap-[10px]">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/80">E-mail</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
            <input
              className="auth-input"
              style={{ paddingLeft: 46 }}
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder="seu@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/80">Senha</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
            <input
              className="auth-input"
              style={{ paddingLeft: 46, paddingRight: 46 }}
              type={showPw ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <Link href="/recuperar-senha" className="self-end text-[13px] font-bold text-primary hover:underline">
            Esqueceu a senha?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-[15px] flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] bg-primary text-[18px] font-black text-[#0E141B] shadow-[0_0_24px_rgba(177,235,11,0.45)] transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 lg:mt-2 lg:h-[51px] lg:rounded-[9px] lg:text-[13px]"
        >
          {loading ? "Entrando..." : <><span className="lg:hidden">Entrar</span><span className="hidden lg:inline">Entrar na conta</span></>}
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="my-[18px] flex items-center gap-3 lg:my-5">
        <div className="h-px flex-1 bg-white/8 lg:bg-white/6" />
        <span className="text-[12px] font-semibold uppercase text-white/20 lg:text-[10px]">ou</span>
        <div className="h-px flex-1 bg-white/8 lg:bg-white/6" />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => {
          const r = searchParams.get("ref")?.trim();
          window.location.href = r
            ? `/api/auth/google?ref=${encodeURIComponent(r)}`
            : "/api/auth/google";
        }}
        className="flex h-[48px] w-full items-center justify-center gap-3 rounded-[12px] border border-white/10 bg-white/5 text-[14px] font-semibold text-white/68 transition-colors hover:bg-white/7 disabled:cursor-wait lg:h-[46px] lg:rounded-[9px] lg:text-[13px]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Entrar com Google
      </button>
      </div>

      <p className="mt-[29px] text-center text-[14px] font-medium text-white/45 lg:mt-7 lg:text-[14px]">
        Não tem uma conta?{" "}
        <Link
          href={signupHref}
          className="font-black text-primary hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}
