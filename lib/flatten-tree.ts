import type { PageWithChildren } from "@/lib/types";

export type FlattenedPage = {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
};

/** Depth-first flattening of the page tree, respecting each level's order
 * and skipping the subtree of any collapsed page. */
export function flattenTree(
  tree: PageWithChildren[],
  expandedIds: Set<string>
): FlattenedPage[] {
  const result: FlattenedPage[] = [];

  function walk(pages: PageWithChildren[], depth: number) {
    for (const page of pages) {
      const hasChildren = page.children.length > 0;
      result.push({
        id: page.id,
        title: page.title,
        icon: page.icon,
        parentId: page.parentId,
        depth,
        hasChildren,
      });
      if (hasChildren && expandedIds.has(page.id)) {
        walk(page.children, depth + 1);
      }
    }
  }

  walk(tree, 0);
  return result;
}

/** True if `maybeAncestorId` is `id` itself or one of its ancestors in the
 * flattened list — used to block dropping a page onto its own subtree. */
export function isSelfOrDescendant(
  flat: FlattenedPage[],
  id: string,
  candidateId: string
): boolean {
  if (id === candidateId) return true;
  const byId = new Map(flat.map((p) => [p.id, p]));
  let current = byId.get(candidateId);
  while (current?.parentId) {
    if (current.parentId === id) return true;
    current = byId.get(current.parentId);
  }
  return false;
}
