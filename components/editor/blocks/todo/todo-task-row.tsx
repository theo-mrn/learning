"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StrikeThrough } from "./strike-through";
import { PRIORITY_CONFIG } from "../kanban/kanban-colors";
import type { KanbanPriority } from "../kanban/kanban-types";
import {
  createSubtaskId,
  formatDueDate,
  isOverdue,
  type TodoTask,
} from "./todo-types";

const PRIORITY_ORDER: KanbanPriority[] = ["none", "low", "medium", "high", "urgent"];

export function TodoTaskRow({
  task,
  onChange,
  onDelete,
  /** En lecture seule : cases à cocher, champs et menu sont inertes, mais la
   * tâche et ses sous-tâches restent lisibles. */
  canEdit = true,
}: {
  task: TodoTask;
  onChange: (next: TodoTask) => void;
  onDelete: () => void;
  canEdit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;
  const overdue = isOverdue(task.dueDate) && !task.completed;

  function addSubtask() {
    const text = newSubtask.trim();
    if (!text) return;
    onChange({
      ...task,
      subtasks: [
        ...task.subtasks,
        { id: createSubtaskId(), text, completed: false },
      ],
    });
    setNewSubtask("");
    setExpanded(true);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group/task rounded-lg border border-transparent transition-colors hover:border-border/60 hover:bg-muted/30 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-1.5 px-1.5 py-1.5">
        {/* Poignée : le glisser appartient à la tâche, pas au document.
            Inerte en lecture seule — réordonner écrit dans le document. */}
        <button
          type="button"
          disabled={!canEdit}
          {...(canEdit ? attributes : {})}
          {...(canEdit ? listeners : {})}
          aria-label={`Déplacer « ${task.text || "Sans titre"} »`}
          className="mt-0.5 flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity group-hover/task:opacity-100 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>

        <Checkbox
          checked={task.completed}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            onChange({ ...task, completed: checked === true })
          }
          aria-label={`Marquer « ${task.text || "Sans titre"} » comme terminée`}
          className="mt-1"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Le champ occupe toute la ligne, mais le trait doit s'arrêter à
                la fin du texte. La largeur du texte d'un `<input>` n'est pas
                mesurable en CSS : on superpose donc un double invisible qui
                porte la même chaîne et donne sa largeur à la piste de grille.
                Champ et trait s'empilent dans cette piste. */}
            <span className="relative grid min-w-0 flex-1 grid-cols-[auto_1fr] items-center">
              <span className="relative col-start-1 row-start-1 justify-self-start">
                <span
                  aria-hidden="true"
                  className="invisible block whitespace-pre text-sm"
                >
                  {task.text || " "}
                </span>
                <StrikeThrough checked={task.completed} />
              </span>
              <input
                value={task.text}
                readOnly={!canEdit}
                onChange={(e) => onChange({ ...task, text: e.target.value })}
                placeholder="Nouvelle tâche…"
                className={`col-span-2 col-start-1 row-start-1 w-full bg-transparent text-sm outline-none transition-colors duration-300 placeholder:text-muted-foreground/60 ${
                  task.completed ? "text-muted-foreground" : "text-foreground"
                }`}
              />
            </span>

            {/* Compteur de sous-tâches : visible d'un coup d'œil, replié. */}
            {task.subtasks.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[0.7rem] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight
                  className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                {doneSubtasks}/{task.subtasks.length}
              </button>
            )}
          </div>

          {/* Métadonnées : n'occupent une ligne que si elles existent. */}
          {(task.priority !== "none" || task.dueDate) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {task.priority !== "none" && (
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.65rem] font-medium ${priority.badgeClass}`}
                >
                  <span className={`size-1.5 rounded-full ${priority.dot}`} />
                  {priority.label}
                </span>
              )}
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.65rem] font-medium ${
                    overdue
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-border/60 bg-muted/60 text-muted-foreground"
                  }`}
                >
                  <CalendarDays className="size-2.5" />
                  {formatDueDate(task.dueDate)}
                  {overdue && " · en retard"}
                </span>
              )}
            </div>
          )}

          {/* Sous-tâches */}
          {expanded && task.subtasks.length > 0 && (
            <ul className="flex flex-col gap-0.5 border-l border-border/60 pl-2">
              {task.subtasks.map((sub) => (
                <li key={sub.id} className="group/sub flex items-center gap-2">
                  <Checkbox
                    checked={sub.completed}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...task,
                        subtasks: task.subtasks.map((s) =>
                          s.id === sub.id
                            ? { ...s, completed: checked === true }
                            : s
                        ),
                      })
                    }
                    aria-label={`Marquer « ${sub.text || "Sans titre"} » comme terminée`}
                    className="size-3.5 [&>span>svg]:size-2.5"
                  />
                  <span className="relative grid min-w-0 flex-1 grid-cols-[auto_1fr] items-center">
                    <span className="relative col-start-1 row-start-1 justify-self-start">
                      <span
                        aria-hidden="true"
                        className="invisible block whitespace-pre text-xs"
                      >
                        {sub.text || " "}
                      </span>
                      {/* Texte plus petit : trait plus fin et plus rapide. */}
                      <StrikeThrough
                        checked={sub.completed}
                        strokeWidth={1.5}
                        duration={0.5}
                      />
                    </span>
                    <input
                      value={sub.text}
                      readOnly={!canEdit}
                      onChange={(e) =>
                        onChange({
                          ...task,
                          subtasks: task.subtasks.map((s) =>
                            s.id === sub.id ? { ...s, text: e.target.value } : s
                          ),
                        })
                      }
                      className={`col-span-2 col-start-1 row-start-1 w-full bg-transparent text-xs outline-none transition-colors duration-300 ${
                        sub.completed
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    />
                  </span>
                  <button
                    type="button"
                    hidden={!canEdit}
                    onClick={() =>
                      onChange({
                        ...task,
                        subtasks: task.subtasks.filter((s) => s.id !== sub.id),
                      })
                    }
                    aria-label="Supprimer la sous-tâche"
                    className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/sub:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {expanded && canEdit && (
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              onBlur={addSubtask}
              placeholder="Ajouter une sous-tâche…"
              className="ml-2 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
          )}
        </div>

        {/* Menu de la tâche : priorité, échéance, sous-tâches, suppression —
            toutes des écritures, donc absent en lecture seule. */}
        {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Options de « ${task.text || "Sans titre"} »`}
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity group-hover/task:opacity-100 hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Flag className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1 text-[0.65rem] font-medium text-muted-foreground">
              Priorité
            </div>
            {PRIORITY_ORDER.map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => onChange({ ...task, priority: p })}
              >
                <span className={`size-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                {PRIORITY_CONFIG[p].label}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <div className="px-2 py-1.5">
              <label className="mb-1 block text-[0.65rem] font-medium text-muted-foreground">
                Échéance
              </label>
              <input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) =>
                  onChange({ ...task, dueDate: e.target.value || null })
                }
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
              />
            </div>

            <DropdownMenuItem onClick={() => setExpanded(true)}>
              <Plus className="size-3.5" />
              Ajouter une sous-tâche
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
              Supprimer la tâche
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </li>
  );
}
