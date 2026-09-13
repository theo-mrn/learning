import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export const WORKSPACE_COOKIE = "notes_workspace";

export type ActiveWorkspace = {
  id: string;
  name: string;
  icon: string | null;
  /** Rôle de l'utilisateur courant dans cet espace. */
  role: string;
  memberCount: number;
};

/**
 * L'espace actif est mémorisé dans un cookie, mais **jamais accordé sur cette
 * seule base** : il est confronté aux appartenances réelles à chaque requête.
 * Un cookie forgé pointant vers l'espace d'autrui est donc sans effet — sinon
 * on rouvrirait exactement la faille d'accès direct corrigée sur les pages.
 *
 * Le cookie (et non un champ en base) évite une écriture à chaque bascule, et
 * laisse deux onglets travailler dans deux espaces différents.
 */
export const getActiveWorkspace = cache(async (): Promise<ActiveWorkspace> => {
  const user = await requireUser();
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    // Un compte sans espace ne peut rien faire : on en crée un plutôt que de
    // le laisser devant une application vide.
    const created = await db.workspace.create({
      data: {
        name: "Mon Espace",
        members: { create: { role: "owner", userId: user.id } },
      },
      select: { id: true, name: true, icon: true },
    });
    return { ...created, role: "owner", memberCount: 1 };
  }

  const chosen =
    memberships.find((m) => m.workspace.id === requestedId) ?? memberships[0];

  return {
    id: chosen.workspace.id,
    name: chosen.workspace.name,
    icon: chosen.workspace.icon,
    role: chosen.role,
    memberCount: chosen.workspace._count.members,
  };
});

/** Tous les espaces de l'utilisateur courant, pour le sélecteur. */
export const listWorkspaces = cache(async () => {
  const user = await requireUser();

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { members: true, pages: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    icon: m.workspace.icon,
    role: m.role,
    memberCount: m.workspace._count.members,
    pageCount: m.workspace._count.pages,
  }));
});

/**
 * Vérifie que l'utilisateur courant appartient à cet espace, et renvoie son
 * rôle. À appeler avant toute écriture visant un `workspaceId` venu du client.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  options?: { roles?: string[] }
) {
  const user = await requireUser();

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true, workspace: { select: { id: true, name: true } } },
  });

  if (!membership) throw new Error("Espace introuvable");

  if (options?.roles && !options.roles.includes(membership.role)) {
    throw new Error("Rôle insuffisant pour cette action");
  }

  return { ...membership, userId: user.id };
}
