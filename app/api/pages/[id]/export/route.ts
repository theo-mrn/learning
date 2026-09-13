import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPageDocument } from "@/lib/blocks";
import { docToMarkdown } from "@/lib/markdown-export";
import { ForbiddenError, UnauthorizedError, requirePageAccess } from "@/lib/dal";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/pages/[id]/export">
) {
  const { id } = await params;

  // L'export livre le contenu complet de la page : sans contrôle, un id
  // suffisait à aspirer les notes de n'importe qui.
  try {
    // Lecture : exporter ne modifie rien, un membre en lecture seule y a
    // droit. Sans ce paramètre, le défaut `"write"` le lui refuserait.
    await requirePageAccess(id, "read");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    throw error;
  }

  const page = await db.page.findUnique({ where: { id } });
  if (!page || page.isArchived) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const document = await getPageDocument(id);
  const markdown = `# ${page.title}\n\n${docToMarkdown(document)}`;

  const safeTitle = page.title.trim() || "untitled";
  // ASCII-only fallback for the plain `filename` param (older clients),
  // plus an RFC 5987 `filename*` param so accented titles still come
  // through correctly for clients that support it.
  const asciiFallback =
    safeTitle.replace(/[^\w\-\s]/g, "").trim() || "untitled";

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFallback}.md"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.md`,
    },
  });
}
