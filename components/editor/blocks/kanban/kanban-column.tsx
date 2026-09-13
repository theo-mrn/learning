"use client";

import { useMemo, useState } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLUMN_COLORS, getColumnColor } from "./kanban-colors";
import { KanbanCardComponent } from "./kanban-card";
import type { KanbanCard, KanbanColumn } from "./kanban-types";

interface KanbanColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  onUpdateTitle: (newTitle: string) => void;
  onUpdateColor: (newColor: string) => void;
  onDeleteColumn: () => void;
  onClearColumn: () => void;
  onAddCard: () => void;
  onCardClick: (card: KanbanCard) => void;
  onDeleteCard: (cardId: string) => void;
  /** `false` pour un membre en lecture seule : la colonne se consulte. */
  canEdit?: boolean;
}

export function KanbanColumnComponent({
  column,
  cards,
  onUpdateTitle,
  onUpdateColor,
  onDeleteColumn,
  onClearColumn,
  onAddCard,
  onCardClick,
  onDeleteCard,
  canEdit = true,
}: KanbanColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(column.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
    // Réordonner écrit dans le document : glisser est inerte en lecture seule.
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const colorConfig = getColumnColor(column.color);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && tempTitle !== column.title) {
      onUpdateTitle(tempTitle.trim());
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/col flex flex-1 min-w-[210px] min-h-[140px] max-h-[500px] flex-col rounded-xl bg-muted/35 p-2.5 transition-all ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* En-tête sobre de colonne */}
      <div
        className="flex shrink-0 items-center justify-between gap-1 px-1 py-1"
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {/* Badge de statut */}
          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSubmit();
                if (e.key === "Escape") {
                  setTempTitle(column.title);
                  setIsEditingTitle(false);
                }
              }}
              className="h-6 w-28 rounded border border-primary/50 bg-background px-1.5 text-xs font-medium text-foreground outline-none"
            />
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${colorConfig.badgeBg} ${colorConfig.badgeText} border ${colorConfig.badgeBorder}`}
            >
              <span className={`size-1.5 rounded-full ${colorConfig.dot}`} />
              <span className="truncate max-w-[130px]">{column.title}</span>
            </span>
          )}

          {/* Compteur discret */}
          <span className="text-[0.7rem] text-muted-foreground/70 font-mono">
            {cards.length}
          </span>
        </div>

        {/* Boutons discrets : Ajout rapide et Menu 3 petits points.
            Tous deux n'offrent que des écritures : absents en lecture seule. */}
        <div className="flex items-center gap-0.5">
          {canEdit && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddCard();
            }}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/80 hover:text-foreground"
            title="Ajouter une tâche"
          >
            <Plus className="size-3.5" />
          </button>
          )}

          {/* Menu 3 petits points pour configurer la colonne */}
          {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/80 hover:text-foreground"
                  title="Configurer la colonne"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  setTempTitle(column.title);
                  setIsEditingTitle(true);
                }}
              >
                <Pencil className="size-3.5 mr-2" />
                Renommer
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="px-2 py-1 text-[0.65rem] font-medium text-muted-foreground">
                Couleur
              </div>
              <div className="grid grid-cols-6 gap-1 px-2 pb-1.5">
                {COLUMN_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onUpdateColor(col.id)}
                    className={`size-4 rounded-full ${col.dot} ring-offset-background transition-transform hover:scale-125 ${
                      column.color === col.id
                        ? "ring-2 ring-primary ring-offset-1"
                        : ""
                    }`}
                    title={col.name}
                  />
                ))}
              </div>

              <DropdownMenuSeparator />

              {cards.length > 0 && (
                <DropdownMenuItem onClick={onClearColumn}>
                  <Trash2 className="size-3.5 mr-2" />
                  Vider la colonne
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDeleteColumn}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>

      {/* Cartes Sortables avec zone de défilement dédiée */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain py-1 pr-0.5">
          {cards.map((card) => (
            <KanbanCardComponent
              key={card.id}
              card={card}
              columnId={column.id}
              onClick={() => onCardClick(card)}
              onDelete={() => onDeleteCard(card.id)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </SortableContext>

      {/* Bouton épuré + Nouveau ouvrant la modale */}
      {canEdit && (
        <div className="shrink-0 pt-1.5 mt-auto">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddCard();
            }}
            className="flex h-7 w-full items-center justify-start gap-1.5 rounded-md px-2 text-xs text-muted-foreground/60 transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            <span>Nouveau</span>
          </button>
        </div>
      )}
    </div>
  );
}
