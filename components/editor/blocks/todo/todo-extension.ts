import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TodoBlockComponent } from "./todo-block";
import { TODO_DEFAULT_TITLE, type TodoTask } from "./todo-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    todoBlock: {
      insertTodoBlock: () => ReturnType;
    };
  }
}

export const TodoExtension = Node.create({
  name: "todoBlock",
  group: "block",
  atom: true,
  // Pas de `draggable` : ProseMirror installerait sa propre gestion de
  // glisser sur le bloc et démarrerait une sélection de nœud dès le
  // `mousedown`, ce qui volerait le geste au réordonnancement des tâches.
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      title: {
        default: TODO_DEFAULT_TITLE,
        parseHTML: (element) =>
          element.getAttribute("data-title") || TODO_DEFAULT_TITLE,
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      hideCompleted: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute("data-hide-completed") === "true",
        renderHTML: (attributes) => ({
          "data-hide-completed": String(Boolean(attributes.hideCompleted)),
        }),
      },
      tasks: {
        default: [] as TodoTask[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-tasks");
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            // Données illisibles : liste vide plutôt que page cassée.
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-tasks": JSON.stringify(attributes.tasks ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="todo-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "todo-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TodoBlockComponent, {
      // Les champs de saisie et les cases à cocher du bloc gèrent eux-mêmes
      // clavier et pointeur : ProseMirror ne doit rien intercepter.
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
      insertTodoBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              title: TODO_DEFAULT_TITLE,
              hideCompleted: false,
              tasks: [],
            },
          }),
    };
  },
});
