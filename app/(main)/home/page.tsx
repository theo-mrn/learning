import Link from "next/link";
import { ArrowRight, FileText, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { getActiveWorkspace } from "@/lib/workspace";
import { getRecentPages, getWorkspaceStats } from "@/lib/pages";
import { createPage } from "@/lib/actions";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function HomePage() {
  const workspace = await getActiveWorkspace();
  const [recentPages, stats] = await Promise.all([
    getRecentPages(workspace.id),
    getWorkspaceStats(workspace.id),
  ]);

  const hasPages = recentPages.length > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader crumbs={[{ label: "Accueil" }]} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {/* Titre éditorial : c'est ici que le serif de la DA s'exprime le
            plus, et l'échelle reste fluide pour ne pas casser à 375px. */}
        <section className="rule-accent">
          <h1 className="font-heading text-[clamp(2rem,7vw,3rem)] leading-[1.05] text-foreground">
            {workspace.name}
          </h1>
          <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed text-muted-foreground">
            {hasPages
              ? "Reprends où tu t'es arrêté, ou ouvre une page vierge pour tes prochaines notes."
              : "Ton espace est vide. Crée ta première page pour commencer à prendre des notes."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <form action={createPage.bind(null, null)}>
              <Button type="submit" size="lg">
                <Plus />
                Nouvelle page
              </Button>
            </form>
            {hasPages && (
              <span
                className="text-xs text-muted-foreground"
                data-numeric
              >
                {stats.pageCount} page{stats.pageCount > 1 ? "s" : ""}
                {stats.archivedCount > 0 &&
                  ` · ${stats.archivedCount} dans la corbeille`}
              </span>
            )}
          </div>
        </section>

        {hasPages ? (
          <section className="mt-12">
            <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Reprendre
            </h2>

            {/* Une liste plutôt qu'une grille de cartes : le titre est la
                seule donnée qui compte, et une colonne reste lisible de
                375px à l'écran large sans reflow. */}
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-paper">
              {recentPages.map((page, index) => (
                <li key={page.id}>
                  <Link
                    href={`/page/${page.id}`}
                    className={`group flex min-h-11 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 ${
                      index > 0 ? "border-t border-border/60" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base"
                    >
                      {page.icon ?? (
                        <FileText className="size-4 text-muted-foreground" />
                      )}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-card-foreground">
                        {page.title || "Sans titre"}
                      </span>
                      <time
                        dateTime={page.updatedAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        Modifiée le {DATE_FORMAT.format(page.updatedAt)}
                      </time>
                    </span>

                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          /* État vide : on explique ce qu'on peut faire au lieu d'afficher
             une liste vide. */
          <section className="mt-12 rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <Sparkles
              aria-hidden
              className="mx-auto size-6 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="mt-3 font-heading text-lg text-foreground">
              Rien à afficher pour l&apos;instant
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tape <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">⌘K</kbd>{" "}
              pour chercher à tout moment, et <span className="font-mono text-[0.8em]">/</span> dans une page
              pour insérer titres, listes et tâches.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
