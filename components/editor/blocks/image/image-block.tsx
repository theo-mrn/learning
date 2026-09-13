"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  AlertCircle,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePageId } from "./image-page-context";
import { useBlockEditable } from "../common/use-block-editable";
import { ImageLightbox } from "./image-lightbox";
import {
  DEFAULT_SCALE,
  MIN_SCALE,
  imageSrc,
  isUploading,
  type GalleryImage,
  type ImageLayout,
} from "./image-types";

export function ImageBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const canEdit = useBlockEditable(editor);
  const images = (node.attrs.images as GalleryImage[]) ?? [];
  const layout = (node.attrs.layout as ImageLayout) ?? "single";
  const scale = Number(node.attrs.scale) || DEFAULT_SCALE;

  const pageId = usePageId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Les URL `blob:` sont des ressources du navigateur : sans révocation
  // explicite, elles restent en mémoire jusqu'au rechargement de l'onglet.
  const previewUrls = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  // `node` et `updateAttributes` sont recréés à chaque transaction, mais les
  // fonctions asynchrones ci-dessous vivent plus longtemps qu'un rendu : si
  // elles lisent `node.attrs` par fermeture, elles travaillent sur une liste
  // périmée. Ces refs pointent toujours sur les valeurs du rendu courant.
  // La synchronisation passe par un effet : écrire dans une ref pendant le
  // rendu est interdit (react-hooks/refs). L'effet s'exécute après chaque
  // rendu, donc avant tout gestionnaire d'événement ou effet qui appellerait
  // `uploadFiles` — les refs y sont toujours à jour.
  const nodeRef = useRef(node);
  const updateAttributesRef = useRef(updateAttributes);
  useEffect(() => {
    nodeRef.current = node;
    updateAttributesRef.current = updateAttributes;
  });

  /** Lit la liste au moment de l'appel, jamais celle capturée à la création
   * de la fonction. C'était le bug : `patchImage` réécrivait la liste telle
   * qu'elle était AVANT l'ajout des aperçus, ce qui les effaçait — l'image
   * apparaissait puis disparaissait, laissant le bloc vide. */
  const currentImages = useCallback(
    (): GalleryImage[] => (nodeRef.current.attrs.images as GalleryImage[]) ?? [],
    []
  );

  const patchImage = useCallback(
    (previewUrl: string, patch: Partial<GalleryImage>) => {
      updateAttributesRef.current({
        images: currentImages().map((img) =>
          img.previewUrl === previewUrl ? { ...img, ...patch } : img
        ),
      });
    },
    [currentImages]
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      if (!pageId) {
        // Sans page cible, l'octet n'a nulle part où aller. Mieux vaut le
        // dire que d'afficher une image qui disparaîtra au rechargement.
        updateAttributesRef.current({
          images: [
            ...currentImages(),
            {
              assetId: null,
              caption: "",
              alt: "",
              width: null,
              height: null,
              error: "Page inconnue : téléversement impossible",
            },
          ],
        });
        return;
      }

      // Les entrées apparaissent tout de suite avec leur aperçu local : sur
      // une photo de plusieurs Mo, attendre la réponse donnerait l'impression
      // que le collage n'a rien fait.
      const pending = imageFiles.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);
        return { file, previewUrl };
      });

      const current = currentImages();
      updateAttributesRef.current({
        images: [
          ...current,
          ...pending.map(({ previewUrl }) => ({
            assetId: null,
            caption: "",
            alt: "",
            width: null,
            height: null,
            previewUrl,
          })),
        ],
        // Plusieurs images d'un coup : la grille est la disposition utile.
        layout:
          current.length + pending.length > 1
            ? "grid"
            : (nodeRef.current.attrs.layout as ImageLayout),
        // Vidé dans la MÊME transaction que l'ajout des aperçus. Le faire
        // dans un dispatch séparé juste avant créait une course : cette
        // écriture-ci était construite sur un instantané du nœud antérieur
        // et ProseMirror la rejetait, laissant le bloc vide.
        pendingFiles: null,
      });

      // Séquentiel et non parallèle : dix photos de 8 Mo lancées ensemble
      // saturent la connexion et le serveur pour un gain nul.
      let succeeded = 0;
      const failures: string[] = [];

      for (const { file, previewUrl } of pending) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(`/api/pages/${pageId}/assets`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const message = payload?.error ?? "Échec du téléversement";
            patchImage(previewUrl, { error: message });
            failures.push(`${file.name} : ${message}`);
            continue;
          }

          const asset = await response.json();
          patchImage(previewUrl, {
            assetId: asset.id,
            alt: asset.filename ?? "",
            width: asset.width ?? null,
            height: asset.height ?? null,
            error: undefined,
          });
          succeeded += 1;
        } catch {
          patchImage(previewUrl, { error: "Échec du téléversement" });
          failures.push(`${file.name} : envoi impossible`);
        }
      }

      // Un seul toast pour tout le lot : dix photos donneraient dix
      // notifications empilées, illisibles.
      if (succeeded > 0) {
        toast.success(
          succeeded === 1
            ? "Image enregistrée"
            : `${succeeded} images enregistrées`
        );
      }
      if (failures.length > 0) {
        toast.error(
          failures.length === 1
            ? "Échec du téléversement"
            : `${failures.length} images ont échoué`,
          // Le détail nomme les fichiers : « 3 images ont échoué » sans dire
          // lesquelles n'aide en rien.
          { description: failures.join("\n") }
        );
      }
    },
    // Volontairement stable : toutes les valeurs changeantes passent par les
    // refs ci-dessus. Une dépendance sur `node.attrs` recréerait la fonction
    // en plein téléversement et ramènerait le bug de liste périmée.
    [pageId, currentImages, patchImage]
  );

  // Fichiers arrivés par un collage/dépôt au niveau du document : le bloc
  // vient d'être créé pour eux. `uploadFiles` remet `pendingFiles` à null
  // dans sa propre écriture, donc l'envoi n'est déclenché qu'une fois.
  //
  // Le garde-fou ne peut pas être `node.attrs` : cet objet change à chaque
  // transaction, et `uploadFiles` change d'identité avec lui. On mémorise
  // donc le tableau déjà traité par référence.
  const handledFiles = useRef<File[] | null>(null);
  useEffect(() => {
    const pending = node.attrs.pendingFiles as File[] | null;
    if (!pending || pending.length === 0) return;
    if (handledFiles.current === pending) return;
    handledFiles.current = pending;
    uploadFiles(pending);
  }, [node.attrs.pendingFiles, uploadFiles]);

  function removeImage(index: number) {
    updateAttributes({ images: images.filter((_, i) => i !== index) });
  }

  function setCaption(index: number, caption: string) {
    updateAttributes({
      images: images.map((img, i) => (i === index ? { ...img, caption } : img)),
    });
  }

  const hasImages = images.length > 0;

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="image-node-view not-prose my-6 w-full"
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        // Dépôt et collage sont des téléversements : inertes en lecture seule.
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setIsDragOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          if (!canEdit) return;
          const files = Array.from(e.clipboardData.files);
          if (files.length > 0) {
            e.preventDefault();
            uploadFiles(files);
          }
        }}
        className={`relative w-full rounded-2xl border transition-colors ${
          isDragOver
            ? "border-primary/60 bg-primary/5"
            : selected
              ? "border-primary/50 bg-card/50"
              : "border-border/70 bg-card/50"
        }`}
      >
        {/* En-tête : n'apparaît qu'une fois des images présentes, pour que
            l'état vide reste une simple zone de dépôt. */}
        {hasImages && (
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
            <span className="text-[0.7rem] text-muted-foreground">
              {images.length} image{images.length > 1 ? "s" : ""}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  updateAttributes({
                    layout: layout === "grid" ? "single" : "grid",
                  })
                }
                title={
                  layout === "grid"
                    ? "Affichage en colonne"
                    : "Affichage en grille"
                }
                className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                {layout === "grid" ? (
                  <Square className="size-3.5" />
                ) : (
                  <LayoutGrid className="size-3.5" />
                )}
              </button>

              <button
                type="button"
                hidden={!canEdit}
                onClick={() => fileInputRef.current?.click()}
                title="Ajouter des images"
                className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                <ImagePlus className="size-3.5" />
              </button>

              {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Options du bloc image"
                      className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {layout === "single" && (
                    <>
                      <div className="px-2 py-1.5">
                        <label className="mb-1 block text-[0.65rem] font-medium text-muted-foreground">
                          Largeur : {scale}%
                        </label>
                        <input
                          type="range"
                          min={MIN_SCALE}
                          max={100}
                          step={5}
                          value={scale}
                          onChange={(e) =>
                            updateAttributes({ scale: Number(e.target.value) })
                          }
                          className="w-full accent-primary"
                        />
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={deleteNode}>
                    <Trash2 className="size-3.5" />
                    Supprimer le bloc
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </div>
          </div>
        )}

        {/* État vide : zone de dépôt */}
        {!hasImages ? (
          canEdit ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl px-4 py-10 text-muted-foreground transition-colors hover:bg-muted/40"
            >
              <Upload className="size-6 opacity-60" />
              <span className="text-sm font-medium">
                Clique, colle ou dépose une image
              </span>
              <span className="text-xs text-muted-foreground/70">
                JPEG, PNG, WebP, GIF, HEIC — 25 Mo maximum
              </span>
            </button>
          ) : (
            // Bloc vide en lecture seule : on le dit, sans proposer d'action.
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune image dans ce bloc.
            </p>
          )
        ) : (
          <div
            className={
              layout === "grid"
                ? "grid grid-cols-2 gap-2 p-2 sm:grid-cols-3"
                : "flex flex-col items-center gap-3 p-2"
            }
          >
            {images.map((image, index) => {
              const src = imageSrc(image);
              const uploading = isUploading(image);

              return (
                <figure
                  key={image.assetId ?? image.previewUrl ?? index}
                  className="group/img relative m-0 flex flex-col gap-1"
                  style={
                    layout === "single" ? { width: `${scale}%` } : undefined
                  }
                >
                  <div className="relative overflow-hidden rounded-lg bg-muted/40">
                    {src ? (
                      // Ces images sont servies par notre propre Route
                      // Handler, déjà redimensionnées et mises en cache
                      // `immutable` : `next/image` n'apporterait rien et
                      // exigerait de connaître les dimensions à l'avance.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={image.alt || image.caption || ""}
                        onClick={() => !uploading && setLightboxIndex(index)}
                        className={`block w-full cursor-zoom-in object-contain transition-opacity ${
                          uploading ? "opacity-50" : ""
                        } ${layout === "grid" ? "aspect-square object-cover" : ""}`}
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center" />
                    )}

                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {image.error && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/10 px-2 text-center">
                        <AlertCircle className="size-4 text-destructive" />
                        <span className="text-[0.65rem] font-medium text-destructive">
                          {image.error}
                        </span>
                      </div>
                    )}

                    {/* Actions par image, au survol */}
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
                      {!uploading && !image.error && (
                        <button
                          type="button"
                          onClick={() => setLightboxIndex(index)}
                          aria-label="Voir en plein écran"
                          className="flex size-6 items-center justify-center rounded bg-background/80 text-foreground backdrop-blur-sm hover:bg-background"
                        >
                          <Maximize2 className="size-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        hidden={!canEdit}
                        onClick={() => removeImage(index)}
                        aria-label="Retirer l'image"
                        className="flex size-6 items-center justify-center rounded bg-background/80 text-destructive backdrop-blur-sm hover:bg-background"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  <figcaption>
                    <input
                      value={image.caption}
                      readOnly={!canEdit}
                      onChange={(e) => setCaption(index, e.target.value)}
                      placeholder={canEdit ? "Légende…" : ""}
                      className="w-full bg-transparent text-center text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                    />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            // Réinitialisé pour que resélectionner le même fichier déclenche
            // bien un nouvel événement `change`.
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </NodeViewWrapper>
  );
}
