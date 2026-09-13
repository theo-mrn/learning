"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { Checkbox } from "@/components/ui/checkbox";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Check,
  Code2,
  Columns3,
  Maximize2,
  Minimize2,
  Italic,
  Merge,
  PaintBucket,
  Rows3,
  Split,
  Strikethrough,
  Table2,
  TextCursorInput,
  Trash2,
  X,
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

/** Fonds de cellule : les teintes de la palette de la DA. Le CSS les pose
 * en voile (color-mix), donc elles restent lisibles dans les deux thèmes. */
const FILL_COLORS = [
  { value: null, label: "Aucun" },
  { value: "#B83D14", label: "Terracotta" },
  { value: "#C98A2E", label: "Ocre" },
  { value: "#2F6B4F", label: "Vert" },
  { value: "#2B5B8C", label: "Bleu" },
  { value: "#7A4A8C", label: "Prune" },
  { value: "#6B655C", label: "Gris" },
];

const ALIGNMENTS = [
  { value: "left" as const, label: "Aligner à gauche", icon: AlignLeft },
  { value: "center" as const, label: "Centrer", icon: AlignCenter },
  { value: "right" as const, label: "Aligner à droite", icon: AlignRight },
  { value: "justify" as const, label: "Justifier", icon: AlignJustify },
];

/**
 * Barre d'actions du tableau, affichée dès que le curseur entre dans une
 * cellule.
 *
 * Sans elle, un tableau est un cul-de-sac : on ne peut ni insérer une ligne
 * au milieu, ni supprimer le bloc — reculer depuis une cellule ne fait rien,
 * parce que ProseMirror protège la structure.
 *
 * La barre garde les gestes fréquents (insérer, supprimer ligne/colonne,
 * supprimer le tableau) et renvoie le reste — alignement, couleurs,
 * en-têtes, zébrage — dans un panneau « Format », pour ne pas devenir une
 * rangée de quinze icônes indéchiffrables.
 */
/** Ce qu'on mémorise à l'ouverture d'un panneau : une plage de cellules ou
 * une sélection de texte, les deux se restaurant différemment. */
type SavedSelection =
  | { type: "cell"; anchor: number; head: number; from: number; to: number }
  | { type: "text"; from: number; to: number };

/**
 * Exécute une commande sur la sélection qu'avait l'éditeur avant l'ouverture
 * du panneau.
 *
 * Ouvrir un popover déplace le focus hors de ProseMirror, qui perd alors sa
 * sélection : un simple `chain().focus()` repart d'une position par défaut
 * et les commandes s'appliquent à côté — ou à rien. On restaure donc
 * explicitement les positions mémorisées.
 */
function withSelection(
  editor: Editor,
  saved: SavedSelection | null,
  run: (chain: ReturnType<Editor["chain"]>) => void,
  options: { expandToCell?: boolean } = {}
) {
  const chain = editor.chain().focus();

  // Sélection de cellules (plage) : on la restaure telle quelle. La
  // convertir en sélection de texte casserait fusionner/scinder, qui
  // exigent une CellSelection.
  if (saved?.type === "cell") {
    const { anchor, head } = saved;
    chain.command(({ state, tr, dispatch }) => {
      try {
        const selection = CellSelection.create(state.doc, anchor, head);
        if (dispatch) dispatch(tr.setSelection(selection));
        return true;
      } catch {
        // Le tableau a changé de forme depuis : on laisse la sélection
        // courante plutôt que de lever une erreur.
        return false;
      }
    });
    run(chain);
    chain.run();
    return;
  }

  let target = saved;

  // Rien de sélectionné : on étend à toute la cellule. C'est ce qu'attend
  // l'utilisateur qui clique dans une case puis demande « gras » — sans
  // ça, `toggleBold` ne fait qu'armer la marque pour la frappe suivante et
  // la cellule ne change pas du tout.
  if (options.expandToCell) {
    const pos = saved ? saved.from : editor.state.selection.from;
    const collapsed = !saved || saved.from === saved.to;
    if (collapsed) {
      const cell = findCellRange(editor, pos);
      if (cell) target = { type: "text", ...cell };
    }
  }

  if (target) {
    chain.setTextSelection(target);
  }
  run(chain);
  chain.run();
}

