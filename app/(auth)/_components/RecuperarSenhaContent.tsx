"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import { useBolaoToast } from "@/app/components/BolaoToast";

export function RecuperarSenhaContent() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const toast = useBolaoToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail para recuperar a senha.");
      return;
    }
    const isResend = sent;
    setSent(true);
    if (isResend) {
      toast.info("Se o e-mail existir em nossa base, você receberá as instruções novamente.");
    } else {
      toast.success("Enviamos as instruções para o e-mail informado, caso ele exista em nossa base.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full py-8 lg:py-0">
      <div className="mb-6">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/80 transition-colors hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" />
          Ir para login
        </Link>
      </div>

      <div className="mb-[18px]">
        <h1 className="text-[28px] font-black leading-none tracking-[-0.035em] text-white">
          Recuperar senha
        </h1>
        <p className="mt-3 text-[14px] font-medium text-white/50">
          Informe seu e-mail para receber as instruções
        </p>
      </div>

      <div className="rounded-[16px] border border-white/8 bg-[#151515] p-[22px] shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-[10px]">
          <label className="text-[12px] font-black uppercase tracking-[0.14em] text-white/80">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-[17px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/32" />
            <input
              className="auth-input"
              style={{ paddingLeft: 46 }}
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSent(false);
              }}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="mt-[14px] flex h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[16px] font-black text-[#0E141B] shadow-[0_0_24px_rgba(177,235,11,0.42)] transition-transform active:scale-[0.99]"
      >
        {sent ? "Enviar novamente" : "Enviar instruções"}
        {sent ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
      </button>

      <p className="mt-[18px] text-center text-[14px] font-medium text-white/80">
        Lembrou sua senha?{" "}
        <Link href="/login" className="font-black text-primary hover:underline">Entrar agora</Link>
      </p>
    </form>
  );
}
