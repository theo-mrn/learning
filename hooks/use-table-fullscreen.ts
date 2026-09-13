"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mode plein écran pour un tableau.
 *
 * L'éditeur n'est pas démonté ni déplacé : on pose un attribut sur le
 * document et c'est le CSS qui étale la toile d'écriture sur tout l'écran
 * (voir `globals.css`, section « Tableau en plein écran »). Déplacer le
 * `<table>` dans un portail ferait perdre à ProseMirror sa position dans le
 * document, donc la sélection et l'historique d'annulation.
 *
 * On ne passe pas par l'API Fullscreen du navigateur : elle sortirait aussi
 * l'app de son thème et de ses raccourcis, et elle ne fonctionne pas sans
 * geste utilisateur direct sur certains navigateurs.
 */
const ATTRIBUTE = "data-table-fullscreen";
/** Marque le seul tableau à afficher en plein écran. */
const TARGET_ATTRIBUTE = "data-fullscreen-target";

export function useTableFullscreen() {
  const [active, setActive] = useState(false);
  /** Le tableau à isoler, fourni au moment de la bascule : une page peut en
   * contenir plusieurs, et les afficher tous n'aurait aucun sens. */
  const targetRef = useRef<HTMLElement | null>(null);

  const exit = useCallback(() => setActive(false), []);

  const toggle = useCallback((target?: HTMLElement | null) => {
    targetRef.current = target ?? null;
    setActive((v) => !v);
  }, []);

  useEffect(() => {
    if (!active) {
      document.documentElement.removeAttribute(ATTRIBUTE);
      return;
    }

    document.documentElement.setAttribute(ATTRIBUTE, "true");

    // Un seul tableau est mis en avant : les autres restent masqués par le
    // CSS, qui ne révèle que le porteur de cet attribut.
    const target = targetRef.current;
    target?.setAttribute(TARGET_ATTRIBUTE, "true");

    // Échap sort du mode, mais une seule couche à la fois : si un panneau
    // (Cellule/Tableau) est ouvert, c'est lui qui doit se fermer d'abord.
    // Sans ce test, un seul Échap fermait le panneau *et* le plein écran.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector('[data-slot="popover-content"]')) return;
      event.preventDefault();
      setActive(false);
    }
    // Sans capture : on laisse les surcouches au-dessus (popovers) traiter
    // la touche avant nous.
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.removeAttribute(ATTRIBUTE);
      target?.removeAttribute(TARGET_ATTRIBUTE);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return { active, toggle, exit };
}