/** Étendue du contenu de la cellule qui contient `pos`, ou null. */
function findCellRange(
  editor: Editor,
  pos: number
): { from: number; to: number } | null {
  const $pos = editor.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      const start = $pos.start(depth);
      return { from: start, to: start + node.content.size };
    }
  }
  return null;
}

/** L'élément DOM du tableau contenant la sélection, ou null. */
function findTableElement(editor: Editor): HTMLElement | null {
  const { state, view } = editor;
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "table") {
      const dom = view.nodeDOM($from.before(depth));
      if (dom instanceof HTMLElement) {
        return (dom.closest(".tableWrapper") as HTMLElement | null) ?? dom;
      }
    }
  }
  return null;
}

export function TableToolbar({
  editor,
  fullscreen,
  onToggleFullscreen,
}: {
  editor: Editor;
  fullscreen: boolean;
  /** Reçoit le tableau à isoler : la page peut en contenir plusieurs. */
  onToggleFullscreen: (target: HTMLElement | null) => void;
}) {
  // Un panneau ouvert maintient la barre affichée même si la sélection sort
  // momentanément du tableau (c'est ce qu'un clic dans le panneau provoque).
  const [panelOpen, setPanelOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null
  );
  // Dernier tableau connu : quand la sélection sort du tableau le temps d'un
  // clic dans un panneau, on garde l'ancre précédente au lieu de la perdre.
  const lastTableEl = useRef<HTMLElement | null>(null);


  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      inTable: editor.isActive("table"),
    }),
  });

  const visible = state.inTable || panelOpen;

  // Position de la barre : sous le tableau, en coordonnées relatives au
  // conteneur positionné de l'éditeur. Recalculée sur changement de
  // sélection, scroll et redimensionnement.
  useEffect(() => {
    if (!visible) return;

    function place() {
      const el = findTableElement(editor);
      if (el) lastTableEl.current = el;
      const target = el ?? lastTableEl.current;
      if (!target || !target.isConnected) return;
      // Coordonnées viewport, pas relatives à un parent : en plein écran la
      // toile passe en `position: fixed` et son offsetParent change, ce qui
      // décalait la barre loin du tableau.
      const t = target.getBoundingClientRect();
      setAnchor({ top: t.bottom + 10, left: t.left });
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    // Le tableau change de taille sans scroll ni resize de fenêtre :
    // colonne redimensionnée, ligne ajoutée, passage en plein écran.
    const observer = new ResizeObserver(place);
    const el = findTableElement(editor) ?? lastTableEl.current;
    if (el) observer.observe(el);

    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [editor, visible, state.inTable, fullscreen]);

  if (!visible || !anchor) return null;

  return (
    <div
      // Positionnée à la main sous le tableau. Volontairement pas un
      // BubbleMenu : celui-ci retire son élément du DOM quand il se cache,
      // ce qui arracherait le déclencheur du popover ouvert.
      style={{ top: anchor.top, left: anchor.left }}
      className="fixed z-40 flex items-center gap-0.5 rounded-xl border border-border/80 bg-popover p-1 shadow-lifted"
      aria-label="Actions du tableau"
    >
      {/* Deux menus distincts, parce que ce sont deux cibles différentes :
          « Cellule » agit sur la ou les cellules sélectionnées, « Tableau »
          sur le bloc entier. Tout mélangé, on ne savait pas ce qu'on
          modifiait. */}
      <CellMenu editor={editor} onOpenChange={setPanelOpen} />
      <TableMenu editor={editor} onOpenChange={setPanelOpen} />

      <Divider />

      {/* Plein écran : un grand tableau ne tient pas dans la colonne de
          lecture, et le redimensionnement de colonnes y est à l'étroit. */}
      <IconButton
        label={
          fullscreen ? "Quitter le plein écran" : "Ouvrir en plein écran"
        }
        onClick={() => onToggleFullscreen(findTableElement(editor))}
      >
        {fullscreen ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </IconButton>

      <Divider />

      {/* L'action destructive est en bout de barre, séparée, et en rouge :
          c'est la sortie de secours du bloc. */}
      <IconButton
        label="Supprimer le tableau"
        destructive
        onClick={() => {
          setPanelOpen(false);
          editor.chain().focus().deleteTable().run();
        }}
      >
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );
}

/**
 * Menu « Cellule » : tout ce qui agit sur la ou les cellules sélectionnées
 * — style du texte, alignement, couleurs de remplissage et de texte.
 *
 * Séparé du menu Tableau parce que la cible n'est pas la même : ici on
 * modifie la sélection courante, là-bas le bloc entier. Mélanger les deux
 * laissait l'utilisateur sans savoir sur quoi il agissait.
 */
function CellMenu({
  editor,
  onOpenChange,
}: {
  editor: Editor;
  onOpenChange: (open: boolean) => void;
}) {
  const [saved, setSaved] = useState<SavedSelection | null>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      canMerge: editor.can().mergeCells(),
      canSplit: editor.can().splitCell(),
      // La cellule courante est soit une `tableCell`, soit une
      // `tableHeader` : on lit les deux et on garde ce qui est défini.
      align: (editor.getAttributes("tableCell").align ??
        editor.getAttributes("tableHeader").align) as string | null,
      background: (editor.getAttributes("tableCell").backgroundColor ??
        editor.getAttributes("tableHeader").backgroundColor) as string | null,
      textColor: (editor.getAttributes("tableCell").textColor ??
        editor.getAttributes("tableHeader").textColor) as string | null,
    }),
  });

  const currentAlign = state.align ?? "left";

  return (
    <PanelMenu
      icon={<TextCursorInput className="size-4" />}
      label="Cellule"
      onOpenChange={onOpenChange}
      editor={editor}
      onSavedSelection={setSaved}
    >
      {(close) => (
        <>
      <PanelHeader title="Cellule" onClose={close} />

      <div className="flex flex-col gap-4 p-3">
        <section>
          <SectionTitle>Style de texte</SectionTitle>
          <div className="grid grid-cols-4 gap-1">
            <SegButton
              active={state.bold}
              label="Gras"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleBold(), {
                  expandToCell: true,
                })
              }
            >
              <Bold className="size-4" />
            </SegButton>
            <SegButton
              active={state.italic}
              label="Italique"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleItalic(), {
                  expandToCell: true,
                })
              }
            >
              <Italic className="size-4" />
            </SegButton>
            <SegButton
              active={state.strike}
              label="Barré"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleStrike(), {
                  expandToCell: true,
                })
              }
            >
              <Strikethrough className="size-4" />
            </SegButton>
            <SegButton
              active={state.code}
              label="Code"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleCode(), {
                  expandToCell: true,
                })
              }
            >
              <Code2 className="size-4" />
            </SegButton>
          </div>

          <div className="mt-1 grid grid-cols-4 gap-1">
            {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
              <SegButton
                key={value}
                active={currentAlign === value}
                label={label}
                onClick={() =>
                  withSelection(editor, saved, (c) => c.setCellAlign(value))
                }
              >
                <Icon className="size-4" />
              </SegButton>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              withSelection(editor, saved, (c) => c.unsetAllMarks(), {
                expandToCell: true,
              })
            }
            onMouseDown={(event) => event.preventDefault()}
            className="mt-1 h-8 w-full rounded-md border border-border/60 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            Effacer la mise en forme
          </button>
        </section>

        <section>
          <SectionTitle>Couleurs</SectionTitle>
          <ColorRow
            label="Remplissage"
            current={state.background}
            onPick={(color) =>
              withSelection(editor, saved, (c) => c.setCellBackground(color))
            }
          />
          <ColorRow
            label="Texte"
            current={state.textColor}
            onPick={(color) =>
              withSelection(editor, saved, (c) => c.setCellTextColor(color))
            }
          />
        </section>

        <section>
          <SectionTitle>Cette cellule</SectionTitle>
          <div className="flex flex-col">
            <MenuRow
              icon={<PaintBucket className="size-4" />}
              label="Basculer en en-tête"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleHeaderCell())
              }
            />
            {state.canMerge && (
              <MenuRow
                icon={<Merge className="size-4" />}
                label="Fusionner les cellules"
                onClick={() =>
                  withSelection(editor, saved, (c) => c.mergeCells())
                }
              />
            )}
            {state.canSplit && (
              <MenuRow
                icon={<Split className="size-4" />}
                label="Scinder la cellule"
                onClick={() =>
                  withSelection(editor, saved, (c) => c.splitCell())
                }
              />
            )}
          </div>
        </section>
      </div>
        </>
      )}
    </PanelMenu>
  );
}

