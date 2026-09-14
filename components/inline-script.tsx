"use client";

import { useServerInsertedHTML } from "next/navigation";

/**
 * Un `<script>` inline injecté directement dans le HTML initial côté serveur
 * (via `useServerInsertedHTML`) pour s'exécuter pendant l'analyse du HTML,
 * avant le premier paint (anti-FOUC pour le thème).
 *
 * En passant par `useServerInsertedHTML`, le script est inséré directement
 * dans le flux HTML du serveur sans faire partie de l'arbre de composants
 * React rendu côté client, ce qui évite l'avertissement React 19 :
 * « Encountered a script tag while rendering React component ».
 */
export function InlineScript({ html }: { html: string }) {
  useServerInsertedHTML(() => (
    <script
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ));

  return null;
}

