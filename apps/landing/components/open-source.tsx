import Image from "next/image";
import { RepoStarBadge } from "./github-stars";
import { REPO_SLUG, REPO_URL } from "@/lib/site";

export function OpenSource() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Read every line
          </h2>
          <p className="mt-6 max-w-md leading-relaxed text-muted">
            The whole thing lives on GitHub: the avatar pipeline, the try-on
            calls, the affiliate layer that pays for it. If the privacy promise
            in the footer sounds too good, go audit it.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-4 hover:underline"
              >
                {REPO_SLUG}
              </a>
              <RepoStarBadge />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              MIT licensed. TypeScript monorepo: Expo app, Higgsfield client,
              affiliate layer.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2.5 py-1">MIT</span>
              <span className="rounded-full border border-line px-2.5 py-1">TypeScript</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-medium text-foreground underline underline-offset-4"
              >
                Open on GitHub
              </a>
            </div>
          </div>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-line sm:rounded-3xl">
          <Image
            src="/media/rail.jpg"
            alt="A clothing rail with garments from the catalog"
            width={900}
            height={1200}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-[3/4] w-full object-cover"
          />
        </figure>
      </div>
    </section>
  );
}
