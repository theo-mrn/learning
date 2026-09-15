"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canWrite, requirePageAccess, requireUser } from "@/lib/dal";
import { getActiveWorkspace } from "@/lib/workspace";
import { extractPlainText } from "@/lib/tiptap-text";
import { collectOrphanAssets } from "@/lib/asset-gc";
import { getPageDocumentWithVersion } from "@/lib/blocks";
import type { Prisma } from "@/app/generated/prisma/client";

export async function createPage(parentId: string | null) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace();

  // Créer une page est une écriture : sans ce contrôle, un membre en lecture
  // seule pouvait en créer autant qu'il voulait à la racine de l'espace
  // (`requirePageAccess` n'était consulté que pour une page parente).
  if (!canWrite(workspace.role)) {
    throw new Error("Votre rôle sur cet espace est en lecture seule");
  }

  // Créer un enfant sous la page d'autrui reviendrait à écrire chez lui.
  if (parentId) await requirePageAccess(parentId, "write");

  const page = await db.page.create({
    data: {
      title: "Sans titre",
      userId: user.id,
      workspaceId: workspace.id,
      parentId,
    },
  });

  revalidatePath("/", "layout");
  redirect(`/page/${page.id}`);
}

// Chaque action reçoit un `pageId` **fourni par le client** : une Server
// Action est un endpoint HTTP public, pas un appel interne. Sans
// `requirePageAccess`, deviner un id suffisait à renommer, déplacer, vider ou
// supprimer la page de quelqu'un d'autre.

export async function renamePage(pageId: string, title: string) {
  await requirePageAccess(pageId);

  await db.page.update({
    where: { id: pageId },
    data: { title: title.trim() || "Sans titre" },
  });

  revalidatePath("/", "layout");
}

export async function updatePageIcon(pageId: string, icon: string | null) {
  await requirePageAccess(pageId);

  await db.page.update({
    where: { id: pageId },
    data: { icon },
  });

  revalidatePath("/", "layout");
}

/**
 * Persists a sidebar drag-and-drop move: `pageId` becomes a child of
 * `newParentId` (null for the top level), inserted at `insertAtId`'s
 * position ("before" or "after" it), or appended last if `insertAtId`
 * is null.
 *
 * The full sibling list is loaded from the database rather than trusted
 * from the client, because the sidebar only has loaded/flattened the
 * children of *expanded* pages — a collapsed sibling wouldn't be in a
 * client-supplied ordering and would silently lose its order otherwise.
 *
 * Refuses the move if `newParentId` is `pageId` itself or one of its own
 * descendants, which would otherwise create a cycle in the tree.
 */
