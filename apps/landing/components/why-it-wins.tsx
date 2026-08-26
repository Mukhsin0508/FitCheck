const STATS = [
  {
    figure: "~7–9¢",
    label: "what a render costs",
    body: "Photoreal try-on finally got cheap enough to give away, so we do.",
  },
  {
    figure: "$8–15",
    label: "commission per tried-on purchase",
    body: "At fashion order values, the merchant pays it. The shopper never does.",
  },
  {
    figure: "27–94%",
    label: "conversion lift from try-on",
    body: "What Shopify and Google measured when shoppers could see items on themselves.",
  },
] as const;

export function WhyItWins() {
  return (
    <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-24 sm:px-8 sm:pt-32">
      <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
        Why it wins
      </h2>
      <div className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-3 md:gap-6">
        {STATS.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
          >
            <p className="font-serif text-5xl tracking-tight sm:text-6xl">
              {stat.figure}
            </p>
            <h3 className="mt-4 text-sm font-medium">{stat.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{stat.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">
        numbers from public program terms and platform studies
      </p>
    </section>
  );
}
