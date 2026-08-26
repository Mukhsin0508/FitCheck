import Image from "next/image";

type Pair = {
  label: string;
  product: { src: string; alt: string };
  fit: { src: string; alt: string };
};

const PAIRS: Pair[] = [
  {
    label: "Belted trench",
    product: { src: "/media/p01-trench.jpg", alt: "Belted trench coat, catalog shot" },
    fit: { src: "/media/fit-trench.jpg", alt: "The trench rendered on the shopper's body" },
  },
  {
    label: "Satin slip dress",
    product: { src: "/media/p07-slip-dress.jpg", alt: "Satin slip dress, catalog shot" },
    fit: { src: "/media/fit-slip.jpg", alt: "The slip dress rendered on the shopper's body" },
  },
  {
    label: "Leather jacket",
    product: { src: "/media/p02-leather.jpg", alt: "Leather jacket, catalog shot" },
    fit: { src: "/media/fit-leather.jpg", alt: "The leather jacket rendered on the shopper's body" },
  },
];

const MORE = [
  { src: "/media/p04-camel-coat.jpg", alt: "Camel coat, catalog shot" },
  { src: "/media/p09-floral-wrap.jpg", alt: "Floral wrap dress, catalog shot" },
  { src: "/media/p12-emerald-maxi.jpg", alt: "Emerald maxi dress, catalog shot" },
] as const;

export function Gallery() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
          The catalog, on your body
        </h2>
        <p className="text-sm text-muted">rendered with Higgsfield Soul</p>
      </div>
      <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:mt-14 sm:px-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible">
        {PAIRS.map((pair) => (
          <figure key={pair.label} className="w-[80vw] max-w-xs shrink-0 snap-start md:w-auto md:max-w-none">
            <div className="grid grid-cols-2 gap-2">
              <div className="overflow-hidden rounded-2xl border border-line">
                <Image
                  src={pair.product.src}
                  alt={pair.product.alt}
                  width={750}
                  height={1000}
                  sizes="(min-width: 768px) 17vw, 40vw"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-line">
                <Image
                  src={pair.fit.src}
                  alt={pair.fit.alt}
                  width={750}
                  height={1000}
                  sizes="(min-width: 768px) 17vw, 40vw"
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                  on you
                </span>
              </div>
            </div>
            <figcaption className="mt-3 flex items-baseline justify-between text-sm">
              <span className="font-medium">{pair.label}</span>
              <span className="text-muted">catalog vs. you</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-14 text-sm text-muted">more of the catalog</p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
        {MORE.map((item) => (
          <figure key={item.src} className="overflow-hidden rounded-2xl border border-line">
            <Image
              src={item.src}
              alt={item.alt}
              width={750}
              height={1000}
              sizes="33vw"
              className="aspect-[3/4] w-full object-cover"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
