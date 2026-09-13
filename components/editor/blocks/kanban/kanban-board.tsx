"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCardComponent } from "./kanban-card";
import { KanbanColumnComponent } from "./kanban-column";
import { useKanbanDialog } from "./kanban-dialog-context";
import { useKanbanMembers } from "./kanban-members-context";
import {
  assigneeLabel,
  type KanbanCard,
  type KanbanColumn,
} from "./kanban-types";

interface KanbanBoardProps {
  columns: KanbanColumn[];
  /** Accepte une fonction de mise à jour : les callbacks appelés depuis le
   * dialogue (monté hors de l'arbre Tiptap) doivent lire les colonnes au
   * moment de l'écriture, pas une copie capturée à l'ouverture. */
  onChange: (
    next: KanbanColumn[] | ((current: KanbanColumn[]) => KanbanColumn[])
  ) => void;
  onDeleteBlock?: () => void;
  /** `false` pour un membre en lecture seule : le tableau se consulte, mais
   * aucun glisser, ajout ni suppression n'est possible. */
  canEdit?: boolean;
}

type ActiveItem =
  | { type: "card"; card: KanbanCard; columnId: string }
  | { type: "column"; column: KanbanColumn }
  | null;

function createCardId(): string {
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createColumnId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function KanbanBoard({
  columns,
  onChange,
  onDeleteBlock,
  canEdit = true,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<ActiveItem>(null);
  const { openDialog } = useKanbanDialog();
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const dndContextId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // ── Filtres de vue (état local, jamais persisté) ────────────────────
  const { members, currentUserId } = useKanbanMembers();
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Pas de filtre « masquer les tâches terminées » : dans un Kanban, les
  // tâches terminées SONT la colonne « Terminé ». Le tableau porte déjà
  // l'information, un bouton pour la masquer n'apportait rien.

  /** Le filtre par assigné est le seul : il suspend le glisser (dnd-kit
   * calcule ses index sur la liste visible, les handlers les appliquent sur
   * la liste complète). */
  const isFiltered = assigneeFilter !== "all";

  const hasAssignees = members.length > 0;

  /** Colonnes affichées : la structure reste intacte, seules les cartes
   * visibles changent. On ne touche jamais `columns` (la donnée). */
  const visibleColumns = useMemo(() => {
    if (assigneeFilter === "all") return columns;

    const wanted = assigneeFilter === "me" ? currentUserId : assigneeFilter;

    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) =>
        (card.assignees ?? []).some((a) => a.userId === wanted)
      ),
    }));
  }, [columns, assigneeFilter, currentUserId]);

  // --- Handlers de Drag & Drop ---
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === "card") {
      setActiveItem({
        type: "card",
        card: data.card,
        columnId: data.columnId,
      });
    } else if (data?.type === "column") {
      setActiveItem({
        type: "column",
        column: data.column,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== "card") return;

    const activeCardId = activeId;
    const sourceColumnId = activeData.columnId;

    let targetColumnId: string | null = null;
    if (overData?.type === "column") {
      targetColumnId = overData.column.id;
    } else if (overData?.type === "card") {
      targetColumnId = overData.columnId;
    }

    if (!targetColumnId || sourceColumnId === targetColumnId) return;

    const sourceColIndex = columns.findIndex((c) => c.id === sourceColumnId);
    const targetColIndex = columns.findIndex((c) => c.id === targetColumnId);
    if (sourceColIndex === -1 || targetColIndex === -1) return;

    const sourceCol = columns[sourceColIndex];
    const targetCol = columns[targetColIndex];
    const cardToMove = sourceCol.cards.find((c) => c.id === activeCardId);
    if (!cardToMove) return;

    const newSourceCards = sourceCol.cards.filter((c) => c.id !== activeCardId);
    const newTargetCards = [...targetCol.cards];

    const overCardIndex = newTargetCards.findIndex((c) => c.id === overId);
    if (overCardIndex >= 0) {
      newTargetCards.splice(overCardIndex, 0, cardToMove);
    } else {
      newTargetCards.push(cardToMove);
    }

    const newColumns = [...columns];
    newColumns[sourceColIndex] = { ...sourceCol, cards: newSourceCards };
    newColumns[targetColIndex] = { ...targetCol, cards: newTargetCards };

    activeData.columnId = targetColumnId;

    onChange(newColumns);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeData = active.data.current;

    // Réordonner les colonnes
    if (activeData?.type === "column") {
      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(columns, oldIndex, newIndex));
      }
      return;
    }

    // Réordonner les cartes au sein d'une même colonne
    if (activeData?.type === "card") {
      const columnId = activeData.columnId;
      const colIndex = columns.findIndex((c) => c.id === columnId);
      if (colIndex === -1) return;

      const col = columns[colIndex];
      const oldIndex = col.cards.findIndex((c) => c.id === activeId);
      const newIndex = col.cards.findIndex((c) => c.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newCards = arrayMove(col.cards, oldIndex, newIndex);
        const newColumns = [...columns];
        newColumns[colIndex] = { ...col, cards: newCards };
        onChange(newColumns);
      }
    }
  };

  // --- Handlers de colonnes ---
  const handleAddColumn = () => {
    const title = newColumnTitle.trim() || "Nouvelle colonne";
    const newCol: KanbanColumn = {
      id: createColumnId(),
      title,
      color: "slate",
      cards: [],
    };
    onChange([...columns, newCol]);
    setNewColumnTitle("");
    setIsAddingColumn(false);
  };

  const handleUpdateColumnTitle = (columnId: string, title: string) => {
    onChange(
      columns.map((c) => (c.id === columnId ? { ...c, title } : c))
    );
  };

  const handleUpdateColumnColor = (columnId: string, color: string) => {
    onChange(
      columns.map((c) => (c.id === columnId ? { ...c, color } : c))
    );
  };

  const handleDeleteColumn = (columnId: string) => {
    onChange(columns.filter((c) => c.id !== columnId));
  };

  const handleClearColumn = (columnId: string) => {
    onChange(
      columns.map((c) => (c.id === columnId ? { ...c, cards: [] } : c))
    );
  };

  // --- Handlers de cartes ---
  const handleSaveCard = useCallback(
    (savedCard: KanbanCard, targetColumnId: string, isNew: boolean, initialColumnId: string) => {
      // Les colonnes sont lues DANS la fonction de mise à jour : ce callback
      // est invoqué par le dialogue, hors de l'arbre Tiptap, donc toute copie
      // capturée plus tôt (y compris `columnsRef` de cette instance) peut
      // appartenir à un rendu périmé — c'est ce qui faisait disparaître les
      // cartes sans aucune erreur.
      if (isNew) {
        onChange((cols) =>
          cols.map((col) =>
            col.id === targetColumnId
              ? { ...col, cards: [...col.cards, savedCard] }
              : col
          )
        );
      } else {
        if (initialColumnId === targetColumnId) {
          onChange((cols) =>
            cols.map((col) =>
              col.id === targetColumnId
                ? {
                    ...col,
                    cards: col.cards.map((c) =>
                      c.id === savedCard.id ? savedCard : c
                    ),
                  }
                : col
            )
          );
        } else {
          onChange((cols) =>
            cols.map((col) => {
              if (col.id === initialColumnId) {
                return {
                  ...col,
                  cards: col.cards.filter((c) => c.id !== savedCard.id),
                };
              }
              if (col.id === targetColumnId) {
                return {
                  ...col,
                  cards: [...col.cards, savedCard],
                };
              }
              return col;
            })
          );
        }
      }
    },
    [onChange]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      // Appelé depuis le dialogue : on lit les colonnes au moment de
      // l'écriture, pas depuis `columnsRef` (ref de cette instance, qui peut
      // appartenir à un rendu que ProseMirror a déjà remplacé).
      onChange((cols) =>
        cols.map((c) => ({
          ...c,
          cards: c.cards.filter((card) => card.id !== cardId),
        }))
      );
    },
    [onChange]
  );

  const handleDuplicateCard = useCallback(
    (cardId: string) => {
      // Tout le calcul se fait DANS la fonction de mise à jour : appelé depuis
      // le dialogue, ce callback ne doit rien lire d'une copie capturée plus
      // tôt, sinon la copie est ajoutée à un état périmé et disparaît.
      onChange((cols) => {
        const col = cols.find((c) =>
          c.cards.some((card) => card.id === cardId)
        );
        if (!col) return cols;
        const original = col.cards.find((c) => c.id === cardId);
        if (!original) return cols;

        const duplicated: KanbanCard = {
          ...original,
          id: createCardId(),
          title: `${original.title} (copie)`,
          createdAt: new Date().toISOString(),
        };

        const cardIndex = col.cards.findIndex((c) => c.id === cardId);
        const newCards = [...col.cards];
        newCards.splice(cardIndex + 1, 0, duplicated);

        return cols.map((c) =>
          c.id === col.id ? { ...c, cards: newCards } : c
        );
      });
    },
    [onChange]
  );

  const handleOpenCreateCardDialog = useCallback(
    (columnId: string) => {
      const newCard: KanbanCard = {
        id: createCardId(),
        title: "",
        priority: "none",
        tags: [],
        checklists: [],
        createdAt: new Date().toISOString(),
      };
      openDialog({
        card: newCard,
        columns: columnsRef.current,
        currentColumnId: columnId,
        isNew: true,
        onSave: (savedCard, targetColId) => {
          handleSaveCard(savedCard, targetColId, true, columnId);
        },
        onDuplicateCard: handleDuplicateCard,
        onDeleteCard: handleDeleteCard,
        canEdit,
      });
    },
    [openDialog, handleSaveCard, handleDuplicateCard, handleDeleteCard, canEdit]
  );

  const handleOpenEditCardDialog = useCallback(
    (card: KanbanCard, columnId: string) => {
      openDialog({
        card,
        columns: columnsRef.current,
        currentColumnId: columnId,
        isNew: false,
        onSave: (savedCard, targetColId) => {
          handleSaveCard(savedCard, targetColId, false, columnId);
        },
        onDuplicateCard: handleDuplicateCard,
        onDeleteCard: handleDeleteCard,
        canEdit,
      });
    },
    [openDialog, handleSaveCard, handleDuplicateCard, handleDeleteCard, canEdit]
  );

  return (
    <div className="group/board relative w-full">
      {/* Filtres de vue. Volontairement en état local, JAMAIS écrits dans le
          document : filtrer est un choix de lecture, donc chacun voit ce qu'il
          veut sans modifier la page des autres — et ça reste utilisable en
          lecture seule. */}
      {/* Un seul réglage de vue, discret et en gris : c'est un filtre, pas
          une action du tableau. Les pastilles bordées d'orange faisaient
          concurrence aux colonnes. */}
      {hasAssignees && (
        <div className="mb-2 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/70">
          <SlidersHorizontal aria-hidden className="size-3 shrink-0" />
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filtrer par personne assignée"
            className="rounded bg-transparent py-0.5 pr-1 text-[0.7rem] text-inherit outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <option value="all" className="bg-popover text-popover-foreground">
              Tout le monde
            </option>
            {currentUserId && (
              <option value="me" className="bg-popover text-popover-foreground">
                Mes tâches
              </option>
            )}
            {/* L'utilisateur courant est exclu : il a déjà son entrée
                « Mes tâches » juste au-dessus, son nom faisait doublon. */}
            {members
              .filter((member) => member.userId !== currentUserId)
              .map((member) => (
                <option
                  key={member.userId}
                  value={member.userId}
                  className="bg-popover text-popover-foreground"
                >
                  {assigneeLabel(member)}
                </option>
              ))}
          </select>

          {isFiltered && canEdit && (
            <span className="text-muted-foreground/50">
              · glisser suspendu
            </span>
          )}
        </div>
      )}

      {/* Menu d'options du tableau (3 petits points discrets en haut à droite) */}
      <div className="absolute -top-6 right-0 z-10 opacity-0 transition-opacity group-hover/board:opacity-100">
        {/* Ce menu n'offre que des écritures (ajouter une colonne, supprimer
            le tableau) : absent en lecture seule. */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                  title="Options du tableau"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setIsAddingColumn(true)}>
                <Plus className="size-3.5 mr-2" />
                Ajouter une colonne
              </DropdownMenuItem>
              {onDeleteBlock && (
                <DropdownMenuItem
                  onClick={onDeleteBlock}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Supprimer le tableau
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Grille fluide de colonnes - les 3 sections sont visibles simultanément */}
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex w-full items-stretch gap-2.5 overflow-x-auto pb-2 max-h-[500px]">
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            {visibleColumns.map((col) => (
              <KanbanColumnComponent
                key={col.id}
                column={col}
                cards={col.cards}
                // Réordonner pendant qu'un filtre masque des cartes écrirait
                // un ordre faux : dnd-kit calcule ses index sur la liste
                // VISIBLE, alors que les handlers les appliquent sur la liste
                // complète. On neutralise donc le glisser tant qu'un filtre
                // est actif, plutôt que de risquer de corrompre l'ordre.
                canEdit={canEdit && !isFiltered}
                onUpdateTitle={(title) => handleUpdateColumnTitle(col.id, title)}
                onUpdateColor={(color) => handleUpdateColumnColor(col.id, color)}
                onDeleteColumn={() => handleDeleteColumn(col.id)}
                onClearColumn={() => handleClearColumn(col.id)}
                onAddCard={() => handleOpenCreateCardDialog(col.id)}
                onCardClick={(card) => handleOpenEditCardDialog(card, col.id)}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </SortableContext>

          {/* Formulaire discret pour ajouter une nouvelle colonne */}
          {isAddingColumn && canEdit && (
            <div className="flex w-48 shrink-0 h-fit flex-col gap-1.5 rounded-xl border border-border/80 bg-card p-2 shadow-xs">
              <input
                type="text"
                autoFocus
                placeholder="Nom de colonne..."
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") setIsAddingColumn(false);
                }}
                className="h-6 w-full bg-transparent px-1 text-xs text-foreground outline-none"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-medium text-primary-foreground"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="rounded px-1.5 text-[0.65rem] text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeItem?.type === "card" && (
            <div className="w-[210px]">
              <KanbanCardComponent
                card={activeItem.card}
                columnId={activeItem.columnId}
                onClick={() => {}}
                isOverlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

    </div>
  );
}
