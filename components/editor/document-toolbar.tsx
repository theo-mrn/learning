"use client";

import type { Editor } from "@tiptap/react";
import {
  FormatControls,
  useFormatState,
} from "@/components/editor/text-toolbar";

/**
 * Le rail de formatage permanent, posé verticalement à droite du document.
 *
 * Il existe parce que la barre contextuelle exige une sélection : sans lui,
 * aucun format ne serait activable « à l'avance ». Or Tiptap applique une
 * marque armée sans sélection aux caractères tapés ensuite — gras, italique,
 * barré, code, couleur, type de bloc : tous ont ce mode. Ce rail donne donc
 * accès au même rang de contrôles, curseur simplement posé dans le texte.
 *
 * À la verticale, il ne prend aucune hauteur au-dessus du titre et laisse la
 * colonne de lecture intacte ; sous `xl` il n'y a plus la place à côté du
 * texte, il repasse alors en ligne au-dessus du document.
 */
export function DocumentToolbar({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);

  const armedColor = state.textColor ?? state.highlightColor;
  // Formats armés au curseur : on les nomme pour que l'utilisateur sache
  // dans quoi il va écrire, et comment le désactiver.
  const armedMarks = [
    state.bold && "gras",
    state.italic && "italique",
    state.strike && "barré",
    state.code && "code",
  ].filter(Boolean) as string[];

  const hasArmed = armedMarks.length > 0 || Boolean(armedColor);

  return (
    <div
      className="flex items-center gap-2 xl:flex-col xl:items-stretch"
      aria-label="Mise en forme"
    >
      {/* `flex-col` sur le rail : les mêmes contrôles s'empilent, les
          séparateurs passent d'eux-mêmes à l'horizontale via le CSS de
          Divider (voir globals.css). */}
      <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-card/70 p-1 shadow-paper backdrop-blur-sm xl:flex-col">
        <FormatControls editor={editor} state={state} colorAlign="start" />
      </div>

      {/* Pastille de rappel quand un style est armé : sans elle, on écrit en
          gras rouge sans comprendre pourquoi ni comment revenir. Réduite à
          un point coloré sur le rail, le texte tiendrait mal à la verticale. */}
      {hasArmed && (
        <span
          role="status"
          className="flex items-center gap-1.5 text-xs text-muted-foreground xl:justify-center"
          title={
            armedMarks.length > 0
              ? `Écriture en ${armedMarks.join(" + ")}`
              : "La suite s'écrit en couleur"
          }
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full ring-1 ring-border"
            style={{ backgroundColor: armedColor ?? "var(--primary)" }}
          />
          <span className="truncate xl:hidden">
            {armedMarks.length > 0
              ? `Écriture en ${armedMarks.join(" + ")}`
              : "La suite s'écrit en couleur"}
          </span>
        </span>
      )}
    </div>
  );
}
