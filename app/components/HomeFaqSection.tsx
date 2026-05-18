import { HOME_FAQ } from "@/lib/seo/config";

export function HomeFaqSection() {
  return (
    <section
      id="perguntas-frequentes"
      className="font-helvetica-now-display border-t border-white/8 bg-black px-4 py-14 sm:px-6 lg:px-10"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-[800px]">
        <h2
          id="faq-heading"
          className="text-center text-[28px] font-bold leading-tight text-white sm:text-[36px]"
        >
          Perguntas sobre o <span className="text-primary">Bolão do Milhão</span>
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-[15px] leading-relaxed text-white/60 sm:text-[17px]">
          Tire suas dúvidas sobre o bolão da Copa 2026, palpites, ranking e prêmios antes de
          garantir sua cota.
        </p>
        <dl className="mt-10 space-y-6">
          {HOME_FAQ.map((item) => (
            <div
              key={item.question}
              className="rounded-[14px] border border-white/10 bg-[#111] px-4 py-4 sm:px-5 sm:py-5"
            >
              <dt className="text-[16px] font-bold leading-snug text-white sm:text-[18px]">
                {item.question}
              </dt>
              <dd className="mt-2 text-[14px] leading-relaxed text-white/65 sm:text-[15px]">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
