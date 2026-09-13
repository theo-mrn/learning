"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { TableKit } from "@tiptap/extension-table";
import { TablePaste } from "@/components/editor/table-paste-extension";
import { TableStyling } from "@/components/editor/table-styling-extension";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Eye, GripVertical, Minimize2, Table2 } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { EmojiPicker } from "@/components/emoji-picker";
import { SaveIndicator, type SaveState } from "@/components/save-indicator";
import { SlashCommand } from "@/components/editor/slash-command-extension";
import { TextToolbar } from "@/components/editor/text-toolbar";
import { TableToolbar } from "@/components/editor/table-toolbar";
import { useTableFullscreen } from "@/hooks/use-table-fullscreen";
import { DocumentToolbar } from "@/components/editor/document-toolbar";
import { COMPLEX_BLOCK_EXTENSIONS } from "@/components/editor/blocks";
import { KanbanDialogProvider } from "@/components/editor/blocks/kanban/kanban-dialog-context";
import { ImagePageProvider } from "@/components/editor/blocks/image/image-page-context";
import { KanbanMembersProvider } from "@/components/editor/blocks/kanban/kanban-members-context";
import type { KanbanAssignee } from "@/components/editor/blocks/kanban/kanban-types";
import { sanitizeDocument } from "@/lib/sanitize-doc";
import { renamePage, savePageContent, updatePageIcon } from "@/lib/actions";
import type { Page } from "@/app/generated/prisma/client";

/**
 * Insère un bloc image contenant déjà les fichiers collés/déposés.
 *
 * Les handlers de `editorProps` reçoivent la vue ProseMirror, pas le contexte
 * React : ils ne peuvent pas appeler de hook pour connaître l'id de la page.
 * On se contente donc de créer le bloc avec les fichiers en attente, et c'est
 * le NodeView — qui, lui, a accès au contexte — qui les téléverse au montage.
 */
function insertImageBlockWithFiles(view: EditorView, files: File[]) {
  const nodeType = view.state.schema.nodes.imageBlock;
  if (!nodeType) return;

  const node = nodeType.create({
    images: [],
    layout: files.length > 1 ? "grid" : "single",
    scale: 100,
    // Attribut non sérialisé (absent de `addAttributes`) : il ne survit pas à
    // la sauvegarde, ce qui est exactement voulu — c'est un passe-plat vers
    // le NodeView, pas une donnée du document.
    pendingFiles: files,
  });

  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
}

/** Inactivité requise avant d'écrire : on laisse la frappe (et les
 * changements de mise en forme) se reposer au lieu d'écrire à chaque
 * transaction Tiptap. */
const IDLE_SAVE_MS = 8_000;

/** Filet de sécurité : même en écrivant sans interruption, le document est
 * enregistré au moins à cette cadence, pour qu'un crash ne coûte jamais plus
 * de cinq minutes de travail. */
/** Volontairement gardé à plusieurs fois `IDLE_SAVE_MS` : trop proche, il se
 * déclencherait pendant des pauses de frappe normales et doublerait les
 * écritures sans rien protéger de plus. */
const MAX_SAVE_INTERVAL_MS = 2 * 60_000;

