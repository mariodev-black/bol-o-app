"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
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

export function LoginContent() {
  const [showPw, setShowPw] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loginWithPassword, refresh, isLoggedIn, ready } = useAuth();
  const fromParam = useMemo(() => searchParams.get("from"), [searchParams]);
  const errorParam = useMemo(() => searchParams.get("error"), [searchParams]);

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
    setError(GOOGLE_ERRORS[errorParam] ?? "Não foi possível entrar com o Google.");
  }, [errorParam]);

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    const next = safeReturnPath(fromParam) ?? "/boloes";
    navigateToAfterAuth(next);
  }, [ready, isLoggedIn, fromParam, pathname, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithPassword(identifier, password);
      if (!result.ok) {
        setError(result.error);
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
    <form onSubmit={handleSubmit} style={{ padding: "32px 24px 28px" }}>

      {/* ── Headline ── */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ fontSize: 20, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.2 }}>
          INDIQUE E
        </p>
        <p style={{
          fontSize: 36,
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.1,
          background: "linear-gradient(90deg, #B1EB0B 0%, #DFFF76 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          GANHE R$50,00
        </p>
        <div style={{
          display: "inline-block",
          marginTop: 10,
          padding: "5px 12px",
          borderRadius: 4,
          background: "rgba(177,235,11,0.12)",
          border: "1px solid rgba(218,182,130,0.2)",
          fontSize: 10,
          fontWeight: 700,
          color: "#D7FF59",
          letterSpacing: "0.04em",
        }}>
          RESGATE R$50,00 SEMPRE QUE INDICAR UM AMIGO
        </div>
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

      {/* ── Formulário ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* E-mail ou CPF */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
            E-mail ou CPF
          </label>
          <input
            className="auth-input"
            type="text"
            name="identifier"
            autoComplete="username"
            placeholder="exemplo@email.com ou CPF"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Senha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
            Senha
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="auth-input"
              type={showPw ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ paddingRight: 46 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: 0 }}
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", height: 56, borderRadius: 8, border: "none", cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.75 : 1,
            background: "linear-gradient(90deg, #B1EB0B 0%, #DFFF76 100%)",
            color: "#0E141B", fontSize: 16, fontWeight: 900, letterSpacing: "0.14em",
            textTransform: "uppercase", marginTop: 4,
          }}
        >
          {loading ? "ENTRANDO…" : "ENTRAR"}
        </button>

        {/* Links */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <Link href="/recuperar-senha" style={{ fontSize: 11, fontWeight: 700, color: "#D7FF59", textDecoration: "none", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            ESQUECEU A SENHA?
          </Link>
          <Link
            href={
              searchParams.get("ref")?.trim()
                ? `/cadastrar?ref=${encodeURIComponent(searchParams.get("ref")!.trim())}`
                : "/cadastrar"
            }
            style={{ fontSize: 11, fontWeight: 700, color: "#D7FF59", textDecoration: "none", letterSpacing: "0.05em", textTransform: "uppercase" }}
          >
            CRIAR CONTA
          </Link>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>ou</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      </div>

      {/* ── Google ── */}
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          const r = searchParams.get("ref")?.trim();
          window.location.href = r
            ? `/api/auth/google?ref=${encodeURIComponent(r)}`
            : "/api/auth/google";
        }}
        style={{
          width: "100%", height: 52, borderRadius: 8, cursor: loading ? "wait" : "pointer",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Entrar com Google
      </button>

      {/* ── Disclaimer ── */}
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", textAlign: "center", marginTop: 20, lineHeight: 1.7 }}>
        Ao fazer login, estou de acordo com os nossos{" "}
        <Link href="/termos" style={{ color: "#D7FF59", textDecoration: "underline" }}>Termos e Condições</Link>.
        {" "}Esteja atento aos riscos de dependência. Em caso de dúvidas, acesse a nossa{" "}
        <Link href="/jogo-responsavel" style={{ color: "#D7FF59", textDecoration: "underline" }}>Central de Jogo Responsável</Link>.
      </p>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 12, lineHeight: 1.65 }}>
        *Para ativar seu bônus, indique amigos que realizem{" "}
        <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>R$150,00 ou mais</span>
        {" "}em apostas nos jogos selecionados.
      </p>
    </form>
  );
}
