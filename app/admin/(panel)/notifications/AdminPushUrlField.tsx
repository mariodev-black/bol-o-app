"use client";

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

const QUICK_LINKS = [
  { label: "Bolões", path: "/boloes" },
  { label: "Palpites", path: "/palpites" },
  { label: "Ranking", path: "/ranking" },
] as const;

export function AdminPushUrlField({
  pushUrl,
  onPushUrlChange,
}: {
  pushUrl: string;
  onPushUrlChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-black/25 p-4 sm:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
        Link ao tocar no push (PWA)
      </p>
      <p className="mt-1 text-[12px] font-medium text-white/38">
        Opcional. Vazio = abre em <span className="text-white/55">/boloes</span>.
      </p>
      <label className="mt-4 grid gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
          Caminho no app (opcional)
        </span>
        <input
          className={inputClass}
          value={pushUrl}
          onChange={(e) => onPushUrlChange(e.target.value)}
          placeholder="/boloes (padrão se vazio)"
          maxLength={500}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/55 hover:border-primary/35 hover:text-primary"
            onClick={() => onPushUrlChange(link.path)}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
