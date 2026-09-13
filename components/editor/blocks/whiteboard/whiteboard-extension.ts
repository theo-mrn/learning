import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { WhiteboardBlockComponent } from "./whiteboard-block";
import {
  WHITEBOARD_DEFAULT_HEIGHT,
  WHITEBOARD_DEFAULT_TITLE,
} from "./whiteboard-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    whiteboard: {
      insertWhiteboard: () => ReturnType;
    };
  }
}

export const WhiteboardExtension = Node.create({
  name: "whiteboard",
  group: "block",
  atom: true,
  // Surtout pas `draggable` : ProseMirror installerait alors sa propre
  // gestion de glisser sur le bloc et démarrerait une sélection de nœud dès
  // le `mousedown`. Le geste partait vers l'éditeur de page au lieu du
  // canvas — curseur de sélection de texte, liseré de sélection autour du
  // bloc, et trait qui n'apparaissait qu'au relâchement.
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      title: {
        default: WHITEBOARD_DEFAULT_TITLE,
        parseHTML: (element) =>
          element.getAttribute("data-title") || WHITEBOARD_DEFAULT_TITLE,
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      height: {
        default: WHITEBOARD_DEFAULT_HEIGHT,
        parseHTML: (element) => {
          const raw = Number(element.getAttribute("data-height"));
          return Number.isFinite(raw) && raw > 0 ? raw : WHITEBOARD_DEFAULT_HEIGHT;
        },
        renderHTML: (attributes) => ({ "data-height": String(attributes.height) }),
      },
      snapshot: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-snapshot");
          if (!raw) return null;
          try {
            return JSON.parse(raw);
          } catch {
            // Instantané corrompu : le tableau repart vierge plutôt que de
            // faire échouer le parsing de toute la page.
            return null;
          }
        },
        renderHTML: (attributes) =>
          attributes.snapshot
            ? { "data-snapshot": JSON.stringify(attributes.snapshot) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="whiteboard"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "whiteboard" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WhiteboardBlockComponent, {
      // tldraw gère lui-même clavier, pointeur et presse-papiers : ProseMirror
      // ne doit intercepter aucun événement à l'intérieur du canvas.
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
      insertWhiteboard:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              title: WHITEBOARD_DEFAULT_TITLE,
              height: WHITEBOARD_DEFAULT_HEIGHT,
              snapshot: null,
            },
          }),
    };
  },
});