export function PageEditor({
  page,
  initialContent,
  /** `false` pour un membre en lecture seule. Sans ça, l'éditeur acceptait la
   * frappe et la sauvegarde était refusée côté serveur : tout le travail
   * était perdu sans avertissement. */
  canEdit = true,
  /** Membres de l'espace, pour l'assignation des cartes Kanban. */
  members = [],
  currentUserId = null,
}: {
  page: Page;
  initialContent: JSONContent;
  canEdit?: boolean;
  members?: KanbanAssignee[];
  currentUserId?: string | null;
}) {
  const [title, setTitle] = useState(page.title);
  const tableFullscreen = useTableFullscreen();
  // L'enregistrement est automatique : sans retour visuel, on ne sait pas
  // si son travail est en sécurité. Cet état alimente SaveIndicator.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only one savePageContent call may be in flight at a time (it replaces
  // all of the page's blocks). saveInFlight/pendingDoc turn overlapping
  // saves into a queue of at most one pending write instead of letting two
  // deleteMany+create transactions race on the same page.
  const saveInFlight = useRef(false);
  const pendingDoc = useRef<JSONContent | null>(null);
  // Dernier état non encore écrit, et date de la dernière écriture réussie :
  // ensemble ils permettent de forcer une sauvegarde au bout de
  // MAX_SAVE_INTERVAL_MS et d'en déclencher une à la sortie de la page.
  const unsavedDoc = useRef<JSONContent | null>(null);
  // Initialisé à 0 puis renseigné au montage : appeler Date.now() pendant
  // le rendu est impur (le rendu doit pouvoir être rejoué à l'identique).
  const lastSavedAt = useRef<number>(0);

  const flushSave = useCallback(
    async (doc: JSONContent) => {
      if (saveInFlight.current) {
        pendingDoc.current = doc;
        return;
      }
      saveInFlight.current = true;
      setSaveState("saving");
      try {
        // Reconstruit un objet simple (seul ce genre de valeur peut franchir
        // la frontière d'une Server Action : la sortie de `getJSON()` peut
        // porter des valeurs non-plates qui cassent la sérialisation RSC au
        // fond de la détection de Decimal par Prisma) et retire au passage
        // les attributs purement locaux — `previewUrl` (URL `blob:` valable
        // seulement dans cet onglet) et `pendingFiles` (objets `File`), qui
        // partaient sinon en base et dans chaque snapshot de version.
        const plainDoc = sanitizeDocument(doc) as {
          type: string;
          content?: unknown[];
        };
        await savePageContent(page.id, plainDoc);
        lastSavedAt.current = Date.now();
        // Ce document-là est écrit : plus rien à sauver, sauf si une frappe
        // est arrivée entre-temps (auquel cas pendingDoc prend le relais).
        if (unsavedDoc.current === doc) unsavedDoc.current = null;
        // Une écriture reste en attente : on ne dit pas encore "enregistré".
        if (!pendingDoc.current) setSaveState("saved");
      } catch {
        setSaveState("error");
      } finally {
        saveInFlight.current = false;
        if (pendingDoc.current) {
          const next = pendingDoc.current;
          pendingDoc.current = null;
          flushSave(next);
        }
      }
    },
    [page.id]
  );

  const scheduleSave = useCallback(
    (doc: JSONContent) => {
      setSaveState("pending");
      unsavedDoc.current = doc;

      // Plafond dur : si la dernière écriture date de plus de cinq minutes,
      // on enregistre maintenant au lieu de repousser encore l'échéance —
      // sinon une session de frappe continue n'écrirait jamais.
      if (Date.now() - lastSavedAt.current >= MAX_SAVE_INTERVAL_MS) {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        flushSave(doc);
        return;
      }

      // Sinon on repart de vingt secondes d'inactivité : un gras, un retour
      // à la ligne ou une correction ne déclenchent plus d'écriture immédiate.
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null;
        flushSave(doc);
      }, IDLE_SAVE_MS);
    },
    [flushSave]
  );

  /** Écrit tout de suite ce qui ne l'est pas encore (sortie de page,
   * onglet masqué, démontage du composant). */
  const flushNow = useCallback(() => {
    if (!unsavedDoc.current) return;
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    flushSave(unsavedDoc.current);
  }, [flushSave]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TableKit.configure({
        table: {
          // Colonnes redimensionnables à la souris, et le wrapper permet au
          // tableau de défiler horizontalement sans élargir la page.
          resizable: true,
          renderWrapper: true,
          cellMinWidth: 64,
          HTMLAttributes: { class: "doc-table" },
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading"
            ? "Titre"
            : "Écris ou tape '/' pour insérer un bloc",
      }),
      SlashCommand,
      TablePaste,
      TableStyling,
      ...COMPLEX_BLOCK_EXTENSIONS,
    ],
    content: initialContent,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // `prose-editorial` (globals.css) accorde la typographie du document
        // aux tokens de la DA plutôt qu'aux gris par défaut de prose.
        class:
          "prose prose-editorial dark:prose-invert max-w-none focus:outline-none min-h-[60vh]",
      },
      // Coller ou déposer une image n'importe où dans le document crée un
      // bloc image. Sans ça, il faudrait d'abord insérer un bloc vide via
      // « / » : le geste naturel (Cmd+V sur une capture) ne ferait rien.
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;
        event.preventDefault();
        insertImageBlockWithFiles(view, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? []
        ).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        insertImageBlockWithFiles(view, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(editor.getJSON());
    },
  });

  // Démarre le compteur du plafond de sauvegarde à l'ouverture de la page.
  useEffect(() => {
    lastSavedAt.current = Date.now();
  }, []);

  // Au démontage (changement de page via la sidebar, par exemple), on écrit
  // ce qui reste en attente : avec vingt secondes de latence, quitter la page
  // sans ça perdrait le dernier paragraphe.
  useEffect(() => {
    return () => {
      flushNow();
    };
  }, [flushNow]);

  // L'onglet passe en arrière-plan ou la page est masquée : c'est le dernier
  // moment fiable pour écrire sur mobile, où `beforeunload` ne se déclenche
  // pas toujours.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushNow();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushNow);
    };
  }, [flushNow]);

  // Prévient la perte de données : si une écriture est encore en attente au
  // moment de fermer l'onglet, le navigateur demande confirmation.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "pending" || saveState === "saving") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  function handleTitleBlur() {
    if (title !== page.title) {
      renamePage(page.id, title);
    }
  }

  return (
    /* `KanbanMembersProvider` englobe `KanbanDialogProvider` : ce dernier rend
       le dialogue de carte dans son propre corps, en frère de `{children}`
       (il est volontairement sorti de l'arbre Tiptap). Dans l'ordre inverse,
       le dialogue n'était donc pas un descendant du provider de membres :
       `useKanbanMembers()` y tombait sur la valeur par défaut et affichait
       « Aucun membre dans cet espace ». */
    <KanbanMembersProvider members={members} currentUserId={currentUserId}>
      <KanbanDialogProvider>
      <ImagePageProvider pageId={page.id}>
      <div>
      {/* Emoji de la page d'un côté, état d'enregistrement de l'autre. */}
      {/* Dire pourquoi on ne peut pas écrire : sans ce bandeau, un curseur
          absent se lit comme un bug. */}
      {!canEdit && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="size-3.5 shrink-0" />
          Lecture seule : ton rôle sur cet espace ne permet pas de modifier
          cette page.
        </p>
      )}

      <div
        data-slot="editor-chrome"
        className="mb-1 flex items-start justify-between gap-3"
      >
        {/* `editable: canEdit` ne couvre que le corps Tiptap : sans ces deux
            gardes, un membre en lecture seule pouvait encore renommer la page
            et changer son emoji, et l'écriture échouait côté serveur. */}
        {canEdit ? (
          <EmojiPicker
            icon={page.icon}
            onSelect={(icon) => updatePageIcon(page.id, icon)}
          />
        ) : (
          // L'emoji reste visible, mais sans déclencheur : en lecture seule
          // il est une information, plus un contrôle.
          <span
            aria-hidden
            className="flex size-9 items-center justify-center text-2xl leading-none"
          >
            {page.icon}
          </span>
        )}
        <SaveIndicator state={saveState} />
      </div>

      {/* Le titre est un textarea, pas un input : un titre long passe à la
          ligne au lieu de défiler hors du champ de vision. */}
      <TitleField
        readOnly={!canEdit}
        value={title}
        onChange={setTitle}
        onBlur={handleTitleBlur}
        onEnter={() => editor?.commands.focus("start")}
      />

      {/* Barre de formatage permanente : c'est elle qui permet d'armer un
          style (gras, couleur, type de bloc…) sans rien avoir sélectionné.

          Sur grand écran, rail vertical fixé contre le bord droit de la
          fenêtre — hors de la colonne de lecture, donc jamais près du texte.
          En dessous de `xl` il n'y a pas cette marge : il repasse en ligne
          au-dessus du document, dans le flux. */}
      {editor && (
        <>
          <div className="mb-4 flex justify-end xl:hidden">
            <DocumentToolbar editor={editor} />
          </div>
          <div className="fixed top-1/2 right-6 z-20 hidden -translate-y-1/2 xl:block 2xl:right-10">
            <DocumentToolbar editor={editor} />
          </div>
        </>
      )}

      {/* La barre contextuelle, elle, se positionne au-dessus de la
          sélection et n'occupe pas le flux. */}
      {editor && <TextToolbar editor={editor} />}

      {/* Actions du tableau : seul accès pour ajouter/supprimer lignes,
          colonnes, et surtout supprimer le bloc entier. */}
      {/* Bandeau de sortie du plein écran : sans lui, on ne saurait pas
          comment revenir au document (la barre du tableau ne suit pas le
          scroll d'une grande grille). */}
      {tableFullscreen.active && (
        <div className="fixed inset-x-0 top-0 z-[62] flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-md">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Table2 aria-hidden className="size-4" />
            Tableau en plein écran
          </span>
          <button
            type="button"
            onClick={tableFullscreen.exit}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-foreground transition-colors duration-150 hover:bg-accent"
          >
            <Minimize2 aria-hidden className="size-3.5" />
            Quitter
            <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.5 font-sans text-[0.65rem] text-muted-foreground">
              Échap
            </kbd>
          </button>
        </div>
      )}

      {editor && (
        <TableToolbar
          editor={editor}
          fullscreen={tableFullscreen.active}
          onToggleFullscreen={tableFullscreen.toggle}
        />
      )}

      <EditorContent editor={editor} />

      {editor && (
        <DragHandle editor={editor}>
          {/* Poignée de déplacement : la zone tactile fait 24px, l'icône
              reste discrète jusqu'au survol. */}
          <div className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:cursor-grabbing">
            <GripVertical className="size-4" />
          </div>
        </DragHandle>
      )}
      </div>
      </ImagePageProvider>
      </KanbanDialogProvider>
    </KanbanMembersProvider>
  );
}

/** Champ de titre auto-extensible. Le serif de la DA à grande échelle, sans
 * bordure, pour que le titre se lise comme la première ligne du document. */
function TitleField({
  value,
  onChange,
  onBlur,
  onEnter,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter: () => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // La hauteur suit le contenu, y compris au premier rendu et quand la
  // fenêtre change de largeur (le retour à la ligne se déplace).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function resize() {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);

  return (
    <>
      <label htmlFor="page-title" className="sr-only">
        Titre de la page
      </label>
      <textarea
        id="page-title"
        ref={ref}
        rows={1}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          // Entrée passe au corps du document au lieu d'insérer un saut de
          // ligne dans le titre.
          if (e.key === "Enter") {
            e.preventDefault();
            onBlur();
            onEnter();
          }
        }}
        placeholder="Sans titre"
        spellCheck={false}
        className="mt-1 mb-5 w-full resize-none overflow-hidden border-none bg-transparent p-0 font-heading text-[clamp(2rem,7vw,3.25rem)] leading-[1.08] text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:outline-none"
      />
    </>
  );
}
