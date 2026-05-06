const CARD = "#101010";

export default function PalpitesLoading() {
  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 animate-pulse">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{ background: CARD, borderColor: "rgba(177,235,11,0.25)" }}
        >
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-8 w-64 rounded bg-white/10 mt-3" />
          <div className="h-4 w-80 rounded bg-white/10 mt-3" />
        </section>

        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{ background: CARD, borderColor: "rgba(255,255,255,0.12)" }}
        >
          <div className="h-4 w-40 rounded bg-white/10 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-20 rounded-xl bg-white/10" />
            ))}
          </div>
        </section>

        {[1, 2, 3].map((k) => (
          <section
            key={k}
            className="rounded-2xl border p-4 sm:p-5"
            style={{ background: CARD, borderColor: "rgba(255,255,255,0.12)" }}
          >
            <div className="h-4 w-44 rounded bg-white/10" />
            <div className="h-12 w-full rounded-xl bg-white/10 mt-4" />
            <div className="h-12 w-full rounded-xl bg-white/10 mt-3" />
            <div className="h-12 w-full rounded-xl bg-white/10 mt-3" />
          </section>
        ))}
      </div>
    </div>
  );
}
