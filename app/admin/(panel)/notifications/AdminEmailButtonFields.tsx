"use client";

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

const QUICK_LINKS = [
  { label: "Palpites", path: "/palpites" },
  { label: "Bolões", path: "/boloes" },
  { label: "Indique", path: "/indique" },
  { label: "Login", path: "/login" },
] as const;

export function AdminEmailButtonFields({
  buttonLabel,
  buttonUrl,
  onButtonLabelChange,
  onButtonUrlChange,
}: {
  buttonLabel: string;
  buttonUrl: string;
  onButtonLabelChange: (value: string) => void;
  onButtonUrlChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-black/25 p-4 sm:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
        Botão do e-mail
      </p>
      <p className="mt-1 text-[12px] font-medium text-white/38">
        CTA verde no final do layout padrão (logo, título, texto e botão).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 sm:col-span-1">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
            Texto do botão
          </span>
          <input
            className={inputClass}
            value={buttonLabel}
            onChange={(e) => onButtonLabelChange(e.target.value)}
            placeholder="Ex.: Enviar palpites"
            maxLength={80}
            required
          />
        </label>

        <label className="grid gap-2 sm:col-span-1">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
            Link do botão
          </span>
          <input
            className={inputClass}
            value={buttonUrl}
            onChange={(e) => onButtonUrlChange(e.target.value)}
            placeholder="/palpites ou https://app.bolaodomilhao.com.br/palpites"
            maxLength={500}
            required
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="w-full text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 sm:w-auto sm:py-2">
          Atalhos:
        </span>
        {QUICK_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/55 transition-colors hover:border-primary/35 hover:text-primary"
            onClick={() => onButtonUrlChange(link.path)}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
