import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  filterSlashCommandItems,
  type SlashCommandItem,
} from "@/components/editor/slash-command-items";
import {
  SlashCommandMenu,
  type SlashCommandMenuHandle,
} from "@/components/editor/slash-command-menu";

/** Les props du menu dépendent de l'editor et du range courants, que seule
 * la suggestion connaît : on les recalcule à chaque onStart/onUpdate. */
function menuProps(props: {
  items: SlashCommandItem[];
  editor: Parameters<SlashCommandItem["command"]>[0]["editor"];
  range: Parameters<SlashCommandItem["command"]>[0]["range"];
}) {
  return {
    items: props.items,
    command: (item: SlashCommandItem) =>
      item.command({ editor: props.editor, range: props.range }),
    insertTable: (options: {
      rows: number;
      cols: number;
      withHeaderRow: boolean;
    }) =>
      props.editor
        .chain()
        .focus()
        // On retire d'abord le "/table" tapé, sinon il reste devant le
        // tableau inséré.
        .deleteRange(props.range)
        .insertTable(options)
        .run(),
  };
}

const suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
  char: "/",
  items: ({ query }) => filterSlashCommandItems(query),
  render: () => {
    let component: ReactRenderer<SlashCommandMenuHandle>;
    let unmount: (() => void) | undefined;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandMenu, {
          props: menuProps(props),
          editor: props.editor,
        });

        unmount = props.mount(component.element);
      },
      onUpdate: (props) => {
        component.updateProps(menuProps(props));
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          unmount?.();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        unmount?.();
        component.destroy();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return { suggestion };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
