"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useBolaoToast } from "@/app/components/BolaoToast";

export function AdminLoginClient() {
  const router = useRouter();
  const toast = useBolaoToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível acessar o admin.");
        return;
      }
      router.replace("/admin/2fa");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(177,235,11,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%)]" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[430px] rounded-[24px] border border-white/8 bg-[#0B0D0F]/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
      >
        <div className="mb-7 text-center">
          <span className="mx-auto flex h-13 w-13 items-center justify-center rounded-[16px] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(177,235,11,0.14)]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-5 text-[12px] font-black uppercase tracking-[0.24em] text-primary">Painel administrativo</p>
          <h1 className="mt-3 text-[30px] font-black tracking-[-0.06em] text-white">Login Admin</h1>
          <p className="mt-2 text-[13px] font-semibold text-white/38">
            Acesso exclusivo para administradores autorizados.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">E-mail ou CPF</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="admin@bolaodomilhao.com"
            disabled={loading}
            className="h-12 w-full rounded-[13px] border border-white/10 bg-black/45 px-4 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/22 focus:border-primary/50"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">Senha</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Sua senha administrativa"
              disabled={loading}
              className="h-12 w-full rounded-[13px] border border-white/10 bg-black/45 px-4 pr-20 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/22 focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-[0.12em] text-primary/80"
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading || !identifier.trim() || !password}
          className="mt-5 h-12 w-full rounded-[13px] bg-primary text-[16px] font-black uppercase tracking-[0.12em] text-black shadow-[0_0_28px_rgba(177,235,11,0.28)] transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? "Validando..." : "Entrar no admin"}
        </button>

        <p className="mt-5 text-center text-[11px] font-semibold leading-relaxed text-white/28">
          Após a senha, será obrigatório validar o código 2FA para abrir o painel.
        </p>
      </form>
    </main>
  );
}
