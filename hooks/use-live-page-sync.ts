"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { fetchPageDocument } from "@/lib/actions";

/**
 * Synchronisation entre membres d'un même espace.
 *
 * Écoute le flux SSE de la page (`/api/pages/[id]/live`), qui annonce la
 * version du contenu dès qu'elle change. À chaque nouvelle version, on va
 * chercher le document et on **fusionne prudemment** :
 *
 * - on ne remplace que les blocs de haut niveau dont le contenu diffère ;
 * - on ne touche **jamais** le bloc qui porte le curseur, même s'il a changé
 *   à distance : écraser ce que quelqu'un est en train d'écrire serait pire
 *   que de ne rien afficher ;
 * - les blocs ajoutés ailleurs (au-dessus, en dessous) apparaissent, et la
 *   position du curseur est reportée pour que la frappe continue au même
 *   endroit à l'écran.
 *
 * Pas de WebSocket : le besoin est unidirectionnel (le serveur prévient, le
 * client va chercher), donc SSE suffit et n'exige aucun service à héberger.
 */
export function useLivePageSync({
  editor,
  pageId,
  /** Version connue du client, tenue à jour par la sauvegarde. */
  versionRef,
  /** Vrai tant qu'une écriture locale n'est pas confirmée : on ne fusionne
   * pas pendant ce temps, sinon on afficherait un état antérieur au nôtre. */
  hasUnsavedRef,
  enabled = true,
}: {
  editor: Editor | null;
  pageId: string;
  versionRef: { current: number };
  hasUnsavedRef: { current: boolean };
  enabled?: boolean;
}) {
  // Les callbacks vivent dans un `EventSource` qui survit aux rendus : ils
  // lisent l'éditeur par ref pour ne jamais travailler sur une instance
  // périmée (leçon du bloc Kanban).
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  });

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`/api/pages/${pageId}/live`);
    let applying = false;

    // Typé `Event` et non `MessageEvent` : c'est la signature qu'attend
    // `addEventListener`, et TypeScript refuse la conversion directe entre
    // les deux (`MessageEvent` porte `data`, `origin`… que `Event` n'a pas).
    async function onVersion(event: Event) {
      const current = editorRef.current;
      if (!current || applying) return;

      let remoteVersion: number;
      try {
        remoteVersion = JSON.parse((event as MessageEvent<string>).data).version;
      } catch {
        return;
      }

      // Notre propre écriture nous revient : rien à faire.
      if (remoteVersion <= versionRef.current) return;
      // Une écriture locale est en attente : la fusionner maintenant
      // afficherait un document qui ignore nos modifications. On attendra la
      // prochaine annonce, après notre sauvegarde.
      if (hasUnsavedRef.current) return;

      applying = true;
      try {
        const { document, version } = await fetchPageDocument(pageId);
        mergeRemoteDocument(current, document);
        versionRef.current = version;
      } catch {
        // Lecture impossible (réseau, droits révoqués) : on ne casse rien,
        // la prochaine annonce réessaiera.
      } finally {
        applying = false;
      }
    }

    source.addEventListener("version", onVersion);

    return () => {
      source.removeEventListener("version", onVersion);
      source.close();
    };
  }, [pageId, enabled, versionRef, hasUnsavedRef]);
}

/**
 * Applique un document distant en préservant le bloc en cours d'édition.
 *
 * ProseMirror travaille en positions absolues : on parcourt les blocs de haut
 * niveau et on ne remplace que ceux qui diffèrent, en sautant celui qui
 * contient la sélection. Une transaction unique, pour que l'historique
 * d'annulation reste cohérent.
 */
/**
 * Deux nœuds désignent-ils le **même** bloc, même si leur contenu diffère ?
 *
 * L'égalité de contenu ne suffit pas : le bloc qu'on est en train d'écrire a
 * justement un contenu différent de sa version distante, et c'est précisément
 * celui qu'il faut reconnaître pour l'épargner.
 *
 * Les blocs complexes (Kanban, todolist, image, tableau blanc) portent des
 * identifiants stables dans leurs attributs — on s'en sert quand ils existent.
 * À défaut, le type suffit : deux paragraphes voisins restent distinguables
 * par leur position dans la liste cible, qui est reconstruite dans l'ordre.
 */
