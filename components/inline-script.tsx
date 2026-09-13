/**
 * Un `<script>` inline qui s'exécute pendant l'analyse du HTML — donc avant
 * le premier paint, ce qu'aucun effet React ne permet.
 *
 * Le script n'est rendu que côté serveur : une fois dans le HTML, le
 * navigateur l'exécute au parsing, et il n'a plus aucune raison d'exister
 * dans l'arbre React du client. Le rendre aussi au client déclenchait
 * l'avertissement « Encountered a script tag while rendering React
 * component » — et un `<script>` rendu par React n'y serait de toute façon
 * jamais exécuté. `suppressHydrationWarning` absorbe l'écart entre le HTML
 * du serveur et l'arbre client, qui est ici voulu.
 */
export function InlineScript({ html }: { html: string }) {
  if (typeof window !== "undefined") return null;

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
