import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requirePageAccess,
  requireUserOrThrow,
} from "@/lib/dal";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  processImage,
} from "@/lib/assets";

/** Le corps est un binaire : on ne veut ni cache ni pré-rendu. */
export const dynamic = "force-dynamic";

/**
 * Téléverse une image dans une page. Les octets ne transitent jamais par le
 * document Tiptap — ils sont écrits ici, et le bloc ne conserve qu'un id.
 * C'est ce qui évite de resérialiser chaque image à chaque sauvegarde.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/pages/[id]/assets">
) {
  const { id: pageId } = await params;

  // Téléverser dans la page d'autrui doit être impossible : l'ancien code ne
  // vérifiait que l'existence de la page, pas le droit d'y écrire.
  try {
    await requirePageAccess(pageId);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Page introuvable" }, { status: 404 });
    }
    throw error;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (25 Mo maximum)" },
      { status: 413 }
    );
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Format non pris en charge : ${file.type || "inconnu"}` },
      { status: 415 }
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImage(input);
  } catch {
    // Un fichier annoncé comme image mais illisible par sharp : on refuse
    // plutôt que de stocker des octets qu'on ne saura jamais réafficher.
    return NextResponse.json(
      { error: "Image illisible ou corrompue" },
      { status: 422 }
    );
  }

  const user = await requireUserOrThrow();

  // Même image collée deux fois : on réutilise la ligne existante au lieu de
  // dupliquer le binaire. L'unicité (pageId, checksum) garantit la course.
  const asset = await db.asset.upsert({
    where: {
      pageId_checksum: { pageId, checksum: processed.checksum },
    },
    update: {},
    create: {
      pageId,
      filename: file.name || "image",
      mimeType: processed.mimeType,
      size: processed.size,
      width: processed.width,
      height: processed.height,
      checksum: processed.checksum,
      data: processed.data,
      createdById: user.id,
    },
    // Surtout pas de `select: *` : renvoyer `data` ferait repasser le binaire
    // par la réponse JSON, exactement ce qu'on cherche à éviter.
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      width: true,
      height: true,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