function sameBlockIdentity(
  remote: JSONContent,
  local: ProseMirrorNode
): boolean {
  if (remote.type !== local.type.name) return false;

  const remoteAttrs = (remote.attrs ?? {}) as Record<string, unknown>;
  const localAttrs = local.attrs as Record<string, unknown>;

  // Identifiant explicite : le plus fiable quand il est présent.
  for (const key of ["blockId", "id"]) {
    if (typeof remoteAttrs[key] === "string" && remoteAttrs[key] === localAttrs[key]) {
      return true;
    }
  }

  // Sinon : même type et contenu identique = même bloc, inchangé. Un contenu
  // différent sur un bloc sans identifiant ne peut pas être apparié de façon
  // sûre, donc on laisse la version distante gagner — sauf pour le bloc édité,
  // que l'appelant réinsère explicitement.
  return JSON.stringify(local.toJSON()) === JSON.stringify(remote);
}

function mergeRemoteDocument(editor: Editor, remote: JSONContent) {
  const remoteNodes = (remote.content ?? []) as JSONContent[];
  const { state } = editor;
  const localCount = state.doc.childCount;

  // Index du bloc de haut niveau qui porte le curseur : il est intouchable.
  const selectionIndex = state.selection.$from.depth > 0
    ? state.doc.resolve(state.selection.from).index(0)
    : -1;

  // Comparaison **par contenu**, pas par position.
  //
  // La version précédente appariait les blocs par indice. Ça marchait pour un
  // ajout en fin de document, mais pas pour une suppression : retirer un bloc
  // au milieu décale tous les suivants, donc chaque comparaison échouait et la
  // fin du document était tronquée. Et le garde `selectionIndex <
  // remoteNodes.length` empêchait toute suppression dès que le curseur se
  // trouvait après la zone conservée (ou valait -1) — d'où « quand je
  // supprime, ça ne fonctionne pas ».
  //
  // On reconstruit donc la liste cible : les blocs distants dans leur ordre,
  // en réinsérant à sa place le bloc en cours d'édition s'il a disparu à
  // distance (on ne détruit jamais ce que l'utilisateur est en train
  // d'écrire).
  const editedNode =
    selectionIndex >= 0 && selectionIndex < localCount
      ? state.doc.child(selectionIndex)
      : null;
  const editedJson = editedNode ? JSON.stringify(editedNode.toJSON()) : null;

  const target: JSONContent[] = [];
  let editedPreserved = false;

  for (const remoteNode of remoteNodes) {
    // Le bloc édité localement garde SA version, pas celle du serveur.
    if (editedJson !== null && sameBlockIdentity(remoteNode, editedNode!)) {
      target.push(editedNode!.toJSON() as JSONContent);
      editedPreserved = true;
      continue;
    }
    target.push(remoteNode);
  }

  // Le bloc édité a été supprimé à distance : on le conserve quand même, à sa
  // position d'origine autant que possible.
  if (editedJson !== null && !editedPreserved) {
    const at = Math.min(selectionIndex, target.length);
    target.splice(at, 0, editedNode!.toJSON() as JSONContent);
  }

  // Rien à faire si le document local correspond déjà à la cible.
  const localJson = JSON.stringify(
    state.doc.content.toJSON() ?? []
  );
  const targetJson = JSON.stringify(target);
  if (localJson === targetJson) return;

  const { tr } = state;
  let changed = false;

  try {
    const nodes = target
      .map((node) => {
        try {
          return state.schema.nodeFromJSON(node);
        } catch {
          return null;
        }
      })
      .filter((node): node is NonNullable<typeof node> => node !== null);

    // Remplacement du contenu entier en une transaction : c'est ce qui rend
    // les suppressions au milieu correctes, là où un appariement par indice
    // décalait tout. Le bloc édité étant déjà dans `nodes` avec SA version,
    // la frappe en cours n'est pas écrasée.
    tr.replaceWith(0, state.doc.content.size, nodes);
    changed = true;
  } catch {
    // Document cible illisible : on ne touche à rien plutôt que de corrompre.
    return;
  }

  if (!changed) return;

  // La position du curseur est reportée par le mapping de la transaction, pour
  // que la frappe continue au même endroit.
  try {
    const mapped = tr.mapping.map(state.selection.from);
    tr.setSelection(TextSelection.near(tr.doc.resolve(mapped)));
  } catch {
    // Position devenue invalide : ProseMirror choisira une sélection saine.
  }

  // `addToHistory: false` : l'arrivée du texte d'autrui n'est pas une action
  // de l'utilisateur, elle ne doit pas s'annuler avec Cmd+Z.
  tr.setMeta("addToHistory", false);
  // Marqueur : la sauvegarde locale ignore cette transaction, sinon on
  // renverrait au serveur ce qu'il vient de nous envoyer.
  tr.setMeta("remoteSync", true);
  editor.view.dispatch(tr);
}
