"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * L'identifiant de la page courante, rendu accessible aux NodeViews.
 *
 * Un NodeView Tiptap est monté par ProseMirror, pas par l'arbre React de la
 * page : il ne reçoit aucune prop de `PageEditor`. Or le téléversement est
 * rattaché à une page (`/api/pages/<id>/assets`), donc le bloc image a besoin
 * de cet id. Le contexte est le seul chemin qui traverse la frontière.
 */
const ImagePageContext = createContext<string | null>(null);

export function ImagePageProvider({
  pageId,
  children,
}: {
  pageId: string;
  children: ReactNode;
}) {
  return (
    <ImagePageContext.Provider value={pageId}>
      {children}
    </ImagePageContext.Provider>
  );
}

export function usePageId(): string | null {
  return useContext(ImagePageContext);
}