export async function movePage(
  pageId: string,
  newParentId: string | null,
  insertAtId: string | null,
  insertPosition: "before" | "after"
) {
  const page = await requirePageAccess(pageId);

  if (newParentId) {
    if (newParentId === pageId) return;
    // Le parent visé doit aussi nous appartenir, sinon on déplacerait sa
    // propre page dans l'arborescence d'autrui.
    await requirePageAccess(newParentId);
    const descendantIds = await collectDescendantIds(pageId);
    if (descendantIds.includes(newParentId)) return;
  }

  // Cloisonné par espace de travail : sans ce filtre, la renumérotation
  // ci-dessous réécrivait l'ordre des pages de tous les comptes partageant
  // le même niveau d'arborescence.
  const siblings = await db.page.findMany({
    where: {
      parentId: newParentId,
      workspaceId: page.workspaceId,
      isArchived: false,
      id: { not: pageId },
    },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  let insertAt = siblings.length;
  const targetIndex = insertAtId
    ? siblings.findIndex((s) => s.id === insertAtId)
    : -1;
  if (targetIndex !== -1) {
    insertAt = insertPosition === "before" ? targetIndex : targetIndex + 1;
  }

  const orderedIds = siblings.map((s) => s.id);
  orderedIds.splice(insertAt, 0, pageId);

  await db.$transaction([
    db.page.update({
      where: { id: pageId },
      data: { parentId: newParentId },
    }),
    ...orderedIds.map((id, index) =>
      db.page.update({ where: { id }, data: { order: index } })
    ),
  ]);

  revalidatePath("/", "layout");
}

/** Archives a page and all its descendants, so a restore later only has
 * to bring back the ones the user explicitly restores. */
export async function archivePage(pageId: string) {
  await requirePageAccess(pageId);
  const descendantIds = await collectDescendantIds(pageId);

  await db.page.updateMany({
    where: { id: { in: [pageId, ...descendantIds] } },
    data: { isArchived: true },
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function restorePage(pageId: string) {
  await requirePageAccess(pageId);
  const page = await db.page.findUniqueOrThrow({ where: { id: pageId } });

  // If the parent is gone or still archived, restore to the top level
  // instead of leaving the page unreachable in the sidebar.
  const parentStillAvailable =
    page.parentId &&
    (await db.page.findUnique({ where: { id: page.parentId } }))
      ?.isArchived === false;

  await db.page.update({
    where: { id: pageId },
    data: {
      isArchived: false,
      parentId: parentStillAvailable ? page.parentId : null,
    },
  });

  revalidatePath("/", "layout");
}

export async function deletePagePermanently(pageId: string) {
  await requirePageAccess(pageId);
  const descendantIds = await collectDescendantIds(pageId);

  await db.page.deleteMany({
    where: { id: { in: [pageId, ...descendantIds] } },
  });

  revalidatePath("/", "layout");
}

async function collectDescendantIds(pageId: string): Promise<string[]> {
  const children = await db.page.findMany({
    where: { parentId: pageId },
    select: { id: true },
  });

  const nested = await Promise.all(
    children.map((c) => collectDescendantIds(c.id))
  );

  return [...children.map((c) => c.id), ...nested.flat()];
}

const VERSION_SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000;

/** Plafond d'historique par page. Assez large pour couvrir plusieurs heures
 * de travail à un snapshot toutes les cinq minutes, tout en rendant les
 * images réellement collectables : une version conservée indéfiniment garde
 * ses images en vie indéfiniment. */
const MAX_VERSIONS_PER_PAGE = 50;

/**
 * Persists a full Tiptap document for a page as an ordered set of
 * top-level Blocks. Simplest correct strategy given Tiptap hands back
 * one JSON tree per save: replace the page's top-level blocks in a
 * transaction rather than diffing node-by-node.
 *
 * Also snapshots the document into PageVersion for history/rollback —
 * throttled to at most one snapshot per VERSION_SNAPSHOT_THROTTLE_MS so
 * autosave-on-every-keystroke doesn't flood the history with near-
 * identical versions.
 */
/** Marqueur interne du conflit détecté dans la transaction.
 *
 * Une simple chaîne, pas une classe exportée : ce fichier est `"use server"`,
 * qui n'autorise que l'export de fonctions asynchrones. Exporter une classe
 * invalide le module entier — les autres Server Actions devenaient
 * introuvables (« Export archivePage doesn't exist »). */
const CONFLICT_MARKER = "__page_conflict__";

export type SaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; currentVersion: number };

/**
 * Écrit le document d'une page, de façon **incrémentale** et sous **contrôle
 * de concurrence optimiste**.
 *
 * Avant : la fonction faisait `deleteMany` puis recréait tous les blocs à
 * chaque sauvegarde. Deux membres d'un même espace écrivant sur la même page
 * se écrasaient mutuellement — le dernier gagnait, l'autre perdait son travail
 * sans aucun message. Le garde `saveInFlight` côté client ne protégeait qu'un
 * seul onglet.
 *
 * Maintenant :
 *
 * - `expectedVersion` est la version sur laquelle le client a travaillé. Si
 *   elle ne correspond plus, rien n'est écrit et on renvoie `conflict` : à
 *   l'appelant de recharger, jamais d'écrasement silencieux.
 * - Seuls les blocs réellement différents sont touchés (comparaison du JSON
 *   sérialisé). Une frappe dans un paragraphe ne réécrit plus la page entière,
 *   ce qui réduit aussi la pression sur la base.
 * - `contentVersion` est incrémenté dans la même transaction, ce qui rend le
 *   contrôle fiable même si deux écritures arrivent en parallèle.
 */
export async function savePageContent(
  pageId: string,
  doc: { type: string; content?: unknown[] },
  expectedVersion?: number
): Promise<SaveResult> {
  const topLevelNodes = (doc.content ?? []) as Array<{ type: string }>;
  await requirePageAccess(pageId);
  const user = await requireUser();

  const page = await db.page.findUniqueOrThrow({
    where: { id: pageId },
    select: { title: true, contentVersion: true },
  });

  // `undefined` = appelant qui ne gère pas encore les versions (restauration
  // d'une version, scripts) : on n'impose pas le contrôle dans ce cas.
  if (expectedVersion !== undefined && expectedVersion !== page.contentVersion) {
    return { status: "conflict", currentVersion: page.contentVersion };
  }

  const latestVersion = await db.pageVersion.findFirst({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const shouldSnapshot =
    !latestVersion ||
    Date.now() - latestVersion.createdAt.getTime() >
      VERSION_SNAPSHOT_THROTTLE_MS;

  let newVersion = page.contentVersion;
  let conflictVersion: number | null = null;

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Relecture de la version DANS la transaction : entre le contrôle
    // ci-dessus et ici, une autre écriture a pu passer. C'est ce second
    // contrôle qui rend la garantie réelle.
    const fresh = await tx.page.findUniqueOrThrow({
      where: { id: pageId },
      select: { contentVersion: true },
    });
    if (expectedVersion !== undefined && expectedVersion !== fresh.contentVersion) {
      // Lever annule la transaction : rien n'est écrit, et on convertit en
      // résultat `conflict` juste après.
      conflictVersion = fresh.contentVersion;
      throw new Error(CONFLICT_MARKER);
    }

    const existing = await tx.block.findMany({
      where: { pageId, parentId: null },
      orderBy: { order: "asc" },
      select: { id: true, order: true, content: true, type: true },
    });

    // Comparaison par position : le document Tiptap est une liste ordonnée,
    // donc l'indice est l'identité naturelle d'un bloc de haut niveau.
    for (let i = 0; i < topLevelNodes.length; i++) {
      const node = topLevelNodes[i];
      const previous = existing[i];
      const serialized = JSON.stringify(node);

      if (previous && JSON.stringify(previous.content) === serialized) {
        continue; // inchangé : on ne touche pas la ligne
      }

      if (previous) {
        await tx.block.update({
          where: { id: previous.id },
          data: {
            type: node.type,
            content: node as object,
            textContent: extractPlainText(node),
            order: i,
          },
        });
      } else {
        await tx.block.create({
          data: {
            pageId,
            type: node.type,
            content: node as object,
            textContent: extractPlainText(node),
            order: i,
            createdById: user.id,
          },
        });
      }
    }

    // Le document a raccourci : on retire les lignes en trop, et seulement
    // celles-là.
    if (existing.length > topLevelNodes.length) {
      await tx.block.deleteMany({
        where: {
          id: { in: existing.slice(topLevelNodes.length).map((b) => b.id) },
        },
      });
    }

    if (shouldSnapshot) {
      await tx.pageVersion.create({
        data: {
          pageId,
          title: page.title,
          content: doc as object,
          createdById: user.id,
        },
      });
    }

    // Élagage de l'historique AVANT le balayage des orphelins : une image
    // n'est collectable que si plus aucune version ne la référence, donc
    // l'ordre compte. Sans rétention, l'historique grandit indéfiniment et
    // aucune image n'est jamais récupérable.
    await prunePageVersions(pageId, tx);

    // Dans la MÊME transaction que la réécriture des blocs : exécuté après,
    // une sauvegarde concurrente pourrait insérer une référence entre la
    // lecture et la suppression, et on effacerait une image utilisée.
    await collectOrphanAssets(pageId, tx);

    const updated = await tx.page.update({
      where: { id: pageId },
      data: { contentVersion: { increment: 1 } },
      select: { contentVersion: true },
    });
    newVersion = updated.contentVersion;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === CONFLICT_MARKER &&
      conflictVersion !== null
    ) {
      return { status: "conflict", currentVersion: conflictVersion };
    }
    throw error;
  }

  return { status: "saved", version: newVersion };
}

/**
 * Ne conserve que les `MAX_VERSIONS_PER_PAGE` snapshots les plus récents.
 *
 * Postgres ne sait pas faire `DELETE ... ORDER BY ... OFFSET`, d'où la
 * sélection préalable des ids à garder.
 */
async function prunePageVersions(
  pageId: string,
  tx: Prisma.TransactionClient
) {
  const keep = await tx.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: MAX_VERSIONS_PER_PAGE,
    select: { id: true },
  });

  if (keep.length < MAX_VERSIONS_PER_PAGE) return;

  await tx.pageVersion.deleteMany({
    where: { pageId, id: { notIn: keep.map((v: { id: string }) => v.id) } },
  });
}

/**
 * Relit le document d'une page et sa version, pour un client déjà ouvert.
 *
 * Sert à la synchronisation entre membres : quand le flux SSE annonce une
 * nouvelle version, le client vient chercher le contenu ici plutôt que de
 * recharger la page — ce qui lui permet d'intégrer les blocs distants sans
 * perdre ni la frappe en cours, ni la position du curseur.
 */
export async function fetchPageDocument(pageId: string) {
  await requirePageAccess(pageId, "read");
  return getPageDocumentWithVersion(pageId);
}

export async function getPageVersions(pageId: string) {
  // Consulter l'historique est une lecture : un membre en lecture seule y a
  // droit.
  await requirePageAccess(pageId, "read");

  return db.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });
}

