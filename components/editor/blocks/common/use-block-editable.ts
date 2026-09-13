"use client";

import { useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/core";

/**
 * Indique si le bloc doit être modifiable.
 *
 * `editable: false` sur l'éditeur ne suffit pas pour nos blocs complexes :
 * ce sont des NodeViews React déclarés avec `stopEvent: () => true`, donc
 * ProseMirror ne voit jamais leurs événements et ne peut rien brider. Leurs
 * champs, cases à cocher et boutons de suppression restaient actifs en
 * lecture seule — l'écriture partait ensuite se faire refuser côté serveur.
 *
 * `editor.isEditable` est une valeur mutable vivant hors de React : la lire
 * directement pendant le rendu ne déclencherait aucune mise à jour si le rôle
 * change. On s'abonne donc aux transactions de l'éditeur.
 */
export function useBlockEditable(editor: Editor): boolean {
  return useSyncExternalStore(
    (onChange) => {
      editor.on("update", onChange);
      editor.on("transaction", onChange);
      return () => {
        editor.off("update", onChange);
        editor.off("transaction", onChange);
      };
    },
    () => editor.isEditable,
    // Côté serveur, on suppose modifiable : le rendu initial ne doit pas
    // afficher un bloc verrouillé qui se débloquerait après hydratation.
    () => true
  );
}
