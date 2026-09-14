import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession, type SessionUser } from "@/lib/session";

/**
 * Couche d'accès aux données (DAL).
 *
 * La doc Next est explicite : le contrôle d'autorisation doit vivre **au plus
 * près des données**, pas dans le proxy (qui ne sert qu'à des redirections
 * optimistes, sans accès base). Tout ce qui lit ou écrit passe donc par ici.
 *
 * `cache()` mémoïse pendant une passe de rendu : la barre latérale, la page
 * et une action peuvent toutes demander l'utilisateur courant sans multiplier
 * les requêtes.
 */

/** Utilisateur courant, ou `null`. N'impose rien : pour les pages publiques. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  return readSession();
});

/** Utilisateur courant, ou redirection vers la connexion. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await readSession();
  // `?expiree=1` signale au proxy que le cookie est mort : sans ce marqueur,
  // il voyait un cookie présent sur /login et renvoyait vers /, qui revenait
  // ici — boucle de redirection infinie.
  if (!user) redirect("/login?expiree=1");
  return user;
});

/** Variante pour les Route Handlers : lève au lieu de rediriger (une réponse
 * 302 sur un endpoint binaire n'aurait aucun sens). */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await readSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Non authentifié");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Rôles autorisés à modifier le contenu d'un espace. */
const WRITE_ROLES = ["owner", "editor"];

export function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

// `requireWorkspace` vivait ici et renvoyait toujours la première
// appartenance : avec plusieurs espaces, elle rendait la bascule inopérante.
// Remplacée par `getActiveWorkspace` (lib/workspace.ts), qui lit l'espace
// choisi dans le cookie et le confronte aux appartenances réelles.

/**
 * Vérifie que l'utilisateur courant a accès à cette page, et la renvoie.
 *
 * C'est le garde-fou qui manquait : les Server Actions reçoivent un `pageId`
 * **fourni par le client**. Sans cette vérification, n'importe qui pouvait
 * renommer, déplacer, vider ou supprimer la page d'autrui en devinant un id.
 * Une Server Action est un endpoint HTTP public, pas un appel interne.
 */
export async function requirePageAccess(
  pageId: string,
  /** `"write"` par défaut : une action non annotée est bien plus souvent une
   * écriture qu'une lecture, donc l'oubli doit refuser plutôt qu'autoriser. */
  access: "read" | "write" = "write"
) {
  // `requireUserOrThrow` et non `requireUser` : cette fonction est appelée
  // aussi bien depuis des Server Actions que depuis des Route Handlers, et un
  // `redirect()` dans un handler produit un 307 vers /login au lieu d'un 401
  // JSON. Vérifié : l'export de page répondait 307 avant ce changement.
  const user = await requireUserOrThrow();

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      title: true,
      isArchived: true,
    },
  });

  if (!page) throw new ForbiddenError();

  // L'appartenance est lue même pour le créateur de la page : son rôle a pu
  // être rétrogradé en lecture seule depuis, et c'est le rôle courant qui
  // décide — pas le fait d'avoir créé la page autrefois.
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: page.workspaceId, userId: user.id } },
    select: { role: true },
  });

  if (!membership) throw new ForbiddenError();

  // Le contrôle qui manquait : le rôle était lu puis ignoré, si bien qu'un
  // membre en lecture seule pouvait renommer, déplacer, vider, supprimer une
  // page et téléverser des images.
  if (access === "write" && !canWrite(membership.role)) {
    throw new ForbiddenError("Votre rôle sur cet espace est en lecture seule");
  }

  return { ...page, role: membership.role };
}

/** Idem pour une image : une URL d'asset ne doit pas être un accès universel.
 * Lecture seule ici — servir les octets n'est jamais une écriture. */
export async function requireAssetAccess(assetId: string) {
  const user = await requireUserOrThrow();

  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      mimeType: true,
      filename: true,
      checksum: true,
      page: { select: { userId: true, workspaceId: true } },
    },
  });

  if (!asset) return null;

  if (asset.page.userId === user.id) return asset;

  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: asset.page.workspaceId, userId: user.id },
    },
    select: { role: true },
  });

  if (!membership) throw new ForbiddenError();

  return asset;
}