/**
 * Menu « Tableau » : ce qui agit sur le bloc entier — insérer et supprimer
 * des lignes et des colonnes, en-têtes, zébrage.
 */
function TableMenu({
  editor,
  onOpenChange,
}: {
  editor: Editor;
  onOpenChange: (open: boolean) => void;
}) {
  const [saved, setSaved] = useState<SavedSelection | null>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      striped: Boolean(editor.getAttributes("table").striped),
    }),
  });

  return (
    <PanelMenu
      icon={<Table2 className="size-4" />}
      label="Tableau"
      onOpenChange={onOpenChange}
      editor={editor}
      onSavedSelection={setSaved}
    >
      {(close) => (
        <>
      <PanelHeader title="Tableau" onClose={close} />

      <div className="flex flex-col gap-4 p-3">
        <section>
          <SectionTitle>Insérer</SectionTitle>
          <div className="flex flex-col">
            <MenuRow
              icon={<ArrowUpToLine className="size-4" />}
              label="Une ligne au-dessus"
              onClick={() =>
                withSelection(editor, saved, (c) => c.addRowBefore())
              }
            />
            <MenuRow
              icon={<ArrowDownToLine className="size-4" />}
              label="Une ligne en dessous"
              onClick={() =>
                withSelection(editor, saved, (c) => c.addRowAfter())
              }
            />
            <MenuRow
              icon={<ArrowLeftToLine className="size-4" />}
              label="Une colonne à gauche"
              onClick={() =>
                withSelection(editor, saved, (c) => c.addColumnBefore())
              }
            />
            <MenuRow
              icon={<ArrowRightToLine className="size-4" />}
              label="Une colonne à droite"
              onClick={() =>
                withSelection(editor, saved, (c) => c.addColumnAfter())
              }
            />
          </div>
        </section>

        <section>
          <SectionTitle>Supprimer</SectionTitle>
          <div className="flex flex-col">
            <MenuRow
              icon={<Rows3 className="size-4" />}
              label="La ligne courante"
              onClick={() =>
                withSelection(editor, saved, (c) => c.deleteRow())
              }
            />
            <MenuRow
              icon={<Columns3 className="size-4" />}
              label="La colonne courante"
              onClick={() =>
                withSelection(editor, saved, (c) => c.deleteColumn())
              }
            />
          </div>
        </section>

        <section>
          <SectionTitle>Apparence</SectionTitle>
          <div className="flex flex-col">
            <MenuRow
              icon={<Rows3 className="size-4" />}
              label="Ligne d'en-tête"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleHeaderRow())
              }
            />
            <MenuRow
              icon={<Columns3 className="size-4" />}
              label="Colonne d'en-tête"
              onClick={() =>
                withSelection(editor, saved, (c) => c.toggleHeaderColumn())
              }
            />
          </div>
          <ToggleRow
            label="Lignes alternées"
            checked={state.striped}
            onToggle={() =>
              withSelection(editor, saved, (c) => c.toggleTableStriped())
            }
          />
        </section>
      </div>
        </>
      )}
    </PanelMenu>
  );
}

