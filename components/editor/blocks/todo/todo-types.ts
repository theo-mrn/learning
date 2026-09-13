import type { KanbanPriority } from "../kanban/kanban-types";

/** Même échelle de priorité que le Kanban : deux vocabulaires concurrents
 * dans la même app rendraient les blocs incomparables (et l'export aussi). */
export type TodoPriority = KanbanPriority;

export interface TodoSubtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface TodoTask {
  id: string;
  text: string;
  completed: boolean;
  priority: TodoPriority;
  /** Date ISO (`YYYY-MM-DD`) ou `null` si aucune échéance. */
  dueDate?: string | null;
  subtasks: TodoSubtask[];
  createdAt?: string;
}

export interface TodoAttrs {
  title: string;
  tasks: TodoTask[];
  hideCompleted: boolean;
}

export const TODO_DEFAULT_TITLE = "Liste de tâches";

export function createTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createSubtaskId(): string {
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Compte les tâches faites, sous-tâches comprises : une tâche à moitié
 * cochée ne doit pas compter comme terminée dans la progression. */
export function countProgress(tasks: TodoTask[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    total += 1;
    if (task.completed) done += 1;
    for (const sub of task.subtasks) {
      total += 1;
      if (sub.completed) done += 1;
    }
  }
  return { done, total };
}

/** Échéance dépassée ? Comparaison à la journée, pas à l'instant : une tâche
 * due aujourd'hui n'est pas en retard à 9 h du matin. */
export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return due.getTime() < today.getTime();
}

export function formatDueDate(dueDate: string): string {
  const due = new Date(`${dueDate}T00:00:00`);
  return due.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
