import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Nettoyage des images orphelines d'une page.
 *
 * Une image n'est PAS supprimable dès qu'elle quitte le document : les
 * `PageVersion` conservent le document complet, `assetId` compris. Effacer
 * les octets au retrait de l'image casserait silencieusement toutes les
 * versions antérieures qui l'affichent encore, et une restauration
 * reviendrait avec un trou.
 *
 * Le critère est donc l'inaccessibilité : est orpheline une image qu'aucun
 * bloc courant ET aucune version conservée ne référence.
 *
 * Les pages archivées (corbeille) gardent leurs octets : `archivePage` ne
 * fait que basculer `isArchived`, et la restauration doit rester fidèle. La
 * suppression définitive, elle, passe par `db.page.deleteMany` et le cascade
 * de `Asset` s'en charge — rien à faire ici pour ce cas.
 */

/** Collecte récursivement les `assetId` d'un document ou d'un sous-arbre. */
function collectAssetIds(node: unknown, found: Set<string>): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) collectAssetIds(child, found);
    return;
  }

  const n = node as {
    type?: string;
    attrs?: { images?: unknown };
    content?: unknown;
  };

  if (n.type === "imageBlock" && Array.isArray(n.attrs?.images)) {
    for (const image of n.attrs.images as Array<{ assetId?: unknown }>) {
      if (typeof image?.assetId === "string") found.add(image.assetId);
    }
  }

  if (n.content) collectAssetIds(n.content, found);
}

/**
 * Supprime les images de `pageId` que plus rien ne référence.
 *
 * Prend un client transactionnel optionnel pour pouvoir tourner dans la même
 * transaction que l'écriture du document : sinon une sauvegarde concurrente
 * pourrait insérer une référence entre la lecture et la suppression, et on
 * effacerait une image en cours d'utilisation.
 */
export async function collectOrphanAssets(
  pageId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<number> {
  const referenced = new Set<string>();

  // Blocs courants : la vérité de ce qu'affiche la page maintenant.
  const blocks = await client.block.findMany({
    where: { pageId },
    select: { content: true },
  });
  for (const block of blocks) collectAssetIds(block.content, referenced);

  // Versions conservées : l'historique doit rester affichable.
  const versions = await client.pageVersion.findMany({
    where: { pageId },
    select: { content: true },
  });
  for (const version of versions) collectAssetIds(version.content, referenced);

  const { count } = await client.asset.deleteMany({
    where: {
      pageId,
      ...(referenced.size > 0 ? { id: { notIn: [...referenced] } } : {}),
    },
  });

  return count;
}
