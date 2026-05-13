"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccessAfterChange: () => void | Promise<void>;
};

function PwField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  disabled,
  show,
  onToggleShow,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-black uppercase tracking-[0.14em] text-white/80">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-[14px] top-1/2 size-[15px] -translate-y-1/2 text-white/32" />
        <input
          id={id}
          className="auth-input"
          style={{ paddingLeft: 42, paddingRight: 44 }}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          className="absolute right-3 top-1/2 flex -translate-y-1/2 text-white/36 transition-colors hover:text-white/65 disabled:opacity-40"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function PerfilSegurancaDialog({ open, onClose, onSuccessAfterChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, saving]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        const r = await fetch("/api/user/password", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmNewPassword,
          }),
        });
        const data = (await r.json()) as { error?: string; ok?: boolean };
        if (!r.ok || !data.ok) {
          setError(typeof data.error === "string" ? data.error : "Não foi possível alterar a senha.");
          return;
        }
        await onSuccessAfterChange();
        onClose();
      } catch {
        setError("Erro de rede. Tente novamente.");
      } finally {
        setSaving(false);
      }
    },
    [confirmNewPassword, currentPassword, newPassword, onClose, onSuccessAfterChange, saving]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-seg-dialog-titulo"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/80 backdrop-blur-[2px]"
        aria-label="Fechar"
        disabled={saving}
        onClick={() => !saving && onClose()}
      />
      <div className="animate-perfil-avatar-sheet-in relative z-10 flex max-h-[min(92dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#101010] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-2xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h2
            id="perfil-seg-dialog-titulo"
            className="font-helvetica-now-display text-left text-[15px] font-black uppercase tracking-wide text-white"
          >
            Segurança
          </h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <p className="text-center text-[12px] font-medium leading-relaxed text-white/55">
            Informe a senha atual e escolha uma nova senha forte. Depois de salvar, você será desconectado e poderá
            entrar de novo com a nova senha.
          </p>

          <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/35 p-4">
            <PwField
              id="perfil-senha-atual"
              label="Senha atual"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={saving}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((s) => !s)}
            />
            <PwField
              id="perfil-senha-nova"
              label="Nova senha"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={saving}
              show={showNew}
              onToggleShow={() => setShowNew((s) => !s)}
            />
            <PwField
              id="perfil-senha-confirma"
              label="Confirmar nova senha"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              disabled={saving}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((s) => !s)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-400/25 bg-red-950/30 px-3 py-2.5 text-center text-[12px] font-semibold text-red-200"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap-reverse sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => !saving && onClose()}
              className="h-11 rounded-xl border border-white/15 bg-white/8 px-4 text-[11px] font-black uppercase tracking-wide text-white transition-colors hover:bg-white/12 disabled:opacity-50 sm:min-w-[120px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl bg-primary px-4 text-[12px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_8px_24px_rgba(177,235,11,0.25)] transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 sm:min-w-[180px]"
            >
              {saving ? "Salvando…" : "Salvar nova senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
