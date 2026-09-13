"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { imageSrc, type GalleryImage } from "./image-types";

/**
 * Vue plein écran. Rendue dans un portail sur `document.body` : à l'intérieur
 * du NodeView, elle serait prisonnière du conteneur de l'éditeur (et de ses
 * `overflow`), et ProseMirror pourrait la démonter sur une transaction.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const count = images.length;

  const goPrevious = useCallback(
    () => onIndexChange((index - 1 + count) % count),
    [index, count, onIndexChange]
  );
  const goNext = useCallback(
    () => onIndexChange((index + 1) % count),
    [index, count, onIndexChange]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") goPrevious();
      else if (event.key === "ArrowRight") goNext();
      else return;
      // La touche ne doit pas continuer vers l'éditeur : une flèche y
      // déplacerait le curseur sous la vue plein écran.
      event.preventDefault();
      event.stopPropagation();
    }
    // Phase de capture : ProseMirror écoute aussi le clavier.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, goPrevious, goNext]);

  // La page de fond ne doit pas défiler pendant l'affichage.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const image = images[index];
  const src = image ? imageSrc(image) : null;
  if (!src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || image.alt || "Image en plein écran"}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="size-4" />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrevious();
            }}
            aria-label="Image précédente"
            className="absolute left-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Image suivante"
            className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Le clic sur l'image ne ferme pas : seul le fond le fait. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={image.alt || image.caption || ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] object-contain"
      />

      {(image.caption || count > 1) && (
        <div className="mt-3 flex flex-col items-center gap-1 text-white/80">
          {image.caption && <p className="text-sm">{image.caption}</p>}
          {count > 1 && (
            <span className="text-xs tabular-nums text-white/50">
              {index + 1} / {count}
            </span>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
