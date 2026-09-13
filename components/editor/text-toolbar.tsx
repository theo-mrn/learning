"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Unlink,
  Palette,
  Check,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Type,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Barre de formatage contextuelle : elle n'apparaît qu'au-dessus d'une
 * sélection, au lieu d'occuper en permanence une bande au-dessus du titre.
 * Le document reste ainsi la seule chose à l'écran quand on écrit.
 *
 * Le cas « armer une couleur sans rien sélectionner pour que la suite
 * s'écrive dedans » ne peut pas passer par cette barre, justement parce
 * qu'elle exige une sélection : il est couvert par la barre fixe du
 * document (`DocumentToolbar`), qui reste accessible en permanence.
 */

/** Teintes proposées en un clic, tirées de la palette de la DA : un document
 * coloré reste dans l'accord chromatique de l'app. */
const SWATCHES = [
  { value: "#B83D14", label: "Terracotta" },
  { value: "#C98A2E", label: "Ocre" },
  { value: "#2F6B4F", label: "Vert" },
  { value: "#2B5B8C", label: "Bleu" },
  { value: "#7A4A8C", label: "Prune" },
  { value: "#6B655C", label: "Gris" },
];

type BlockKind =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote";

const BLOCK_OPTIONS: {
  kind: BlockKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  apply: (editor: Editor) => void;
}[] = [
  {
    kind: "paragraph",
    label: "Texte",
    icon: Type,
    apply: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    kind: "heading1",
    label: "Titre 1",
    icon: Heading1,
    apply: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    kind: "heading2",
    label: "Titre 2",
    icon: Heading2,
    apply: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    kind: "heading3",
    label: "Titre 3",
    icon: Heading3,
    apply: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    kind: "bulletList",
    label: "Liste à puces",
    icon: List,
    apply: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    kind: "orderedList",
    label: "Liste numérotée",
    icon: ListOrdered,
    apply: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    kind: "taskList",
    label: "Liste de tâches",
    icon: ListTodo,
    apply: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    kind: "blockquote",
    label: "Citation",
    icon: Quote,
    apply: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
];

export function TextToolbar({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);

  return (
    <BubbleMenu
      editor={editor}
      // Le délai évite que la barre saute à chaque micro-ajustement de la
      // sélection pendant qu'on fait glisser le curseur.
      updateDelay={120}
      options={{
        placement: "top",
        // 14px de dégagement en texte courant ; dans un tableau la barre
        // se poserait sur la ligne d'en-tête, donc on l'écarte davantage.
        offset: () => (editor.isActive("table") ? 30 : 14),
        // Pas la place au-dessus (sélection en haut du document, ou près du
        // header collant) : la barre passe dessous au lieu d'être coupée.
        flip: true,
        shift: { padding: 8 },
      }}
      shouldShow={({ editor, from, to }) => {
        // Rien de sélectionné, sélection vide ou bloc non textuel
        if (from === to) return false;
        if (editor.isActive("codeBlock")) return false;
        if (editor.isActive("kanban")) return false;

        // Seules les vraies sélections de texte affichent la barre (pas les sélections de nœuds comme le Kanban)
        const { selection } = editor.state;
        if (!selection || selection.empty || selection.constructor.name === "NodeSelection") {
          return false;
        }
        return true;
      }}
      // Clé distincte de celle de la barre tableau : sans ça, les deux
      // bubble menus se partageraient le même plugin ProseMirror.
      pluginKey="formatToolbar"
      className="flex items-center gap-0.5 rounded-xl border border-border/80 bg-popover p-1 shadow-lifted"
    >
      <FormatControls editor={editor} state={state} />
    </BubbleMenu>
  );
}

export type FormatState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  blockKind: BlockKind;
  highlightColor?: string;
  textColor?: string;
};

/** Lit dans l'éditeur tout ce dont les barres ont besoin. Partagé pour que
 * la barre contextuelle et la barre fixe ne puissent pas diverger. */
export function useFormatState(editor: Editor): FormatState {
  return useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      link: editor.isActive("link"),
      blockKind: currentBlockKind(editor),
      highlightColor: editor.getAttributes("highlight").color as
        | string
        | undefined,
      textColor: editor.getAttributes("textStyle").color as string | undefined,
    }),
  });
}

