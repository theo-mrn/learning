import { createHash } from "node:crypto";
import sharp from "sharp";

/** Au-delà, on refuse le fichier : une photo de téléphone dépasse rarement
 * ça, et laisser passer 50 Mo remplirait la base pour rien. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Côté le plus long après redimensionnement. Une capture de cours reste
 * parfaitement lisible à cette taille, et le poids chute d'un ordre de
 * grandeur par rapport à l'original. */
const MAX_DIMENSION = 2000;

const WEBP_QUALITY = 82;

/** Formats acceptés à l'entrée. Le SVG est exclu volontairement : c'est un
 * document capable d'embarquer du script, et on le renverrait ensuite au
 * navigateur depuis notre propre origine. */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
];

export type ProcessedImage = {
  /** `Uint8Array` et non `Buffer` : Prisma type une colonne `Bytes` en
   * `Uint8Array<ArrayBuffer>`, alors que sharp renvoie un `Buffer` adossé à
   * un `ArrayBufferLike`. La conversion est faite ici, une fois, pour que les
   * appelants n'aient jamais à s'en préoccuper. */
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
  checksum: string;
};

/** Recopie les octets dans un `ArrayBuffer` qui lui est propre. Le type de
 * retour est explicite : `Uint8Array` seul vaut `Uint8Array<ArrayBufferLike>`,
 * que Prisma refuse. */
function toUint8Array(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy;
}

/**
 * Normalise une image avant stockage : redimensionnement si elle dépasse
 * `MAX_DIMENSION`, conversion WebP, puis empreinte SHA-256 des octets finaux.
 *
 * L'empreinte est calculée après traitement, pas avant : c'est ce qui est
 * réellement stocké qu'on dédoublonne, et deux sources différentes donnant
 * le même WebP doivent partager une seule ligne.
 *
 * Le GIF animé est laissé intact : le convertir en WebP fixe perdrait
 * l'animation, ce qui serait une surprise désagréable.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const image = sharp(input, { animated: true });
  const metadata = await image.metadata();

  const isAnimated = (metadata.pages ?? 1) > 1;

  let data: Buffer;
  let mimeType: string;

  if (isAnimated) {
    data = input;
    mimeType = metadata.format === "gif" ? "image/gif" : "image/webp";
  } else {
    const needsResize =
      (metadata.width ?? 0) > MAX_DIMENSION ||
      (metadata.height ?? 0) > MAX_DIMENSION;

    let pipeline = sharp(input).rotate(); // `rotate()` applique l'orientation EXIF
    if (needsResize) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    data = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    mimeType = "image/webp";
  }

  // Dimensions relues sur le résultat : après redimensionnement et rotation
  // EXIF, celles de l'original ne décrivent plus ce qu'on stocke.
  const finalMeta = await sharp(data, { animated: true }).metadata();

  return {
    data: toUint8Array(data),
    mimeType,
    width: finalMeta.width ?? null,
    // Sur une image animée, `height` couvre toutes les trames empilées.
    height: isAnimated
      ? Math.round((finalMeta.height ?? 0) / (finalMeta.pages ?? 1)) || null
      : (finalMeta.height ?? null),
    size: data.byteLength,
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}
