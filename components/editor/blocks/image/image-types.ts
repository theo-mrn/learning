/** Une image du bloc. Le document ne conserve qu'un identifiant : les octets
 * vivent dans la table `assets` et sont servis par `/api/assets/<id>`.
 * C'est la décision structurante de ce bloc — mettre le binaire dans le
 * document ferait resérialiser chaque image à chaque sauvegarde. */
export interface GalleryImage {
  /** `null` tant que le téléversement est en cours. */
  assetId: string | null;
  caption: string;
  alt: string;
  width: number | null;
  height: number | null;
  /** URL temporaire (`blob:`) affichée pendant le téléversement, pour que
   * l'image apparaisse immédiatement au lieu d'un carré vide. */
  previewUrl?: string;
  /** Renseigné si le téléversement a échoué : l'entrée reste visible avec son
   * message plutôt que de disparaître sans explication. */
  error?: string;
}

export type ImageLayout = "single" | "grid";

export interface ImageBlockAttrs {
  images: GalleryImage[];
  layout: ImageLayout;
  /** Largeur d'affichage en pourcentage de la colonne, pour le mode `single`. */
  scale: number;
}

export const DEFAULT_SCALE = 100;
export const MIN_SCALE = 25;

export function assetUrl(assetId: string): string {
  return `/api/assets/${assetId}`;
}

/** Source à afficher : l'aperçu local tant que l'image n'est pas téléversée,
 * l'URL définitive ensuite. */
export function imageSrc(image: GalleryImage): string | null {
  if (image.assetId) return assetUrl(image.assetId);
  return image.previewUrl ?? null;
}

export function isUploading(image: GalleryImage): boolean {
  return !image.assetId && !image.error;
}
