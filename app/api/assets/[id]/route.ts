import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError, requireAssetAccess } from "@/lib/dal";

export const dynamic = "force-dynamic";

/**
 * Sert les octets d'une image. Le contenu d'un id donné ne change jamais
 * (une modification produit une nouvelle empreinte, donc un nouvel id), d'où
 * le cache `immutable` : le navigateur ne redemandera pas l'image.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/assets/[id]">
) {
  const { id } = await params;

  // Sans ce contrôle, connaître un id suffisait à lire l'image de n'importe
  // qui : une URL d'asset était un accès universel.
  try {
    const allowed = await requireAssetAccess(id);
    if (!allowed) {
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      // 404 plutôt que 403 : répondre « interdit » confirmerait que cet id
      // existe, ce qui renseigne un curieux sur le contenu d'autrui.
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }
    throw error;
  }

  const asset = await db.asset.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      filename: true,
      checksum: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
  }

  // L'empreinte fait un ETag naturel : elle décrit exactement les octets.
  const etag = `"${asset.checksum}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const body = new Uint8Array(asset.data);

  return new NextResponse(body, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(body.byteLength),
      // `private` : le contenu est propre à un utilisateur, un cache partagé
      // (CDN, proxy d'entreprise) ne doit pas le resservir à quelqu'un d'autre.
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      // `inline` : l'image s'affiche dans la page au lieu de se télécharger.
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
      // Les octets viennent d'un téléversement utilisateur : on interdit au
      // navigateur de renifler un autre type que celui qu'on annonce.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
