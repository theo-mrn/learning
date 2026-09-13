"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { KanbanAssignee } from "./kanban-types";

/**
 * Les membres de l'espace courant, rendus accessibles aux NodeViews du
 * Kanban.
 *
 * Même contrainte que pour l'identifiant de page (`ImagePageProvider`) : un
 * NodeView est monté par ProseMirror, pas par l'arbre React de la page, donc
 * il ne reçoit aucune prop de `PageEditor`. Le contexte est le seul chemin
 * qui traverse cette frontière.
 *
 * La liste est calculée côté serveur (elle vient de `workspace_members`), et
 * ne contient jamais que des membres de l'espace : on ne peut donc pas
 * assigner une carte à quelqu'un qui n'y a pas accès.
 */
type MembersValue = {
  members: KanbanAssignee[];
  /** Identifiant de l'utilisateur courant, pour le filtre « mes tâches ». */
  currentUserId: string | null;
};

const KanbanMembersContext = createContext<MembersValue>({
  members: [],
  currentUserId: null,
});

export function KanbanMembersProvider({
  members,
  currentUserId,
  children,
}: {
  members: KanbanAssignee[];
  currentUserId: string | null;
  children: ReactNode;
}) {
  return (
    <KanbanMembersContext.Provider value={{ members, currentUserId }}>
      {children}
    </KanbanMembersContext.Provider>
  );
}

export function useKanbanMembers(): MembersValue {
  return useContext(KanbanMembersContext);
}
