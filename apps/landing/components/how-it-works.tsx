import Image from "next/image";

type Step = {
  num: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  chip?: { label: string; accent?: boolean };
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Five selfies, one avatar",
    body: "Shoot them in whatever light you have. Higgsfield Soul builds a photoreal you in about a minute, and it only ever exists for your try-ons.",
    src: "/media/avatar.jpg",
    alt: "A photoreal avatar portrait built from selfies",
    width: 1000,
    height: 1000,
  },
  {
    num: "02",
    title: "Tap any garment",
    body: "Browse the catalog or paste a product URL from any store. The piece renders on your body in seconds, not on a mannequin's.",
    src: "/media/p08-knit-midi.jpg",
    alt: "A knit midi dress catalog shot with a try-on button",
    width: 750,
    height: 1000,
    chip: { label: "Try on", accent: true },
  },
  {
    num: "03",
    title: "Buy it where it lives",
    body: "One tap opens checkout at the merchant, at the merchant's price. FitCheck earns an affiliate commission and takes nothing from you.",
    src: "/media/fit-denim.jpg",
    alt: "A rendered denim outfit with a checkout link to the merchant",
    width: 750,
    height: 1000,
    chip: { label: "Checkout at the store" },
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-24 sm:px-8 sm:pt-32">
      <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
        How it works
      </h2>
      <div className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-3 md:gap-6">
        {STEPS.map((step) => (
          <article key={step.num}>
            <figure className="relative overflow-hidden rounded-2xl border border-line">
              <Image
                src={step.src}
                alt={step.alt}
                width={step.width}
                height={step.height}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="aspect-[3/4] w-full object-cover"
              />
              {step.chip && (
                <span
                  className={
                    step.chip.accent
                      ? "absolute bottom-3 left-3 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-ink"
                      : "absolute bottom-3 left-3 rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-xs font-medium backdrop-blur"
                  }
                >
                  {step.chip.label}
                </span>
              )}
            </figure>
            <p className="mt-5 font-serif text-lg italic text-muted">{step.num}</p>
            <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
