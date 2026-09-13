import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Attributs de style que TableKit ne fournit pas.
 *
 * Les cellules ont déjà `align` (et colspan/rowspan/colwidth) en natif :
 * seules la couleur de remplissage et la couleur de texte manquent, plus un
 * marqueur de lignes alternées sur le tableau lui-même.
 *
 * Tout est stocké en attribut de nœud, donc sauvegardé avec le document par
 * le mécanisme de blocs existant — rien à changer côté persistance.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableStyling: {
      /** Couleur de fond des cellules sélectionnées (null pour retirer). */
      setCellBackground: (color: string | null) => ReturnType;
      /** Couleur du texte des cellules sélectionnées (null pour retirer). */
      setCellTextColor: (color: string | null) => ReturnType;
      /** Alignement horizontal des cellules sélectionnées. */
      setCellAlign: (
        align: "left" | "center" | "right" | "justify" | null
      ) => ReturnType;
      /** Active/désactive le zébrage des lignes du tableau courant. */
      toggleTableStriped: () => ReturnType;
    };
  }
}

/** Rend une valeur de couleur sûre à écrire dans un attribut `style` : on
 * n'accepte que des formes de couleur connues, pour qu'une valeur venue d'un
 * collage ne puisse pas injecter d'autres déclarations CSS. */
function safeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  const ok =
    /^#[0-9a-f]{3,8}$/i.test(v) ||
    /^rgba?\([\d\s.,%/]+\)$/i.test(v) ||
    /^oklch\([\d\s.,%/-]+\)$/i.test(v) ||
    /^[a-z]+$/i.test(v);
  return ok ? v : null;
}

export const TableStyling = Extension.create({
  name: "tableStyling",

  addGlobalAttributes() {
    return [
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) =>
              safeColor(
                element.style.backgroundColor ||
                  element.getAttribute("data-background-color")
              ),
            renderHTML: (attributes) => {
              const color = safeColor(attributes.backgroundColor);
              if (!color) return {};
              // On expose la teinte en variable et on laisse le CSS
              // décider comment la poser (voile, et dosage par thème) :
              // un aplat direct rendrait le texte illisible en sombre.
              return {
                "data-background-color": color,
                style: `--cell-fill: ${color}`,
              };
            },
          },
          textColor: {
            default: null,
            parseHTML: (element) =>
              safeColor(
                element.style.color || element.getAttribute("data-text-color")
              ),
            renderHTML: (attributes) => {
              const color = safeColor(attributes.textColor);
              if (!color) return {};
              return {
                "data-text-color": color,
                style: `color: ${color}`,
              };
            },
          },
        },
      },
      {
        types: ["table"],
        attributes: {
          striped: {
            default: false,
            parseHTML: (element) =>
              element.getAttribute("data-striped") === "true" ||
              element.closest("[data-striped='true']") !== null,
            // Pas de `renderHTML` utile ici : avec `resizable: true`,
            // TableKit rend le tableau via son propre TableView, qui
            // construit le <table> et ignore les attributs rendus. Le
            // marqueur est donc posé par la décoration ci-dessous.
            renderHTML: (attributes) =>
              attributes.striped ? { "data-striped": "true" } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tableStripedDecoration"),
        props: {
          // Une décoration de nœud ajoute la classe sur l'élément que le
          // TableView a créé, ce que `renderHTML` ne peut pas faire.
          decorations: (state) => {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "table" && node.attrs.striped) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    "data-striped": "true",
                  })
                );
              }
            });
            return decorations.length
              ? DecorationSet.create(state.doc, decorations)
              : null;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setCellBackground:
        (color) =>
        ({ commands }) =>
          commands.setCellAttribute("backgroundColor", safeColor(color)),

      setCellTextColor:
        (color) =>
        ({ commands }) =>
          commands.setCellAttribute("textColor", safeColor(color)),

      setCellAlign:
        (align) =>
        ({ commands }) =>
          commands.setCellAttribute("align", align),

      // Le zébrage vit sur le nœud `table`, pas sur les cellules : il faut
      // remonter jusqu'à lui depuis la position courante.
      toggleTableStriped:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === "table") {
              const pos = $from.before(depth);
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  striped: !node.attrs.striped,
                });
                dispatch(tr);
              }
              return true;
            }
          }
          return false;
        },
    };
  },
});