/** L'enveloppe commune aux deux menus : même déclencheur, même popover, et
 * surtout la même gestion du focus (voir les commentaires ci-dessous). */
function PanelMenu({
  icon,
  label,
  children,
  onOpenChange,
  editor,
  onSavedSelection,
}: {
  icon: React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  onOpenChange: (open: boolean) => void;
  editor: Editor;
  onSavedSelection: (saved: SavedSelection | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => change(false);

  function change(next: boolean) {
    // À l'ouverture on photographie la sélection : le popover va prendre le
    // focus et ProseMirror l'oubliera.
    if (next) {
      const selection = editor.state.selection;
      const { from, to } = selection;
      // Une plage de cellules se restaure par ses ancres, pas par des
      // positions de texte (voir withSelection).
      if (selection instanceof CellSelection) {
        onSavedSelection({
          type: "cell",
          anchor: selection.$anchorCell.pos,
          head: selection.$headCell.pos,
          from,
          to,
        });
      } else {
        onSavedSelection({ type: "text", from, to });
      }
    } else {
      onSavedSelection(null);
    }
    setOpen(next);
    onOpenChange(next);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        // Un clic dans le panneau (bouton ou zone vide) sort le focus du
        // popup, ce que Base UI prend pour une fermeture. On l'ignore : le
        // panneau reste ouvert pour enchaîner plusieurs réglages, et se
        // ferme sur la croix, Échap ou un clic dehors.
        if (!next && details?.reason === "focus-out") return;
        change(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground transition-colors duration-150 hover:bg-accent data-open:bg-accent"
                />
              }
            />
          }
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        // Vers le bas : la barre est déjà sous le tableau, un panneau qui
        // s'ouvre vers le haut recouvre le tableau qu'on est en train de
        // modifier.
        side="bottom"
        className="w-72 max-h-[min(26rem,60dvh)] overflow-y-auto p-0"
        // Sans ça, Base UI met le focus dans le panneau, ProseMirror perd
        // sa sélection, et les marks s'appliquent à toute la cellule au
        // lieu du texte sélectionné.
        initialFocus={false}
        // Un clic sur le fond du panneau ne doit pas déplacer le focus non
        // plus : c'est ce qui faisait sauter le popover dans le coin.
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) event.preventDefault();
        }}
      >
        {children(close)}
      </PopoverContent>
    </Popover>
  );
}

