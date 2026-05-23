"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import { isValidCpf } from "@/lib/auth/cpf";
import { isValidBrazilNationalDigits } from "@/lib/auth/phone";

function maskCPF(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhoneBR(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function validatePhoneBRDigits(d: string): boolean {
  if (d.length < 10 || d.length > 11) return false;
  return isValidBrazilNationalDigits(d);
}
/**
 * Bloqueia a navegação até quem entrou com Google informar CPF (e telefone opcional).
 */
export function ProfileCompletionHost({ children }: { children: React.ReactNode }) {
  const toast = useBolaoToast();
  const isAdminRoute = useIsAdminAppRoute();
  const { ready, user, applySessionUser, logout } = useAuth();
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const needsGate = Boolean(ready && user && user.profileComplete === false && !isAdminRoute);
  /** Nome já vindo do Google: campo só editável se estiver vazio. */
  const nameFieldDisabled = Boolean(user && (user.name?.trim().length ?? 0) >= 2);

  useEffect(() => {
    if (!needsGate || !user) return;
    setFullName((prev) => {
      const dn = user.name?.trim() ?? "";
      if (prev.trim().length >= 2) return prev;
      return dn.length >= 2 ? dn : prev;
    });
  }, [needsGate, user?.id, user?.name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11 || !isValidCpf(cpfDigits)) {
      toast.error("Informe um CPF válido (11 dígitos).");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length > 0) {
      if (!validatePhoneBRDigits(phoneDigits)) {
        toast.error("Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
        return;
      }
    }
    const nameTrim = fullName.trim().length >= 2 ? fullName.trim() : (user.name?.trim() ?? "");
    if (nameTrim.length < 2) {
      toast.error("Informe seu nome completo (mínimo 2 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const body: { cpf: string; phone?: string | null; fullName: string } = {
        cpf: cpfDigits,
        fullName: nameTrim,
      };
      if (phoneDigits.length > 0) {
        body.phone = `+55${phoneDigits}`;
      }
      const r = await fetch("/api/user/complete-google-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string; user?: typeof user };
      if (!r.ok) {
        toast.error(data.error ?? "Não foi possível salvar.");
        return;
      }
      if (data.user) {
        applySessionUser(data.user);
        toast.success("Cadastro concluído!");
        setCpf("");
        setPhone("");
        setFullName("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {children}
      {needsGate && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-profile-title"
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-white/10 p-6 shadow-2xl"
            style={{ background: "linear-gradient(165deg, #121212 0%, #0a0a0a 100%)" }}
          >
            <h2 id="complete-profile-title" className="text-lg font-black text-white">
              Complete seu cadastro
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Para continuar usando o Bolão com login Google, precisamos do seu{" "}
              <span className="font-semibold text-white/80">CPF</span> (obrigatório). O telefone é opcional.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-black uppercase tracking-widest text-white/50">
                  Nome completo
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={nameFieldDisabled}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none ring-primary/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Seu nome"
                  required={!nameFieldDisabled}
                  minLength={2}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-black uppercase tracking-widest text-white/50">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none ring-primary/30 focus:ring-2"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-black uppercase tracking-widest text-white/50">
                  Celular (opcional)
                </label>
                <div className="flex gap-2">
                  <span className="flex h-11 shrink-0 items-center rounded-lg border border-white/10 bg-black/50 px-3 text-sm font-semibold text-white/70">
                    +55
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none ring-primary/30 focus:ring-2"
                    placeholder="(11) 98765-4321"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-black text-black transition-opacity hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Salvar e continuar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void (async () => {
                    await logout();
                    window.location.href = "/login";
                  })();
                }}
                className="text-center text-[12px] font-medium text-white/80 underline-offset-2 hover:text-white/50 hover:underline"
              >
                Sair e usar outra conta
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
