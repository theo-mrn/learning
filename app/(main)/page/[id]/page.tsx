import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPageBreadcrumb } from "@/lib/pages";
import { getPageDocumentWithVersion } from "@/lib/blocks";
import { getActiveWorkspace } from "@/lib/workspace";
import { canWrite, requireUser } from "@/lib/dal";
import { PageEditor } from "@/components/page-editor";
import { PageActionsMenu } from "@/components/page-actions-menu";
import { AppHeader, type Crumb } from "@/components/app-header";

export default async function EditablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Cloisonné par espace : un `findUnique` sur l'id seul affichait la page de
  // n'importe quel compte à qui devinait son identifiant.
  const workspace = await getActiveWorkspace();
  const page = await db.page.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!page || page.isArchived) notFound();

  const [documentWithVersion, trail, user, memberRows] = await Promise.all([
    getPageDocumentWithVersion(id),
    getPageBreadcrumb(id, workspace.id),
    requireUser(),
    // Les assignés possibles d'une carte Kanban : uniquement les membres de
    // cet espace, pour qu'on ne puisse pas assigner une tâche à quelqu'un qui
    // n'y a pas accès.
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  const members = memberRows.map((row) => ({
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
  }));

  const crumbs: Crumb[] = [
    { label: "Accueil", href: "/home" },
    ...trail.map((ancestor, index) => ({
      label: ancestor.title || "Sans titre",
      icon: ancestor.icon,
      // Le dernier maillon est la page ouverte : pas de lien vers soi-même.
      href: index === trail.length - 1 ? undefined : `/page/${ancestor.id}`,
    })),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        crumbs={crumbs}
        actions={
          <PageActionsMenu pageId={id} canEdit={canWrite(workspace.role)} />
        }
      />

      {/* La toile d'écriture porte le grain de papier de la DA. */}
      <main className="paper-grain relative flex-1">
        <div aria-hidden className="paper-grain-overlay" />

        {/* Gouttières adaptatives : confortables au doigt sur mobile, larges
            sur grand écran, avec une mesure de texte qui reste lisible. */}
        <div
          data-slot="editor-canvas"
          className="relative mx-auto w-full max-w-[46rem] px-5 pt-8 pb-32 sm:px-10 lg:px-12"
        >
          <PageEditor
            page={page}
            initialContent={documentWithVersion.document}
            initialVersion={documentWithVersion.version}
            canEdit={canWrite(workspace.role)}
            members={members}
            currentUserId={user.id}
          />
        </div>
      </main>
    </div>
  );
}