/**
 * Le rang de contrôles de formatage, utilisé tel quel par les deux barres.
 *
 * Tiptap applique une marque activée sans sélection aux caractères tapés
 * ensuite : chacun de ces boutons sert donc aussi bien à reformater une
 * sélection qu'à « armer » un style avant d'écrire. C'est pour ça qu'ils
 * doivent tous être joignables sans sélection, et pas seulement la couleur.
 */
export function FormatControls({
  editor,
  state,
  colorAlign = "end",
}: {
  editor: Editor;
  state: FormatState;
  colorAlign?: "start" | "center" | "end";
}) {
  return (
    <>
      {/* Type de bloc : un seul menu au lieu de sept boutons alignés. */}
      <BlockKindMenu editor={editor} current={state.blockKind} />

      <Divider />

      <ToolbarButton
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Gras"
        shortcut="⌘B"
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italique"
        shortcut="⌘I"
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Barré"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Code"
        shortcut="⌘E"
      >
        <Code className="size-4" />
      </ToolbarButton>

      <Divider />

      <LinkButton editor={editor} isActive={state.link} />

      <ColorMenu
        editor={editor}
        textColor={state.textColor}
        highlightColor={state.highlightColor}
        align={colorAlign}
      />
    </>
  );
}

/** Le type du bloc courant, pour afficher le bon libellé dans le menu. */
export function currentBlockKind(editor: Editor): BlockKind {
  if (editor.isActive("heading", { level: 1 })) return "heading1";
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  if (editor.isActive("taskList")) return "taskList";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

export function BlockKindMenu({
  editor,
  current,
}: {
  editor: Editor;
  current: BlockKind;
}) {
  const [open, setOpen] = useState(false);
  const active =
    BLOCK_OPTIONS.find((option) => option.kind === current) ?? BLOCK_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Type de bloc : ${active.label}`}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground transition-colors duration-150 hover:bg-accent data-open:bg-accent in-[.flex-col]:w-8 in-[.flex-col]:justify-center in-[.flex-col]:px-0"
          />
        }
      >
        <ActiveIcon className="size-4 shrink-0" />
        {/* Le libellé et le chevron disparaissent dans un conteneur en
            colonne (le rail latéral) : il n'y a pas la largeur, et l'icône
            suffit puisqu'elle reflète déjà le type courant. */}
        <span className="max-w-24 truncate in-[.flex-col]:hidden">
          {active.label}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 shrink-0 opacity-50 in-[.flex-col]:hidden"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1" initialFocus={false}>
        {BLOCK_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isCurrent = option.kind === current;
          return (
            <button
              key={option.kind}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => {
                option.apply(editor);
                setOpen(false);
              }}
              onMouseDown={(event) => event.preventDefault()}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-accent"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{option.label}</span>
              {isCurrent && (
                <Check aria-hidden className="size-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Saisie de lien dans un popover : `window.prompt` sortait de la DA et ne
 * laissait pas voir l'URL existante. */
export function LinkButton({
  editor,
  isActive,
}: {
  editor: Editor;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function submit() {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      // Sans schéma, le navigateur traiterait l'URL comme un chemin relatif.
      const href = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setUrl((editor.getAttributes("link").href as string) ?? "");
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Lien"
                  aria-pressed={isActive}
                  className={`flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                />
              }
            />
          }
        >
          <LinkIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>
          Lien <span className="ml-1 text-background/60">⌘K</span>
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-72 p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="link-url" className="text-xs text-muted-foreground">
            Adresse du lien
          </label>
          <input
            id="link-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="exemple.com"
            autoFocus
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="h-8 flex-1 rounded-md bg-primary text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
            >
              Appliquer
            </button>
            {isActive && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
                aria-label="Retirer le lien"
                className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                <Unlink className="size-3.5" />
              </button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Couleur du texte et surlignage réunis dans un seul menu : deux boutons
 * distincts pour deux variantes de la même idée encombraient la barre.
 *
 * Exporté parce qu'il sert à deux endroits : dans la barre contextuelle
 * (pour colorer une sélection) et dans la barre fixe du document (pour
 * armer une couleur avant d'écrire, sans rien avoir sélectionné).
 */
export function ColorMenu({
  editor,
  textColor,
  highlightColor,
  align = "end",
}: {
  editor: Editor;
  textColor?: string;
  highlightColor?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"text" | "highlight">("text");
  const activeColor = target === "text" ? textColor : highlightColor;
  const hasColor = Boolean(textColor || highlightColor);
  const [liveColor, setLiveColor] = useState(SWATCHES[0].value);

  function apply(color: string) {
    if (target === "text") {
      if (color) editor.chain().focus().setColor(color).run();
      else editor.chain().focus().unsetColor().run();
    } else {
      if (color) editor.chain().focus().setHighlight({ color }).run();
      else editor.chain().focus().unsetHighlight().run();
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setLiveColor(activeColor || SWATCHES[0].value);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Couleur et surlignage"
                  className={`relative flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                    hasColor
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                />
              }
            />
          }
        >
          <Palette className="size-4" />
          {hasColor && (
            <span
              aria-hidden
              className="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
              style={{ backgroundColor: textColor ?? highlightColor }}
            />
          )}
        </TooltipTrigger>
        <TooltipContent>Couleur</TooltipContent>
      </Tooltip>

      <PopoverContent align={align} className="w-64 p-2.5" initialFocus={false}>
        <div className="flex flex-col gap-3">
          {/* Le même sélecteur sert au texte et au surlignage : on choisit
              d'abord la cible, la palette ne change pas de place. */}
          <div
            role="group"
            aria-label="Appliquer à"
            className="flex rounded-lg bg-muted p-0.5"
          >
            {(
              [
                ["text", "Texte"],
                ["highlight", "Surlignage"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={target === value}
                onClick={() => setTarget(value)}
                className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  target === value
                    ? "bg-background text-foreground shadow-paper"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((swatch) => {
              const isCurrent =
                activeColor?.toLowerCase() === swatch.value.toLowerCase();
              return (
                <button
                  key={swatch.value}
                  type="button"
                  aria-label={swatch.label}
                  aria-pressed={isCurrent}
                  onClick={() => {
                    setLiveColor(swatch.value);
                    apply(swatch.value);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  className="flex size-7 items-center justify-center rounded-md border border-border/50 transition-transform duration-150 hover:scale-110"
                  style={{ backgroundColor: swatch.value }}
                >
                  {isCurrent && (
                    <Check aria-hidden className="size-3.5 text-white" />
                  )}
                </button>
              );
            })}
          </div>

          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
              Couleur personnalisée
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <HexColorPicker
                color={liveColor}
                onChange={(color) => {
                  setLiveColor(color);
                  apply(color);
                }}
                style={{ width: "100%", height: 120 }}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">#</span>
                <HexColorInput
                  color={liveColor}
                  onChange={(color) => {
                    setLiveColor(color);
                    apply(color);
                  }}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </details>

          {activeColor && (
            <button
              type="button"
              onClick={() => apply("")}
              className="h-8 rounded-md border border-border text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              Retirer la couleur
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Divider() {
  // Trait vertical entre boutons alignés, horizontal dès que le conteneur
  // passe en colonne (le rail latéral du document).
  return (
    <div
      aria-hidden
      className="mx-0.5 h-5 w-px shrink-0 bg-border in-[.flex-col]:mx-0 in-[.flex-col]:my-0.5 in-[.flex-col]:h-px in-[.flex-col]:w-5"
    />
  );
}

export function ToolbarButton({
  active,
  onClick,
  label,
  shortcut,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            // Garde le focus (et la sélection) dans ProseMirror : le
            // mousedown d'un bouton la viderait, et la mark s'appliquerait
            // alors au bloc entier plutôt qu'au texte sélectionné.
            onMouseDown={(event) => event.preventDefault()}
            aria-pressed={active}
            aria-label={label}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
              active
                ? "bg-primary/15 text-primary"
                : "text-foreground hover:bg-accent"
            }`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1 text-background/60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
