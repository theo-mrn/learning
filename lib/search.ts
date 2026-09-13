"use server";

import { db } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";

export type SearchResult = {
  id: string;
  title: string;
  icon: string | null;
  /** Short snippet of matching block content, if the match wasn't in the title. */
  snippet: string | null;
};

const MAX_RESULTS = 20;
const SNIPPET_CONTEXT = 30;

export async function searchPages(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const workspace = await getActiveWorkspace();

  const titleMatches = await db.page.findMany({
    where: {
      workspaceId: workspace.id,
      isArchived: false,
      title: { contains: q, mode: "insensitive" },
    },
    take: MAX_RESULTS,
    orderBy: { updatedAt: "desc" },
  });

  const remaining = MAX_RESULTS - titleMatches.length;
  const excludeIds = titleMatches.map((p) => p.id);

  const contentMatches =
    remaining > 0
      ? await db.page.findMany({
          where: {
            workspaceId: workspace.id,
            isArchived: false,
            id: { notIn: excludeIds },
            blocks: {
              some: {
                textContent: { contains: q, mode: "insensitive" },
              },
            },
          },
          take: remaining,
          orderBy: { updatedAt: "desc" },
          include: {
            blocks: {
              where: { textContent: { contains: q, mode: "insensitive" } },
              take: 1,
            },
          },
        })
      : [];

  return [
    ...titleMatches.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      snippet: null,
    })),
    ...contentMatches.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      snippet: p.blocks[0] ? buildSnippet(p.blocks[0].textContent, q) : null,
    })),
  ];
}

function buildSnippet(text: string, query: string): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, 60);

  const start = Math.max(0, index - SNIPPET_CONTEXT);
  const end = Math.min(text.length, index + query.length + SNIPPET_CONTEXT);
  return (
    (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "")
  );
}
