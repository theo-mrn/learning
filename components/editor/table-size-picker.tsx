"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

/** Taille de la grille de survol. Au-delà, on passe par la saisie chiffrée :
 * une grille plus grande devient illisible et imprécise à viser. */
const GRID_ROWS = 8;
const GRID_COLS = 8;

/** Bornes de la saisie manuelle : au-delà, un tableau ne tient plus dans la
 * colonne de lecture et ProseMirror devient lent à chaque frappe. */
const MAX_ROWS = 50;
const MAX_COLS = 20;

/**
 * Choix des dimensions d'un tableau : on survole la grille pour le cas
 * courant (quelques lignes, quelques colonnes), ou on tape les chiffres
 * quand il en faut plus. Les deux modes mènent au même bouton de
 * confirmation, donc rien ne s'insère par un survol accidentel.
 */
export function TableSizePicker({
  onInsert,
}: {
  onInsert: (options: { rows: number; cols: number; withHeaderRow: boolean }) => void;
}) {
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(
    null
  );
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeaderRow, setWithHeaderRow] = useState(true);

  // Le survol prévisualise sans écraser la saisie : on n'insère que ce que
  // l'utilisateur a réellement validé.
  const shownRows = hover?.rows ?? rows;
  const shownCols = hover?.cols ?? cols;

  function clamp(value: number, max: number) {
    if (Number.isNaN(value)) return 1;
    return Math.min(Math.max(value, 1), max);
  }

  return (
    <div className="flex w-64 flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[0.7rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Dimensions
        </p>

        {/* Grille de survol. `onMouseLeave` sur le conteneur remet la
            prévisualisation sur les valeurs saisies. */}
        <div
          className="grid w-fit gap-0.5"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
          onMouseLeave={() => setHover(null)}
          role="group"
          aria-label="Choisir les dimensions du tableau"
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
            const r = Math.floor(index / GRID_COLS) + 1;
            const c = (index % GRID_COLS) + 1;
            const active = r <= shownRows && c <= shownCols;
            return (
              <button
                key={index}
                type="button"
                tabIndex={-1}
                aria-hidden
                onMouseEnter={() => setHover({ rows: r, cols: c })}
                onClick={() => {
                  setRows(r);
                  setCols(c);
                  setHover(null);
                  onInsert({ rows: r, cols: c, withHeaderRow });
                }}
                className={`size-5 rounded-[3px] border transition-colors duration-75 ${
                  active
                    ? "border-primary bg-primary/25"
                    : "border-border bg-muted/40 hover:border-primary/40"
                }`}
              />
            );
          })}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground" data-numeric>
          {shownRows} ligne{shownRows > 1 ? "s" : ""} × {shownCols} colonne
          {shownCols > 1 ? "s" : ""}
        </p>
      </div>

      {/* Saisie chiffrée, pour les tailles hors grille. */}
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Lignes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ROWS}
            value={rows}
            onChange={(e) => setRows(clamp(e.target.valueAsNumber, MAX_ROWS))}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Colonnes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_COLS}
            value={cols}
            onChange={(e) => setCols(clamp(e.target.valueAsNumber, MAX_COLS))}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={withHeaderRow}
          onCheckedChange={(checked) => setWithHeaderRow(checked === true)}
        />
        Ligne d&apos;en-tête
      </label>

      <button
        type="button"
        onClick={() => onInsert({ rows, cols, withHeaderRow })}
        className="h-8 rounded-md bg-primary text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
      >
        Insérer le tableau
      </button>
    </div>
  );
}
