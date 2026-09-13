"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Eye,
  EyeOff,
  ListTodo,
  MoreHorizontal,
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
import { TodoTaskRow } from "./todo-task-row";
import { useBlockEditable } from "../common/use-block-editable";
import {
  countProgress,
  createTaskId,
  TODO_DEFAULT_TITLE,
  type TodoTask,
} from "./todo-types";

export function TodoBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  // `editable: false` ne bride pas ce bloc : son NodeView déclare
  // `stopEvent: () => true`, donc ProseMirror ne voit pas ses événements.
  const canEdit = useBlockEditable(editor);
  const title = (node.attrs.title as string) || TODO_DEFAULT_TITLE;
  const tasks = useMemo(
    () => (node.attrs.tasks as TodoTask[]) ?? [],
    [node.attrs.tasks]
  );
  // Masquer les tâches terminées est un **choix de vue**, pas une donnée.
  // En écriture, on le mémorise dans le document (tout le monde retrouve la
  // même présentation) ; en lecture seule, il reste local à l'onglet — un
  // lecteur doit pouvoir filtrer sans modifier la page de quelqu'un d'autre.
  const [localHideCompleted, setLocalHideCompleted] = useState(
    Boolean(node.attrs.hideCompleted)
  );
  const hideCompleted = canEdit
    ? Boolean(node.attrs.hideCompleted)
    : localHideCompleted;

  function toggleHideCompleted() {
    if (canEdit) {
      updateAttributes({ hideCompleted: !hideCompleted });
    } else {
      setLocalHideCompleted((value) => !value);
    }
  }

  const dndContextId = useId();
  const [newTaskText, setNewTaskText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const setTasks = useCallback(
    (next: TodoTask[]) => updateAttributes({ tasks: next }),
    [updateAttributes]
  );

  const { done, total } = countProgress(tasks);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // Le masquage ne filtre que l'affichage : les tâches terminées restent
  // dans le document, sinon les décocher deviendrait impossible.
  const visibleTasks = hideCompleted ? tasks.filter((t) => !t.completed) : tasks;

  function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    setTasks([
      ...tasks,
      {
        id: createTaskId(),
        text,
        completed: false,
        priority: "none",
        dueDate: null,
        subtasks: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewTaskText("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = tasks.findIndex((t) => t.id === active.id);
    const to = tasks.findIndex((t) => t.id === over.id);
    if (from === -1 || to === -1) return;
    setTasks(arrayMove(tasks, from, to));
  }

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="todo-node-view not-prose my-6 w-full"
    >
      <div
        // Le geste appartient au bloc, pas à l'éditeur de page : sans ça,
        // ProseMirror démarre une sélection de nœud au `mousedown` et le
        // glisser des tâches part dans le document.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative w-full rounded-2xl border bg-card/50 shadow-paper transition-colors ${
          selected ? "border-primary/50" : "border-border/70"
        }`}
      >
        {/* En-tête : titre, progression, actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <ListTodo className="size-3.5" />
            </span>
            <input
              value={title}
              readOnly={!canEdit}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              aria-label="Titre de la liste"
              className={`min-w-0 flex-1 truncate rounded bg-transparent px-1 py-0.5 font-heading text-sm font-medium text-foreground outline-none ${
                canEdit ? "hover:bg-muted/60 focus-visible:bg-muted/60" : ""
              }`}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {total > 0 && (
              <div className="flex items-center gap-1.5">
                <div
                  className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progression : ${done} sur ${total}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span
                  data-numeric
                  className="text-[0.7rem] tabular-nums text-muted-foreground"
                >
                  {done}/{total}
                </span>
              </div>
            )}

            {/* Toujours actif, y compris en lecture seule : c'est un filtre
                d'affichage. Je l'avais désactivé à tort. */}
            <button
              type="button"
              onClick={toggleHideCompleted}
              title={
                hideCompleted
                  ? "Afficher les tâches terminées"
                  : "Masquer les tâches terminées"
              }
              aria-pressed={hideCompleted}
              className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {hideCompleted ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>

            {/* Le menu ne contient que des écritures (purger les tâches
                faites, supprimer la liste) : inutile en lecture seule. */}
            {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Options de la liste"
                    className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => setTasks(tasks.filter((t) => !t.completed))}
                  disabled={done === 0}
                >
                  <Trash2 className="size-3.5" />
                  Effacer les tâches terminées
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={deleteNode}>
                  <Trash2 className="size-3.5" />
                  Supprimer la liste
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>

        {/* Tâches */}
        <div className="px-2 py-1.5">
          {tasks.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Aucune tâche pour le moment.
            </p>
          ) : visibleTasks.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Tout est terminé. Les tâches faites sont masquées.
            </p>
          ) : (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col">
                  {visibleTasks.map((task) => (
                    <TodoTaskRow
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      onChange={(next) =>
                        setTasks(tasks.map((t) => (t.id === next.id ? next : t)))
                      }
                      onDelete={() =>
                        setTasks(tasks.filter((t) => t.id !== task.id))
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {/* Ajout rapide — masqué en lecture seule. */}
          {canEdit && (
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <Plus className="size-3.5 shrink-0 text-muted-foreground/60" />
            <input
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTask();
                }
              }}
              onBlur={addTask}
              placeholder="Ajouter une tâche…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
