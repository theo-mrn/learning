import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { KanbanBlockComponent } from "./kanban-block";
import type { KanbanColumn } from "./kanban-types";

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "col-todo",
    title: "À faire",
    color: "slate",
    cards: [],
  },
  {
    id: "col-in-progress",
    title: "En cours",
    color: "amber",
    cards: [],
  },
  {
    id: "col-done",
    title: "Terminé",
    color: "emerald",
    cards: [],
  },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    kanban: {
      insertKanban: () => ReturnType;
    };
  }
}

export const KanbanExtension = Node.create({
  name: "kanban",
  group: "block",
  atom: true,
  // Surtout pas `draggable: true` : ProseMirror installe alors sa propre
  // gestion du glisser et démarre une sélection de nœud dès l'interaction.
  // Cette sélection recrée le nœud depuis son état d'origine JUSTE APRÈS
  // notre `updateAttributes`, et l'annule silencieusement — les cartes
  // créées n'apparaissaient jamais et n'atteignaient jamais la base.
  // Constaté au navigateur : la trace montrait `col-todo:1` écrit, puis
  // `col-todo:0` cent millisecondes plus tard.
  // Même cause que le bug du tableau blanc (« on est en écouteur de la page
  // et non pas du tableau blanc »).
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      title: {
        default: "Tableau Kanban",
        parseHTML: (element) =>
          element.getAttribute("data-title") || "Tableau Kanban",
        renderHTML: (attributes) => ({
          "data-title": attributes.title,
        }),
      },
      columns: {
        // `DEFAULT_KANBAN_COLUMNS` était donné tel quel : un MÊME tableau,
        // partagé par référence entre tous les nœuds kanban du document et
        // conservé comme valeur par défaut de l'attribut. Toute mutation (ou
        // comparaison d'identité) portait donc sur l'objet commun. On en
        // renvoie désormais une copie profonde à chaque usage.
        default: structuredClone(DEFAULT_KANBAN_COLUMNS),
        parseHTML: (element) => {
          const raw = element.getAttribute("data-columns");
          if (!raw) return structuredClone(DEFAULT_KANBAN_COLUMNS);
          try {
            return JSON.parse(raw);
          } catch {
            return structuredClone(DEFAULT_KANBAN_COLUMNS);
          }
        },
        renderHTML: (attributes) => ({
          "data-columns": JSON.stringify(attributes.columns),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="kanban"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "kanban" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KanbanBlockComponent, {
      stopEvent: () => true,
      update: (props) => {
        if (props.newNode.type !== props.oldNode.type) {
          return false;
        }
        props.updateProps();
        return true;
      },
    });
  },

  addCommands() {
    return {
      insertKanban:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: "Tableau Kanban",
              columns: DEFAULT_KANBAN_COLUMNS,
            },
          });
        },
    };
  },
});
