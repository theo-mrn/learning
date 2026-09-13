import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import type { SlashCommandItem } from "@/components/editor/slash-command-items";
import { TableSizePicker } from "@/components/editor/table-size-picker";

export type SlashCommandMenuHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuHandle,
  {
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
    insertTable?: (options: {
      rows: number;
      cols: number;
      withHeaderRow: boolean;
    }) => void;
  }
>(function SlashCommandMenu({ items, command, insertTable }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Un item peut demander un réglage avant d'agir : le menu bascule alors
  // sur son panneau, sans fermer la suggestion.
  const [panel, setPanel] = useState<"table" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelectedIndex(0), [items]);

  // La sélection au clavier doit rester visible quand la liste défile :
  // sinon on navigue à l'aveugle dès le cinquième élément.
  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex];
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function choose(item: SlashCommandItem) {
    if (item.panel === "table" && insertTable) {
      setPanel("table");
      return;
    }
    command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // Dans un panneau, les flèches appartiennent à ses propres champs.
      if (panel) return false;
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) choose(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (panel === "table" && insertTable) {
    return (
      <div className="w-fit rounded-xl border border-border bg-popover p-3 shadow-lifted">
        <TableSizePicker onInsert={insertTable} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-xl border border-border bg-popover px-3 py-2.5 text-sm text-muted-foreground shadow-lifted">
        Aucun bloc ne correspond
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insérer un bloc"
      className="max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lifted"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const isSelected = index === selectedIndex;
        return (
          <button
            key={item.title}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => choose(item)}
            // Le survol déplace la sélection : la souris et le clavier
            // pointent le même élément au lieu de se contredire.
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-100 ${
              isSelected
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground"
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-100 ${
                isSelected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{item.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

export type { Editor, Range };
