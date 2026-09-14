"use client";

import { useCallback, useEffect, useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot, type Editor as TldrawEditor } from "tldraw";
import { useTheme } from "@/hooks/use-theme";
import type { WhiteboardSnapshot } from "./whiteboard-types";

export function WhiteboardCanvas({
  snapshot,
  onSnapshotChange,
  /** `false` pour un membre en lecture seule : tldraw passe en mode
   * consultation (barre d'outils masquée, dessin impossible), et non pas
   * seulement les contrôles de notre en-tête. */
  canEdit = true,
}: {
  snapshot: WhiteboardSnapshot;
  onSnapshotChange: (snapshot: WhiteboardSnapshot) => void;
  canEdit?: boolean;
}) {
  const theme = useTheme();
  const editorRef = useRef<TldrawEditor | null>(null);
  // `handleMount` et `persist` sont des callbacks stables : ils lisent le
  // droit d'écriture par une ref pour ne pas se recréer (et remonter tldraw)
  // à chaque changement de rôle.
  const canEditRef = useRef(canEdit);
  useEffect(() => {
    canEditRef.current = canEdit;
    // Le rôle peut changer après le montage (bascule d'espace) : on répercute
    // sur l'instance déjà en place.
    editorRef.current?.updateInstanceState({ isReadonly: !canEdit });
  }, [canEdit]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  /** Des modifications non écrites attendent-elles ? Évite de sérialiser le
   * document à chaque clic qui n'a rien changé (sélection, panoramique…). */
  const dirtyRef = useRef(false);

  /** Dernier instantané que NOUS avons écrit, sérialisé.
   *
   * Sert à distinguer « le document a changé parce que j'ai dessiné » de
   * « quelqu'un d'autre a dessiné ». Sans cette distinction, recharger sur
   * tout changement de prop rechargerait aussi nos propres traits, ce qui
   * ferait clignoter le canvas à chaque fin de geste. */
  const ownSnapshotRef = useRef<string | null>(null);

  /** Instantané au montage, lu par `handleMount` sans le faire dépendre de la
   * prop : sinon chaque écriture recréerait le callback et **remonterait
   * tldraw** — c'est précisément ce que le gel de l'instantané évitait côté
   * bloc. On garde ce bénéfice, et on gère les mises à jour distantes par un
   * effet dédié plus bas. */
  const mountSnapshotRef = useRef(snapshot);

  // Le callback le plus récent, lu au démontage pour ne pas perdre les
  // derniers traits si le bloc disparaît avant l'écriture.
  const latestRef = useRef(onSnapshotChange);
  useEffect(() => {
    latestRef.current = onSnapshotChange;
  }, [onSnapshotChange]);

  /**
   * Écrit l'instantané dans le document.
   *
   * Appelé uniquement quand un geste se termine : pendant le tracé, tldraw
   * écrit dans son store à chaque point, et y réagir par un `getSnapshot`
   * (qui sérialise tout le document) suivi d'un `updateAttributes`
   * (transaction ProseMirror + re-render du NodeView) figeait le trait en
   * cours, qui rattrapait ensuite d'un bloc. L'aperçu doit rester fluide et
   * complet pendant qu'on dessine ; l'enregistrement attend le relâchement.
   */
  const persist = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !dirtyRef.current) return;
    // En lecture seule, rien ne doit remonter : même un simple déplacement de
    // caméra déclencherait une écriture que le serveur refuserait.
    if (!canEditRef.current) {
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = false;
    const next = getSnapshot(editor.store);
    // Mémorisé avant l'écriture : quand cet instantané nous reviendra par la
    // prop, on saura qu'il est de nous et on ne rechargera pas le canvas.
    ownSnapshotRef.current = JSON.stringify(next);
    latestRef.current(next);
  }, []);

  const handleMount = useCallback(
    (editor: TldrawEditor) => {
      editorRef.current = editor;

      // `isReadonly` est le mode consultation de tldraw : il masque la barre
      // d'outils et interdit toute modification de forme. Sans lui, seuls les
      // contrôles de NOTRE en-tête étaient bridés — le canvas restait
      // entièrement dessinable.
      editor.updateInstanceState({ isReadonly: !canEditRef.current });

      // Charger l'existant avant d'écouter, sinon le chargement lui-même
      // serait vu comme une modification de l'utilisateur.
      if (mountSnapshotRef.current) {
        try {
          loadSnapshot(editor.store, mountSnapshotRef.current);
        } catch {
          // Instantané illisible (schéma d'une version antérieure) : on
          // repart d'un tableau vierge plutôt que de casser la page.
        }
      }

      // tldraw se monte avant que le conteneur ait sa hauteur définitive
      // (style inline appliqué au rendu suivant) : il mesure alors une boîte
      // quasi nulle et en déduit un zoom aberrant. On remet la caméra à
      // l'échelle une fois la taille connue.
      requestAnimationFrame(() => {
        const host = hostRef.current;
        if (host) editor.updateViewportScreenBounds(host);
        if (editor.getCurrentPageShapeIds().size > 0) {
          editor.zoomToFit();
        } else {
          editor.resetZoom();
        }
      });

      // On ne fait que *noter* qu'il y a du changement. Aucune sérialisation
      // ici : c'est ce qui doit rester gratuit pendant le tracé.
      const unlistenStore = editor.store.listen(
        () => {
          dirtyRef.current = true;
        },
        { source: "user", scope: "document" }
      );

      // Fin de geste : on écoute le flux d'événements de tldraw lui-même,
      // pas le DOM. Pendant un tracé, tldraw capture le pointeur, et le
      // `pointerup` DOM peut ne jamais remonter jusqu'à notre conteneur —
      // vérifié : ni sur l'hôte, ni sur `document`, ni sur `window`.
      // `pointer_up` et `complete` sont en revanche toujours émis ici.
      const onEditorEvent = (info: { name?: string }) => {
        if (info?.name !== "pointer_up" && info?.name !== "complete") return;
        // Laisser tldraw terminer sa transaction avant de lire le store.
        requestAnimationFrame(persist);
      };

      editor.on("event", onEditorEvent);

      unlistenRef.current = () => {
        unlistenStore();
        editor.off("event", onEditorEvent);
      };
    },
    // Volontairement sans `snapshot` : ce callback doit rester stable, sinon
    // tldraw est remonté à chaque écriture.
    [persist]
  );

  /**
   * Dessin d'un autre membre : on charge l'instantané distant dans le store
   * tldraw déjà en place.
   *
   * Trois garde-fous, parce qu'un rechargement mal placé efface un tracé en
   * cours :
   *
   * - rien si l'instantané est identique à celui qu'on a écrit soi-même ;
   * - rien si un geste local n'est pas encore persisté (`dirtyRef`) — le
   *   dessin de l'utilisateur passe avant celui des autres ;
   * - `loadSnapshot` dans un `try`, un instantané d'un schéma plus récent ne
   *   doit pas casser le bloc.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !snapshot) return;

    const incoming = JSON.stringify(snapshot);
    if (incoming === ownSnapshotRef.current) return;
    if (dirtyRef.current) return;

    try {
      loadSnapshot(editor.store, snapshot);
      // Désormais notre référence : évite de recharger en boucle si la prop
      // est recréée à l'identique.
      ownSnapshotRef.current = incoming;
    } catch {
      // Instantané illisible : on garde le dessin courant plutôt que de vider
      // le canvas.
    }
  }, [snapshot]);

  // Toute variation de taille du conteneur doit être répercutée à tldraw,
  // sinon le canvas garde un cadrage calculé sur d'anciennes dimensions.
  // Un observateur couvre les trois cas d'un coup : mise en page initiale,
  // bascule plein écran, poignée de redimensionnement.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(() => {
      const editor = editorRef.current;
      if (!editor) return;
      // Surtout pas de `center: true` : cette option fait *recalculer le
      // zoom* pour préserver le cadrage. Or le conteneur change de taille
      // plusieurs fois au montage (hauteur nulle, puis hauteur du style
      // inline), donc le zoom dérivait à chaque passage — jusqu'à 218 %, ce
      // qui désynchronisait le tracé du curseur.
      editor.updateViewportScreenBounds(host);
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Démontage : écrire ce qui ne l'a pas encore été.
  useEffect(() => {
    return () => {
      persist();
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [persist]);

  return (
    <div
      ref={hostRef}
      // Le geste appartient au canvas, jamais à l'éditeur de page. Sans ces
      // barrages, ProseMirror voyait le `mousedown` et démarrait une
      // sélection : le pointeur passait en curseur de texte et le bloc se
      // parait d'un liseré de sélection pendant qu'on dessinait.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // tldraw lit son thème depuis cette classe sur un ancêtre, ce qui nous
      // laisse suivre le thème de l'app plutôt que celui du système.
      className={`tldraw__editor size-full ${
        theme === "dark" ? "tl-theme__dark" : "tl-theme__light"
      }`}
    >
      <Tldraw
        onMount={handleMount}
        forceMobile={false}
        // Pas de `persistenceKey` : la source de vérité est le document
        // Notion-like, pas l'IndexedDB du navigateur. Deux tableaux dans la
        // même page partageraient sinon le même dessin.
        options={{ maxPages: 1 }}
      />
    </div>
  );
}