function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
      <span className="font-heading text-sm">{title}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[0.7rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Une ligne de choix de couleur : les pastilles de la DA plus « aucun ». */
function ColorRow({
  label,
  current,
  onPick,
}: {
  label: string;
  current: string | null;
  onPick: (color: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0 truncate text-sm">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        {FILL_COLORS.map((color) => {
          const isCurrent =
            (color.value ?? "").toLowerCase() === (current ?? "").toLowerCase();
          return (
            <button
              key={color.label}
              type="button"
              aria-label={color.label}
              aria-pressed={isCurrent}
              onClick={() => onPick(color.value)}
              onMouseDown={(event) => event.preventDefault()}
              className={`flex size-5 items-center justify-center rounded-full border transition-transform duration-150 hover:scale-110 ${
                color.value
                  ? "border-border/50"
                  : "border-dashed border-muted-foreground/50"
              }`}
              style={color.value ? { backgroundColor: color.value } : undefined}
            >
              {isCurrent && (
                <Check
                  aria-hidden
                  className={`size-3 ${
                    color.value ? "text-white" : "text-foreground"
                  }`}
                />
              )}
              {!color.value && !isCurrent && (
                <X aria-hidden className="size-2.5 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-sm">
      <span className="min-w-0 truncate">{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
    </label>
  );
}

/** Bouton d'un groupe segmenté (style de texte, alignement). */
function SegButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            // Garde le focus (et donc la sélection) dans ProseMirror : sans
            // ça, le mousedown vide la sélection et la mark s'applique à
            // toute la cellule au lieu du texte sélectionné.
            onMouseDown={(event) => event.preventDefault()}
            aria-pressed={active}
            aria-label={label}
            className={`flex h-8 items-center justify-center rounded-md border transition-colors duration-150 ${
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border/60 text-foreground hover:bg-accent"
            }`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors duration-100 hover:bg-accent"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function Divider() {
  return <div aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

function IconButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={label}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
              destructive
                ? "text-destructive hover:bg-destructive/10"
                : "text-foreground hover:bg-accent"
            }`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
