import { Trash2 } from "lucide-react";
import { getActiveWorkspace } from "@/lib/workspace";
import { canWrite } from "@/lib/dal";
import { getArchivedPages } from "@/lib/pages";
import { AppHeader } from "@/components/app-header";
import { TrashItem } from "@/components/trash-item";

export default async function TrashPage() {
  const workspace = await getActiveWorkspace();
  const archivedPages = await getArchivedPages(workspace.id);
  const canEdit = canWrite(workspace.role);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        crumbs={[{ label: "Accueil", href: "/home" }, { label: "Corbeille" }]}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <header className="rule-accent">
          <h1 className="font-heading text-[clamp(1.75rem,5vw,2.25rem)] leading-tight text-foreground">
            Corbeille
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Les pages archivées restent ici avec leurs sous-pages. Tu peux les
            restaurer, ou les supprimer définitivement — cette suppression est
            irréversible.
          </p>
        </header>

        {archivedPages.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <Trash2
              aria-hidden
              className="mx-auto size-6 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="mt-3 font-heading text-lg text-foreground">
              La corbeille est vide
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Les pages que tu supprimes depuis la sidebar arriveront ici.
            </p>
          </div>
        ) : (
          <>
            <p
              className="mt-8 mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase"
              data-numeric
            >
              {archivedPages.length} page
              {archivedPages.length > 1 ? "s" : ""} archivée
              {archivedPages.length > 1 ? "s" : ""}
            </p>
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-paper">
              {archivedPages.map((page, index) => (
                <li
                  key={page.id}
                  className={index > 0 ? "border-t border-border/60" : ""}
                >
                  <TrashItem page={page} canEdit={canEdit} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
