import { db } from "@/lib/db";
import type { PageWithChildren } from "@/lib/types";
import type { Page } from "@/app/generated/prisma/client";

export async function getArchivedPages(workspaceId: string): Promise<Page[]> {
  return db.page.findMany({
    where: { workspaceId, isArchived: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPageTree(workspaceId: string): Promise<PageWithChildren[]> {
  const pages = await db.page.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { order: "asc" },
  });

  const byParent = new Map<string | null, Page[]>();
  for (const page of pages) {
    const key = page.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(page);
  }

  function attachChildren(page: Page): PageWithChildren {
    return {
      ...page,
      children: (byParent.get(page.id) ?? []).map(attachChildren),
    };
  }

  return (byParent.get(null) ?? []).map(attachChildren);
}

/** Ancestor chain of a page, root first, including the page itself — the
 * breadcrumb trail. Walks up parent by parent, which is a handful of
 * queries at most since the sidebar tree is only a few levels deep. */
/**
 * Fil d'Ariane d'une page.
 *
 * `workspaceId` est exigé : sans lui, remonter l'arbre par `pageId` seul
 * renvoyait le fil de n'importe quelle page, y compris dans l'espace d'un
 * autre compte. La boucle s'arrête donc dès qu'un parent sort de l'espace.
 */
export async function getPageBreadcrumb(
  pageId: string,
  workspaceId: string
): Promise<Page[]> {
  const trail: Page[] = [];
  let currentId: string | null = pageId;
  // Garde-fou : une boucle parent/enfant corrompue en base ne doit pas
  // faire tourner la requête indéfiniment.
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const page: Page | null = await db.page.findFirst({
      where: { id: currentId, workspaceId },
    });
    if (!page) break;
    trail.unshift(page);
    currentId = page.parentId;
  }

  return trail;
}

/** Most recently edited pages, for the home screen's quick-resume list. */
export async function getRecentPages(
  workspaceId: string,
  take = 6
): Promise<Page[]> {
  return db.page.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

/** Page counts shown on the home screen. */
export async function getWorkspaceStats(workspaceId: string) {
  const [pageCount, archivedCount] = await Promise.all([
    db.page.count({ where: { workspaceId, isArchived: false } }),
    db.page.count({ where: { workspaceId, isArchived: true } }),
  ]);
  return { pageCount, archivedCount };
}
