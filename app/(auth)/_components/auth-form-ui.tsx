"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

export function maskCPF(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

type AuthFieldProps = {
  label: string;
  success?: boolean;
  error?: boolean;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({
  label,
  success,
  error,
  trailing,
  className,
  value,
  ...props
}: AuthFieldProps) {
  const hasValue = value != null && String(value).length > 0;
  return (
    <div
      className={[
        "auth-field",
        hasValue ? "auth-field--filled" : "",
        success ? "auth-field--success" : "",
        error ? "auth-field--error" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label className="auth-field-label">{label}</label>
      <input
        {...props}
        value={value}
        className={["auth-field-input", className].filter(Boolean).join(" ")}
      />
      {success ? (
        <Check
          className="auth-field-trail text-[#B1EB0B]"
          size={18}
          strokeWidth={2.75}
          aria-hidden
        />
      ) : null}
      {trailing}
    </div>
  );
}

export function AuthPasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
  autoComplete?: string;
}) {
  return (
    <AuthField
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      autoComplete={autoComplete}
      trailing={
        <button
          type="button"
          onClick={onToggleShow}
          className="auth-field-trail text-white/40 transition-colors hover:text-white/70"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
}

export function AuthStepper({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="mb-5 flex items-center justify-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center">
            <span
              className={[
                "flex size-8 items-center justify-center rounded-full text-[13px] font-black",
                done
                  ? "bg-[#0AC96B] text-white"
                  : active
                    ? "bg-[#B1EB0B] text-[#0E141B]"
                    : "border border-white/15 bg-white/5 text-white/35",
              ].join(" ")}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : n}
            </span>
            {n < total ? (
              <span
                className={[
                  "mx-1 h-0.5 w-8 sm:w-12",
                  step > n ? "bg-[#0AC96B]" : "bg-white/12",
                ].join(" ")}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function GoogleAuthButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/35">
          ou
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[14px] font-semibold text-[#1a1a1a] transition-opacity hover:opacity-92 disabled:cursor-wait disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {label}
      </button>
    </>
  );
}

export function AuthPrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const enabled = !disabled;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-12 w-full items-center justify-center rounded-xl text-[14px] font-black uppercase tracking-wide transition-all",
        enabled
          ? "bg-[#B1EB0B] text-[#0E141B] shadow-[0_0_20px_rgba(177,235,11,0.28)] active:scale-[0.99]"
          : "bg-[#2f3d22] text-[#8a7a68] cursor-not-allowed",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function AuthLegalFooter() {
  return (
    <p className="mt-5 text-center text-[12px] leading-relaxed text-white/40">
      Este site é protegido por reCAPTCHA e Google.{" "}
      <a href="/privacidade" className="font-semibold text-[#B1EB0B] hover:underline">
        Política de Privacidade
      </a>{" "}
      e{" "}
      <a href="/privacidade" className="font-semibold text-[#B1EB0B] hover:underline">
        Termos de Serviço
      </a>{" "}
      se aplicam.
    </p>
  );
}
