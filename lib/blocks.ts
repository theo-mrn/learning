import { db } from "@/lib/db";
import type { JSONContent } from "@tiptap/core";

/**
 * Reassembles the stored Block rows for a page back into the single
 * ProseMirror/Tiptap JSON document the editor expects. Each top-level
 * Block's `content` already holds its own nested subtree as JSON, so
 * this only needs to order the top-level rows.
 */
export async function getPageDocument(pageId: string): Promise<JSONContent> {
  const blocks = await db.block.findMany({
    where: { pageId, parentId: null },
    orderBy: { order: "asc" },
  });

  return {
    type: "doc",
    content: blocks.map((block: { content: unknown }) => block.content as JSONContent),
  };
}

/**
 * Le document **et** la version du contenu sur laquelle il a été lu.
 *
 * L'éditeur doit renvoyer cette version à chaque sauvegarde : c'est ce qui
 * permet au serveur de refuser une écriture fondée sur un état périmé, au lieu
 * d'écraser le travail d'un autre membre de l'espace.
 */
export async function getPageDocumentWithVersion(
  pageId: string
): Promise<{ document: JSONContent; version: number }> {
  const [document, page] = await Promise.all([
    getPageDocument(pageId),
    db.page.findUniqueOrThrow({
      where: { id: pageId },
      select: { contentVersion: true },
    }),
  ]);

  return { document, version: page.contentVersion };
}
