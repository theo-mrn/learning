import { createHash } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/dal";
import { AcceptInvitationButton } from "@/components/workspace/accept-invitation-button";

export const metadata = { title: "Invitation · Notes" };

/**
 * Page d'acceptation d'une invitation.
 *
 * Le jeton n'est jamais comparé en clair : on cherche son empreinte, comme
 * pour les sessions. Un lien expiré, déjà utilisé ou nominatif pour une autre
 * adresse est refusé ici, et de nouveau dans la Server Action — la page ne
 * fait que présenter, elle n'autorise pas.
 */
/**
 * Hors du composant, volontairement : `Date.now()` appelé pendant le rendu
 * viole la règle d'idempotence de React (`react-hooks/purity`) — deux rendus
 * du même composant pourraient conclure différemment. Ici la lecture de
 * l'horloge est isolée dans une fonction ordinaire, dont le composant ne fait
 * que consommer le verdict.
 */
function describeProblem(
  invitation: {
    email: string | null;
    expiresAt: Date;
    acceptedAt: Date | null;
  } | null,
  viewerEmail: string | null
): string | null {
  if (!invitation) return "Cette invitation est introuvable.";
  if (invitation.acceptedAt) return "Cette invitation a déjà été utilisée.";
  if (invitation.expiresAt.getTime() <= Date.now()) {
    return "Cette invitation a expiré.";
  }
  if (
    invitation.email &&
    viewerEmail &&
    invitation.email !== viewerEmail.toLowerCase()
  ) {
    return `Cette invitation vise ${invitation.email}.`;
  }
  return null;
}

export default async function InvitationPage({
  params,
}: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const user = await getSessionUser();

  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: {
      role: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      workspace: { select: { name: true, icon: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const problem = describeProblem(invitation, user?.email ?? null);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/50 p-6 text-center shadow-paper">
        {problem ? (
          <>
            <h1 className="font-heading text-xl text-foreground">
              Invitation invalide
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{problem}</p>
            <Link
              href="/home"
              className="mt-5 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Retour à l&apos;accueil
            </Link>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary font-heading text-xl leading-none text-primary-foreground"
            >
              {invitation!.workspace.icon ??
                invitation!.workspace.name.trim().charAt(0).toUpperCase()}
            </span>

            <h1 className="mt-4 font-heading text-xl text-foreground">
              Rejoindre {invitation!.workspace.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {invitation!.invitedBy.name ?? invitation!.invitedBy.email}{" "}
              t&apos;invite comme{" "}
              {invitation!.role === "viewer" ? "lecteur" : "éditeur"}.
            </p>

            {user ? (
              <div className="mt-5">
                <AcceptInvitationButton token={token} />
              </div>
            ) : (
              <>
                <p className="mt-4 text-xs text-muted-foreground">
                  Connecte-toi pour accepter.
                </p>
                <Link
                  href={`/login?suivant=/invitation/${token}`}
                  className="mt-3 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Se connecter
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
