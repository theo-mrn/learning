export type KanbanPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface KanbanTag {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

/**
 * Personne assignée à une carte.
 *
 * Le nom et l'email sont **recopiés** dans le document, pas seulement
 * référencés par `userId` : un membre retiré de l'espace (ou dont le compte
 * disparaît) laisserait sinon des cartes assignées à un identifiant
 * inconnu, impossible à afficher. La copie garde la carte lisible, et
 * `userId` reste la clé pour filtrer « mes tâches ».
 */
export interface KanbanAssignee {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority: KanbanPriority;
  dueDate?: string | null;
  tags: KanbanTag[];
  checklists: ChecklistItem[];
  /** Plusieurs assignés possibles par carte. Optionnel : toutes les cartes
   * créées avant cette fonctionnalité n'ont pas ce champ. */
  assignees?: KanbanAssignee[];
  createdAt?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

export interface KanbanData {
  title: string;
  columns: KanbanColumn[];
}

export interface KanbanFilterState {
  searchQuery: string;
  priority: KanbanPriority | "all";
  tagId: string | "all";
  /** `"all"` = tout le monde, `"me"` = mes tâches, sinon un `userId`. */
  assigneeId: string | "all" | "me";
}

/** Initiales pour un avatar de repli : « Théo Morin » → « TM ». */
export function assigneeInitials(assignee: KanbanAssignee): string {
  const source = assignee.name?.trim() || assignee.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Libellé court d'un assigné, pour les infobulles et le sélecteur. */
export function assigneeLabel(assignee: KanbanAssignee): string {
  return assignee.name?.trim() || assignee.email;
}
