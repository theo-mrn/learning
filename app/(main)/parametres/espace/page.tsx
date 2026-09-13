import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { getActiveWorkspace } from "@/lib/workspace";
import { AppHeader } from "@/components/app-header";
import { WorkspaceSettingsForm } from "@/components/workspace/workspace-settings-form";
import { WorkspaceMembers } from "@/components/workspace/workspace-members";
import { WorkspaceDangerZone } from "@/components/workspace/workspace-danger-zone";

export const metadata = { title: "Paramètres de l'espace · Notes" };

export default async function WorkspaceSettingsPage() {
  const [user, workspace] = await Promise.all([
    requireUser(),
    getActiveWorkspace(),
  ]);

  const isOwner = workspace.role === "owner";

  const [members, invitations, workspaceCount] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    // Les invitations en attente n'intéressent que le propriétaire.
    isOwner
      ? db.workspaceInvitation.findMany({
          where: { workspaceId: workspace.id, acceptedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    db.workspaceMember.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        crumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Paramètres de l'espace" },
        ]}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <header className="rule-accent">
          <h1 className="font-heading text-[clamp(1.75rem,5vw,2.25rem)] leading-tight text-foreground">
            Paramètres de l&apos;espace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOwner
              ? "Tu es propriétaire de cet espace."
              : "Tu es membre de cet espace ; seul un propriétaire peut le modifier."}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          <WorkspaceSettingsForm
            workspace={{
              id: workspace.id,
              name: workspace.name,
              icon: workspace.icon,
            }}
            canEdit={isOwner}
          />

          <WorkspaceMembers
            workspaceId={workspace.id}
            currentUserId={user.id}
            canManage={isOwner}
            members={members.map((m) => ({
              userId: m.user.id,
              name: m.user.name,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.role,
            }))}
            invitations={invitations.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />

          <WorkspaceDangerZone
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            isOwner={isOwner}
            isOnlyWorkspace={workspaceCount <= 1}
          />
        </div>
      </main>
    </div>
  );
}