/**
 * Restores a page to a prior version: replaces its current blocks with
 * that version's snapshot. Does not delete the version history, and the
 * restore itself becomes a new snapshot (via the next savePageContent),
 * so restoring is not a dead end.
 */
export async function restorePageVersion(pageId: string, versionId: string) {
  await requirePageAccess(pageId);

  const version = await db.pageVersion.findUniqueOrThrow({
    where: { id: versionId },
  });
  if (version.pageId !== pageId) {
    throw new Error("Version does not belong to this page");
  }

  const doc = version.content as { type: string; content?: unknown[] };
  await db.page.update({
    where: { id: pageId },
    data: { title: version.title },
  });
  // Sans `expectedVersion` : restaurer est une décision explicite de
  // l'utilisateur, elle doit aboutir même si la page a bougé entre-temps.
  await savePageContent(pageId, doc);

  revalidatePath("/", "layout");
}

/**
 * Bascule une page entre défilement continu et feuilles A4 numérotées.
 *
 * Le mode vit sur la page, pas dans les préférences du compte : un cours long
 * se relit en feuilles paginées quand une prise de notes rapide gagne à rester
 * en flux continu, et le même utilisateur veut les deux.
 *
 * Aucun contenu n'est touché — c'est une bascule d'affichage, donc pas de
 * `contentVersion` à incrémenter ni de conflit possible avec une écriture
 * concurrente.
 */
export async function updatePageLayout(pageId: string, mode: string) {
  await requirePageAccess(pageId);

  // La valeur vient du client : tout ce qui n'est pas explicitement `paged`
  // retombe sur le défilement continu, plutôt que d'écrire en base une chaîne
  // arbitraire que le CSS ne saurait pas interpréter.
  const layoutMode = mode === "paged" ? "paged" : "infinite";

  await db.page.update({
    where: { id: pageId },
    data: { layoutMode },
  });

  revalidatePath("/", "layout");
}
