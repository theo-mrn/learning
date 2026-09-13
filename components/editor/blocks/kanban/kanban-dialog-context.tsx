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
      payload?.onSave(card, columnId);
      setPayload(null);
    },
    [payload]
  );

  const handleDuplicate = useCallback(
    (cardId: string) => {
      payload?.onDuplicateCard?.(cardId);
      setPayload(null);
    },
    [payload]
  );

  const handleDelete = useCallback(
    (cardId: string) => {
      payload?.onDeleteCard?.(cardId);
      setPayload(null);
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
