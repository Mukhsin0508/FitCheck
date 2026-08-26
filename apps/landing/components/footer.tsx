import { AUTHOR_URL, REPO_URL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line sm:mt-32">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="font-serif text-4xl tracking-tight sm:text-5xl">FitCheck</p>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
          Your photos build your avatar and nothing else. Never training data.
          Delete your account, everything goes.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline-offset-4 hover:underline"
          >
            Built by Mukhsin Mukhtorov
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <span className="text-muted">MIT license</span>
        </div>
      </div>
    </footer>
  );
}
