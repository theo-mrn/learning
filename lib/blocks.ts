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
