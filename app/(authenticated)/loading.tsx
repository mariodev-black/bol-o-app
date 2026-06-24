const CARD = "#111111";
const BORDER = "rgba(255,255,255,0.06)";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-white/10 ${className}`} />;
}

/**
 * Fallback de navegação para QUALQUER rota autenticada que não tenha um
 * `loading.tsx` próprio. Aparece imediatamente ao clicar num link (Suspense do
 * App Router), evitando a sensação de "tela travada" enquanto o servidor
 * responde — especialmente útil porque várias páginas fazem queries ao banco.
 */
export default function AuthenticatedLoading() {
  return (
    <div className="min-h-screen bg-black px-4 pb-8 pt-4 text-white">
      <div className="mx-auto w-full max-w-[480px] animate-pulse">
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="mt-3 h-3.5 w-72" />
        <SkeletonBlock className="mt-2 h-3.5 w-56" />

        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border p-4"
              style={{ background: CARD, borderColor: BORDER }}
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="size-10 rounded-full" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-3.5 w-2/3" />
                  <SkeletonBlock className="mt-2 h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-7 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
