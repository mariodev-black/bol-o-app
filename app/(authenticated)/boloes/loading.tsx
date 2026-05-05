const CARD = "#0A0E19";

export default function BoloesLoading() {
  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 animate-pulse">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{ background: CARD, borderColor: "rgba(177,235,11,0.25)" }}
        >
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-8 w-52 rounded bg-white/10 mt-3" />
          <div className="h-4 w-72 rounded bg-white/10 mt-3" />
        </section>

        {[1, 2, 3].map((k) => (
          <section
            key={k}
            className="rounded-2xl border p-4 sm:p-5"
            style={{ background: CARD, borderColor: "rgba(255,255,255,0.12)" }}
          >
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-6 w-44 rounded bg-white/10 mt-3" />
            <div className="h-4 w-36 rounded bg-white/10 mt-2" />
            <div className="h-10 w-44 rounded bg-white/10 mt-4" />
          </section>
        ))}
      </div>
    </div>
  );
}
