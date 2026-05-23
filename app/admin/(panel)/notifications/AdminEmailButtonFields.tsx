"use client";

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

const QUICK_LINKS = [
  { label: "Bolões", path: "/boloes" },
  { label: "Palpites", path: "/palpites" },
  { label: "Tickets", path: "/tickets" },
  { label: "Indique", path: "/indique" },
  { label: "Perfil", path: "/perfil" },
  { label: "Login", path: "/login" },
] as const;

export function AdminEmailButtonFields({
  includeButton,
  onIncludeButtonChange,
  buttonLabel,
  buttonUrl,
  onButtonLabelChange,
  onButtonUrlChange,
}: {
  includeButton: boolean;
  onIncludeButtonChange: (value: boolean) => void;
  buttonLabel: string;
  buttonUrl: string;
  onButtonLabelChange: (value: string) => void;
  onButtonUrlChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-black/25 p-4 sm:p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={includeButton}
          onChange={(e) => onIncludeButtonChange(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[#B1EB0B]"
        />
        <span>
          <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
            Incluir botão no e-mail
          </span>
          <span className="mt-1 block text-[12px] font-medium text-white/38">
            Opcional. Sem marcar, ou com campos vazios = e-mail só com texto. O botão verde
            só entra se texto e link estiverem preenchidos.
          </span>
        </span>
      </label>

      {includeButton ? (
        <>
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
                placeholder="/palpites ou URL completa do app"
                maxLength={500}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="w-full text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 sm:w-auto sm:py-2">
              Atalhos de link:
            </span>
            {QUICK_LINKS.map((link) => (
              <button
                key={link.path}
                type="button"
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/55 transition-colors hover:border-primary/35 hover:text-primary"
                onClick={() => {
                  onButtonUrlChange(link.path);
                  if (!buttonLabel.trim()) {
                    onButtonLabelChange(
                      link.label === "Palpites"
                        ? "Enviar palpites"
                        : `Ir para ${link.label}`,
                    );
                  }
                }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
