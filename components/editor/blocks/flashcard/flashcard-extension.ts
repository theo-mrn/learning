import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FlashcardBlockComponent } from "./flashcard-block";
import { FLASHCARD_DEFAULT_TITLE } from "./flashcard-types";
import type { FlashcardItem } from "@/components/flashcard/flashcard-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    flashcardBlock: {
      insertFlashcardBlock: (attrs?: {
        title?: string;
        topic?: string;
        cards?: FlashcardItem[];
      }) => ReturnType;
    };
  }
}

export const FlashcardExtension = Node.create({
  name: "flashcardBlock",
  group: "block",
  atom: true,
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      title: {
        default: FLASHCARD_DEFAULT_TITLE,
        parseHTML: (element) =>
          element.getAttribute("data-title") || FLASHCARD_DEFAULT_TITLE,
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      topic: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-topic") || "",
        renderHTML: (attributes) => ({ "data-topic": attributes.topic }),
      },
      cards: {
        default: [] as FlashcardItem[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-cards");
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-cards": JSON.stringify(attributes.cards ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flashcard-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "flashcard-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlashcardBlockComponent, {
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
      insertFlashcardBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              title: attrs?.title || FLASHCARD_DEFAULT_TITLE,
              topic: attrs?.topic || "",
              cards: attrs?.cards || [],
            },
          }),
    };
  },
});
