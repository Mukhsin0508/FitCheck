import { NavStarPill } from "./github-stars";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="font-serif text-2xl leading-none">
          FitCheck
        </a>
        <div className="flex items-center gap-6">
          <a
            href="#how"
            className="hidden text-sm text-muted transition-colors hover:text-foreground sm:block"
          >
            how it works
          </a>
          <a
            href="#why"
            className="hidden text-sm text-muted transition-colors hover:text-foreground sm:block"
          >
            why it wins
          </a>
          <NavStarPill />
        </div>
      </nav>
    </header>
  );
}
