"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function AdminUserPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Nao foi possivel alterar a senha.");
      setPassword("");
      setConfirmPassword("");
      setMessage("Senha alterada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-[18px] border border-white/8 bg-[#101010] p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-black text-white">Alterar senha do usuário</h2>
        <p className="text-[12px] font-medium text-white/38">
          A nova senha substitui a senha atual de login deste usuário.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nova senha"
          className="h-12 rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmar senha"
          className="h-12 rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-[12px] bg-primary px-5 text-[12px] font-black uppercase tracking-[0.14em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Trocar senha"}
        </button>
      </form>
      {error ? <p className="mt-3 text-[12px] font-bold text-red-300">{error}</p> : null}
      {message ? <p className="mt-3 text-[12px] font-bold text-primary">{message}</p> : null}
    </section>
  );
}
