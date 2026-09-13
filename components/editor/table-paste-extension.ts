import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * Colle un tableau depuis n'importe quelle source.
 *
 * Le HTML `<table>` (Excel, Google Sheets, Notion, une page web) est déjà
 * reconnu par le schéma ProseMirror dès que TableKit est chargé — rien à
 * faire. Ce qui ne passe pas, c'est le **texte brut tabulé** : un copier
 * depuis un terminal, un fichier CSV/TSV, ou un collage « sans mise en
 * forme » d'Excel. On n'obtient alors qu'un paragraphe de texte avec des
 * tabulations, ce qui n'a pas de sens visuellement.
 *
 * Cette extension détecte ces grilles et les convertit en vrai tableau.
 */

/** Deux lignes minimum, sinon une phrase contenant une tabulation ou un
 * point-virgule deviendrait un tableau contre l'intention de l'auteur. */
const MIN_ROWS = 2;

/** Mêmes bornes que le sélecteur de dimensions : au-delà, l'éditeur devient
 * lent et le tableau sort de la colonne de lecture. */
const MAX_ROWS = 200;
const MAX_COLS = 40;

type Grid = string[][];

/**
 * Découpe du texte brut en grille, ou renvoie null si ça n'en est pas une.
 *
 * On accepte la tabulation (Excel, Sheets, terminal) et le point-virgule
 * (export CSV francophone, où la virgule est le séparateur décimal). La
 * virgule seule est volontairement exclue : « Bonjour, je teste » sur
 * plusieurs lignes deviendrait un tableau, ce qui serait plus gênant
 * qu'utile.
 */
export function parseDelimitedText(text: string): Grid | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // Une dernière ligne vide est normale (fin de sélection) : on l'ignore
  // sans que ça invalide la grille.
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length < MIN_ROWS || lines.length > MAX_ROWS) return null;

  for (const delimiter of ["\t", ";"] as const) {
    // Toutes les lignes doivent contenir le séparateur, et toutes annoncer
    // le même nombre de colonnes : c'est ce qui distingue une grille d'un
    // texte qui contient par hasard une tabulation.
    if (!lines.every((line) => line.includes(delimiter))) continue;

    const rows = lines.map((line) => line.split(delimiter));
    const width = rows[0].length;
    if (width < 2 || width > MAX_COLS) continue;
    if (!rows.every((row) => row.length === width)) continue;

    return rows;
  }

  return null;
}

export const TablePaste = Extension.create({
  name: "tablePaste",

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey("tablePaste"),
        props: {
          handlePaste: (_view, event) => {
            // Le presse-papiers contient du HTML : ProseMirror sait déjà en
            // faire un tableau, on ne s'en mêle pas.
            const html = event.clipboardData?.getData("text/html");
            if (html && /<table[\s>]/i.test(html)) return false;

            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;

            const grid = parseDelimitedText(text);
            if (!grid) return false;

            // Déjà dans un tableau : insérer un tableau ici en créerait un
            // imbriqué dans la cellule, ce que personne ne veut. On laisse
            // ProseMirror coller le texte tel quel dans la cellule.
            if (
              editor.isActive("table") ||
              editor.isActive("tableCell") ||
              editor.isActive("tableHeader")
            ) {
              return false;
            }

            // Le tableau est construit puis rempli cellule par cellule :
            // `insertTable` crée la bonne forme, et on écrit dedans en
            // suivant l'ordre du document, ce qui reste valide même quand
            // le schéma ajoute un paragraphe par cellule.
            const [header, ...body] = grid;
            editor
              .chain()
              .focus()
              .insertTable({
                rows: grid.length,
                cols: header.length,
                withHeaderRow: true,
              })
              .run();

            // Remplissage : on se place sur la première cellule puis on
            // avance de cellule en cellule avec la commande de Tiptap,
            // plutôt que de calculer des positions à la main (fragile dès
            // qu'une cellule contient plusieurs nœuds).
            editor.commands.command(({ state, tr, dispatch }) => {
              const cells: number[] = [];
              // Retrouve le tableau qui vient d'être inséré : c'est celui
              // qui contient la sélection.
              const { $from } = state.selection;
              let tableStart: number | null = null;
              for (let depth = $from.depth; depth > 0; depth--) {
                if ($from.node(depth).type.name === "table") {
                  tableStart = $from.before(depth);
                  break;
                }
              }
              if (tableStart === null) return false;

              const tableNode = state.doc.nodeAt(tableStart);
              if (!tableNode) return false;

              state.doc.nodesBetween(
                tableStart,
                tableStart + tableNode.nodeSize,
                (node, pos) => {
                  if (
                    node.type.name === "tableCell" ||
                    node.type.name === "tableHeader"
                  ) {
                    cells.push(pos);
                  }
                }
              );

              const values = [header, ...body].flat();
              if (cells.length !== values.length) return false;

              // De la fin vers le début : insérer du texte décale les
              // positions suivantes, pas les précédentes.
              for (let i = cells.length - 1; i >= 0; i--) {
                const value = values[i].trim();
                if (!value) continue;
                const cellNode = state.doc.nodeAt(cells[i]);
                if (!cellNode) continue;
                // +2 : on entre dans la cellule, puis dans son paragraphe.
                tr.insertText(value, cells[i] + 2);
              }

              if (dispatch) dispatch(tr);
              return true;
            });

            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
