import type { TLEditorSnapshot, TLStoreSnapshot } from "tldraw";

/** Instantané tldraw tel qu'on le stocke dans les attributs du nœud Tiptap.
 * `null` = tableau encore vierge (aucun trait posé) : on évite d'écrire un
 * document vide dans la page tant que l'utilisateur n'a rien dessiné. */
export type WhiteboardSnapshot = TLEditorSnapshot | TLStoreSnapshot | null;

export interface WhiteboardAttrs {
  title: string;
  snapshot: WhiteboardSnapshot;
  /** Hauteur du cadre dans le flux du document, en pixels. Le plein écran
   * ignore cette valeur. */
  height: number;
}

export const WHITEBOARD_MIN_HEIGHT = 240;
export const WHITEBOARD_MAX_HEIGHT = 1200;
export const WHITEBOARD_DEFAULT_HEIGHT = 480;
export const WHITEBOARD_DEFAULT_TITLE = "Tableau blanc";
