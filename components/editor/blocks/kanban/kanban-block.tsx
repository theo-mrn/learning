"use client";

import { useCallback, useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { KanbanBoard } from "./kanban-board";
import { useBlockEditable } from "../common/use-block-editable";
import type { KanbanColumn } from "./kanban-types";

export function KanbanBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const canEdit = useBlockEditable(editor);
  const columns = (node.attrs.columns as KanbanColumn[]) || [];

  /**
   * `updateAttributes` est recréé par Tiptap à chaque transaction, et
   * l'ancienne fonction pointe sur une position de nœud qui peut être
   * devenue invalide.
   *
   * Le dialogue de carte est monté HORS de l'arbre Tiptap (dans
   * `KanbanDialogProvider`, pour que son piège de focus ne fasse pas
   * remonter ProseMirror). Son `onSave` est donc appelé longtemps après, à
   * travers des callbacks figés (`handleSaveCard` est un `useCallback`) qui
   * capturaient le `updateAttributes` du rendu d'origine : l'écriture
   * partait dans le vide, sans erreur, et la carte n'apparaissait jamais.
   *
   * La ref, synchronisée après chaque rendu, garantit qu'on écrit toujours
   * avec la fonction courante. Même correctif que pour le bloc image.
   */
  const updateAttributesRef = useRef(updateAttributes);
  const nodeRef = useRef(node);
  useEffect(() => {
    updateAttributesRef.current = updateAttributes;
    nodeRef.current = node;
  });

  /**
   * `onChange` reçoit désormais une **fonction** de mise à jour, pas un
   * tableau déjà calculé.
   *
   * Raison : le dialogue de carte, monté hors de l'arbre Tiptap, appelle
   * `onSave` plusieurs secondes après son ouverture. Le tableau qu'il avait
   * capturé à ce moment-là peut ne plus refléter le document. En passant une
   * fonction, on lit les colonnes **au moment de l'écriture**, depuis le
   * nœud courant — jamais depuis une copie vieillie.
   */
  const handleColumnsChange = useCallback(
    (
      next:
        | KanbanColumn[]
        | ((current: KanbanColumn[]) => KanbanColumn[])
    ) => {
      const current =
        (nodeRef.current.attrs.columns as KanbanColumn[]) || [];
      const value = typeof next === "function" ? next(current) : next;
      updateAttributesRef.current({ columns: value });
    },
    []
  );

  return (
    <NodeViewWrapper
      contentEditable={false}
      className={`kanban-node-view not-prose my-6 w-full select-none rounded-xl transition-all ${
        selected ? "ring-1 ring-primary/30" : ""
      }`}
    >
      <KanbanBoard
        columns={columns}
        onChange={handleColumnsChange}
        onDeleteBlock={deleteNode}
        canEdit={canEdit}
      />
    </NodeViewWrapper>
  );
}
