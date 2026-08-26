import Image from "next/image";
import { HeroStarButton } from "./github-stars";
import { REPO_URL } from "@/lib/site";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <p className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-xs tracking-wide text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        open source virtual try-on
      </p>
      <h1 className="mt-8 max-w-4xl font-serif text-[clamp(3rem,9vw,6rem)] leading-[0.95] tracking-tight">
        See it <em>on you</em> before you buy it.
      </h1>
      <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
        A few selfies become your avatar. Any garment on the internet renders
        on your body in seconds. Love it? Buy it at the store — we take nothing
        from you.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <HeroStarButton />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full border border-line px-6 py-3 text-sm font-medium transition-colors hover:border-foreground"
        >
          Read the code
        </a>
      </div>
      <figure className="mt-14 overflow-hidden rounded-2xl border border-line sm:mt-20 sm:rounded-3xl">
        <Image
          src="/media/hero-mirror.jpg"
          alt="A mirror fit check: a rendered outfit on the wearer's own body"
          width={1600}
          height={905}
          preload
          sizes="(min-width: 1152px) 1088px, 100vw"
          className="h-auto w-full"
        />
      </figure>
    </section>
  );
}
