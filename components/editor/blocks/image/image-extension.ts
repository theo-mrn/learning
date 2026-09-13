import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageBlockComponent } from "./image-block";
import { DEFAULT_SCALE, type GalleryImage, type ImageLayout } from "./image-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (options?: { images?: GalleryImage[] }) => ReturnType;
    };
  }
}

function parseJsonAttribute<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Retire l'aperçu local : une URL `blob:` ne vaut que pour l'onglet qui l'a
 * créée, la stocker ou la relire donnerait une image cassée. */
function withoutPreview(image: GalleryImage): GalleryImage {
  const stripped: GalleryImage = { ...image };
  delete stripped.previewUrl;
  return stripped;
}

export const ImageExtension = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  // Comme le tableau blanc : `draggable` ferait démarrer à ProseMirror une
  // sélection de nœud dès le `mousedown`, ce qui volerait le geste au
  // redimensionnement et au glisser-déposer de fichiers.
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      images: {
        default: [] as GalleryImage[],
        parseHTML: (element) => {
          const parsed = parseJsonAttribute<GalleryImage[]>(
            element.getAttribute("data-images"),
            []
          );
          return Array.isArray(parsed) ? parsed.map(withoutPreview) : [];
        },
        renderHTML: (attributes) => ({
          "data-images": JSON.stringify(
            ((attributes.images ?? []) as GalleryImage[]).map(withoutPreview)
          ),
        }),
      },
      layout: {
        default: "single" as ImageLayout,
        parseHTML: (element) =>
          (element.getAttribute("data-layout") as ImageLayout) || "single",
        renderHTML: (attributes) => ({ "data-layout": attributes.layout }),
      },
      scale: {
        default: DEFAULT_SCALE,
        parseHTML: (element) =>
          Number(element.getAttribute("data-scale")) || DEFAULT_SCALE,
        renderHTML: (attributes) => ({ "data-scale": String(attributes.scale) }),
      },
      /** Fichiers collés ou déposés, transmis au NodeView qui les téléverse.
       * `rendered: false` : ce sont des objets `File`, ils n'ont rien à faire
       * dans le HTML sérialisé et ne doivent pas survivre à la sauvegarde. */
      pendingFiles: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "image-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockComponent, {
      stopEvent: () => true,
      update: (props) => {
        if (props.newNode.type !== props.oldNode.type) return false;
        props.updateProps();
        return true;
      },
    });
  },

  addCommands() {
    return {
      insertImageBlock:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              images: options?.images ?? [],
              layout: "single",
              scale: DEFAULT_SCALE,
            },
          }),
    };
  },
});
