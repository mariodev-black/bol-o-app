"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { ShieldCheck } from "lucide-react";

export function TwoFactorClient({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (enabled) return;
    void (async () => {
      const res = await fetch("/api/admin/2fa/setup", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { secret?: string; otpauthUrl?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nao foi possivel iniciar o 2FA.");
        return;
      }
      setSecret(data.secret ?? "");
      setOtpauthUrl(data.otpauthUrl ?? "");
    })();
  }, [enabled]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Codigo invalido.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[440px] rounded-[22px] border border-white/8 bg-[#101010] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-primary/25 bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.04em] text-white">Verificação 2FA</h1>
          <p className="mt-1 text-[12px] font-semibold text-white/35">
            {enabled ? "Confirme seu código para acessar o admin." : "Configure antes do primeiro acesso admin."}
          </p>
        </div>
      </div>

      {otpauthUrl && (
        <div className="mb-5 rounded-[16px] border border-white/8 bg-black p-4">
          <div className="mx-auto w-fit rounded-xl bg-white p-3">
            <QRCode value={otpauthUrl} size={176} />
          </div>
          <p className="mt-4 break-all text-center font-mono text-[12px] text-white/45">{secret}</p>
        </div>
      )}

      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Código do app autenticador</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        className="mt-2 h-12 w-full rounded-[12px] border border-white/10 bg-black px-4 text-center font-mono text-[22px] font-black tracking-[0.35em] text-white outline-none transition focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(177,235,11,0.08)]"
      />
      {error && <p className="mt-3 text-center text-[12px] font-bold text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="mt-5 h-12 w-full rounded-[12px] bg-primary text-[13px] font-black uppercase text-[#0E141B] shadow-[0_0_24px_rgba(177,235,11,0.36)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Validando..." : "Validar e acessar"}
      </button>
    </form>
  );
}
