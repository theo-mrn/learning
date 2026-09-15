import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AIAssistantTrigger } from "@/components/ai/ai-assistant-trigger";


export type Crumb = {
  label: string;
  icon?: string | null;
  /** Absent sur le dernier maillon : la page courante n'est pas un lien. */
  href?: string;
};

/**
 * La barre supérieure commune à tous les écrans : un seul composant au lieu
 * d'une barre `h-12` recopiée dans chaque page, ce qui garantit que la
 * navigation reste au même endroit partout (`navigation-consistency`).
 *
 * Elle est collante et translucide pour que le fil d'Ariane reste lisible
 * pendant qu'on fait défiler un long document.
 */
export function AppHeader({
  crumbs,
  actions,
}: {
  crumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    // `data-slot` sert de point d'accroche au CSS d'impression, qui masque
    // tout le chrome de l'application : sans lui, la barre de navigation
    // serait imprimée en haut de la première feuille.
    <header
      data-slot="app-header"
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
    >
      <SidebarTrigger className="shrink-0" />
      {/* `self-center` explicite : sans lui le séparateur s'étire sur toute
          la hauteur du header (data-vertical:self-stretch) et dépasse en
          haut, ce qui dessine un trait parasite au-dessus du fil d'Ariane. */}
      <Separator
        orientation="vertical"
        className="mx-0.5 h-5 shrink-0 self-center"
      />

      <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li
                key={`${crumb.label}-${index}`}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 && (
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground/60"
                  />
                )}

                {/* Les maillons intermédiaires se réduisent en premier : le
                    titre de la page courante garde la place disponible. */}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="flex min-w-0 max-w-40 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  >
                    {crumb.icon && (
                      <span aria-hidden className="shrink-0 text-[0.9em]">
                        {crumb.icon}
                      </span>
                    )}
                    <span className="truncate">{crumb.label}</span>
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 font-medium text-foreground"
                  >
                    {crumb.icon && (
                      <span aria-hidden className="shrink-0 text-[0.9em]">
                        {crumb.icon}
                      </span>
                    )}
                    <span className="truncate">{crumb.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
        <AIAssistantTrigger />
        {actions}
      </div>
    </header>
  );
}
