import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuizBlockComponent } from "./quiz-block";
import { QUIZ_DEFAULT_TITLE } from "./quiz-types";
import type { QuizDifficulty, QuizQuestion } from "@/components/quiz/quiz-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    quizBlock: {
      insertQuizBlock: (attrs?: {
        title?: string;
        difficulty?: QuizDifficulty;
        questions?: QuizQuestion[];
      }) => ReturnType;
    };
  }
}

export const QuizExtension = Node.create({
  name: "quizBlock",
  group: "block",
  atom: true,
  draggable: false,
  selectable: false,

  addAttributes() {
    return {
      title: {
        default: QUIZ_DEFAULT_TITLE,
        parseHTML: (element) =>
          element.getAttribute("data-title") || QUIZ_DEFAULT_TITLE,
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      difficulty: {
        default: "medium",
        parseHTML: (element) =>
          element.getAttribute("data-difficulty") || "medium",
        renderHTML: (attributes) => ({
          "data-difficulty": attributes.difficulty,
        }),
      },
      questions: {
        default: [] as QuizQuestion[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-questions");
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-questions": JSON.stringify(attributes.questions ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="quiz-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "quiz-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuizBlockComponent, {
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
      insertQuizBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              title: attrs?.title || QUIZ_DEFAULT_TITLE,
              difficulty: attrs?.difficulty || "medium",
              questions: attrs?.questions || [],
            },
          }),
    };
  },
});
