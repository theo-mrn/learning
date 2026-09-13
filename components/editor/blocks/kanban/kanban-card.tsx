"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  Trash2,
} from "lucide-react";
import {
  PRIORITY_CONFIG,
  getTagColorClass,
} from "./kanban-colors";
import {
  assigneeInitials,
  assigneeLabel,
  type KanbanCard,
} from "./kanban-types";

interface KanbanCardProps {
  card: KanbanCard;
  columnId: string;
  onClick: () => void;
  onDelete?: () => void;
  isOverlay?: boolean;
  /** `false` pour un membre en lecture seule : la carte s'ouvre pour lecture
   * mais ne se déplace ni ne se supprime. */
  canEdit?: boolean;
}

function isPastDueDate(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).setHours(23, 59, 59, 999);
  return due < Date.now();
}

export function KanbanCardComponent({
  card,
  columnId,
  onClick,
  onDelete,
  isOverlay = false,
  canEdit = true,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "card",
      card,
      columnId,
    },
    disabled: isOverlay || !canEdit,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priority =
    card.priority && card.priority !== "none"
      ? PRIORITY_CONFIG[card.priority]
      : null;
  const checklists = card.checklists || [];
  const completedChecklists = checklists.filter((c) => c.completed).length;

  const isOverdue = isPastDueDate(card.dueDate);

  const formattedDate = card.dueDate
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
      }).format(new Date(card.dueDate))
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group/card relative cursor-grab rounded-xl border bg-card p-2.5 shadow-2xs transition-all select-none hover:border-border/90 hover:shadow-xs active:cursor-grabbing ${
        isDragging
          ? "opacity-30 ring-2 ring-primary/40"
          : "border-border/70 hover:bg-card/95"
      } ${isOverlay ? "rotate-1 scale-102 shadow-lifted ring-2 ring-primary/50" : ""}`}
    >
      {/* Titre tout en haut sans marge parasite */}
      <div className="text-[0.8125rem] font-medium leading-snug text-card-foreground break-words pr-5">
        {card.title || "Sans titre"}
      </div>

      {/* Étiquettes juste sous le titre */}
      {(card.tags || []).length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {card.tags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium leading-none ${getTagColorClass(
                tag.color
              )}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Assignés : pile d'avatars, la donnée la plus scannée après le titre */}
      {(card.assignees ?? []).length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          {card.assignees!.slice(0, 4).map((assignee) => (
            <span
              key={assignee.userId}
              title={assigneeLabel(assignee)}
              className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[0.6rem] font-medium text-primary ring-1 ring-card"
            >
              {assigneeInitials(assignee)}
            </span>
          ))}
          {/* Au-delà de quatre, un compteur : la carte ne fait que 210px. */}
          {card.assignees!.length > 4 && (
            <span className="text-[0.65rem] text-muted-foreground">
              +{card.assignees!.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Métadonnées : date, sous-tâches, notes, priorité */}
      {(priority || formattedDate || checklists.length > 0 || card.description) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[0.68rem] text-muted-foreground/80">
          {priority && (
            <span
              className="inline-flex items-center gap-1"
              title={`Priorité : ${priority.label}`}
            >
              <span className={`size-1.5 rounded-full shrink-0 ${priority.dot}`} />
              <span className={`font-medium ${priority.textClass}`}>{priority.label}</span>
            </span>
          )}

          {formattedDate && (
            <span
              className={`inline-flex items-center gap-1 ${
                isOverdue ? "text-destructive font-medium" : ""
              }`}
              title={isOverdue ? "Échéance dépassée" : "Date d'échéance"}
            >
              <Calendar className="size-3 shrink-0 opacity-70" />
              <span>{formattedDate}</span>
            </span>
          )}

          {checklists.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 ${
                completedChecklists === checklists.length && checklists.length > 0
                  ? "text-emerald-500 font-medium"
                  : ""
              }`}
              title="Sous-tâches"
            >
              <CheckSquare className="size-3 shrink-0 opacity-70" />
              <span>{completedChecklists}/{checklists.length}</span>
            </span>
          )}

          {card.description && (
            <span title="Contient une description" className="inline-flex items-center">
              <AlignLeft className="size-3 shrink-0 opacity-70" />
            </span>
          )}
        </div>
      )}

      {/* Bouton de suppression rapide au survol uniquement */}
      {onDelete && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 flex size-4 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/card:opacity-100"
          title="Supprimer la carte"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}
