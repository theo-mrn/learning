"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { KanbanCardDialog } from "./kanban-card-dialog";
import type { KanbanCard, KanbanColumn } from "./kanban-types";

// ── Types ─────────────────────────────────────────────────────────────

interface DialogPayload {
  card: KanbanCard;
  columns: KanbanColumn[];
  currentColumnId: string;
  isNew: boolean;
  /** Saves the card (column update); the provider auto-closes after. */
  onSave: (card: KanbanCard, targetColumnId: string) => void;
  onDuplicateCard?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  /** `false` pour un membre en lecture seule : la carte s'ouvre pour être
   * lue, sans champ modifiable ni bouton d'enregistrement. C'était le dernier
   * trou — le dialogue ignorait complètement le rôle. */
  canEdit?: boolean;
}

interface KanbanDialogContextValue {
  openDialog: (payload: DialogPayload) => void;
  closeDialog: () => void;
}

// ── Context ───────────────────────────────────────────────────────────

const KanbanDialogContext = createContext<KanbanDialogContextValue | null>(
  null
);

export function useKanbanDialog(): KanbanDialogContextValue {
  const ctx = useContext(KanbanDialogContext);
  if (!ctx)
    throw new Error(
      "useKanbanDialog must be used within a <KanbanDialogProvider>"
    );
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────

/**
 * Renders the KanbanCardDialog **outside** the Tiptap NodeView tree.
 *
 * Tiptap's ReactNodeViewRenderer destroys & recreates the React subtree
 * on certain ProseMirror transactions (focus changes, selection updates).
 * A modal Dialog that traps focus *inside* a NodeView creates a feedback
 * loop:  dialog opens → focus trap → Tiptap remounts → state lost.
 *
 * By lifting the dialog to the page level, focus management no longer
 * interferes with ProseMirror.  The KanbanBoard simply calls
 * `openDialog(payload)` with the necessary data & callbacks.
 */
export function KanbanDialogProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DialogPayload | null>(null);

  const openDialog = useCallback((data: DialogPayload) => {
    setPayload(data);
  }, []);

  const closeDialog = useCallback(() => {
    setPayload(null);
  }, []);

  // ── Wrapped callbacks that auto-close after the operation ──

  const handleClose = useCallback(() => {
    setPayload(null);
  }, []);

  const handleSave = useCallback(
    (card: KanbanCard, columnId: string) => {
      const save = payload?.onSave;
      if (!save) return;

      // La fermeture est différée d'un tick.
      //
      // `setPayload(null)` démonte `KanbanCardDialogContent` (rendu sous
      // `{card && ...}`). Appelée dans la même passe que `onSave`, React
      // regroupe les deux : le démontage pouvait intervenir avant que la
      // transaction ProseMirror déclenchée par `updateAttributes` ne soit
      // committée, et l'écriture était perdue sans erreur — la carte
      // n'apparaissait jamais et n'atteignait jamais la base.
      //
      // Constaté au navigateur : une colonne ajoutée depuis l'INTÉRIEUR du
      // NodeView (même `onChange`) était bien persistée, alors qu'une carte
      // créée depuis ce dialogue ne l'était pas. La seule différence était
      // ce démontage synchrone.
      save(card, columnId);
      setTimeout(() => setPayload(null), 0);
    },
    [payload]
  );

  // Même précaution que pour `handleSave` : ces deux callbacks écrivent aussi
  // dans le document, donc la fermeture ne doit pas démonter l'émetteur avant
  // que la transaction soit committée.
  const handleDuplicate = useCallback(
    (cardId: string) => {
      const duplicate = payload?.onDuplicateCard;
      if (!duplicate) return;
      duplicate(cardId);
      setTimeout(() => setPayload(null), 0);
    },
    [payload]
  );

  const handleDelete = useCallback(
    (cardId: string) => {
      const remove = payload?.onDeleteCard;
      if (!remove) return;
      remove(cardId);
      setTimeout(() => setPayload(null), 0);
    },
    [payload]
  );

  return (
    <KanbanDialogContext.Provider value={{ openDialog, closeDialog }}>
      {children}

      {/* Dialog rendered at the page level – outside Tiptap's reach */}
      <KanbanCardDialog
        isOpen={payload !== null}
        isNew={payload?.isNew ?? false}
        card={payload?.card ?? null}
        columns={payload?.columns ?? []}
        currentColumnId={payload?.currentColumnId ?? ""}
        onClose={handleClose}
        onSave={handleSave}
        onDuplicateCard={handleDuplicate}
        onDeleteCard={handleDelete}
        canEdit={payload?.canEdit ?? true}
      />
    </KanbanDialogContext.Provider>
  );
}
