"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CloudCheck } from "lucide-react";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

/** Durée pendant laquelle le check reste affiché avant de s'effacer : assez
 * pour être vu, assez court pour ne pas devenir un meuble. */
const SAVED_VISIBLE_MS = 2500;

/**
 * Retour de la sauvegarde automatique, volontairement silencieux.
 *
 * Pendant la frappe, rien ne s'affiche : l'écriture attend vingt secondes
 * d'inactivité, c'est le fonctionnement normal, et annoncer « modifications
 * non enregistrées » pendant tout ce temps inquiéterait sans raison. On ne
 * montre donc que deux choses : le nuage validé quand c'est écrit, et
 * l'échec, qui lui doit rester à l'écran.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (state !== "saved") return;
    const showHandle = setTimeout(() => setShowSaved(true), 0);
    const hideHandle = setTimeout(() => setShowSaved(false), SAVED_VISIBLE_MS);
    return () => {
      clearTimeout(showHandle);
      clearTimeout(hideHandle);
    };
  }, [state]);

  const isVisible = state === "saved" && showSaved;

  // L'échec persiste tant qu'il n'est pas résolu : c'est la seule situation
  // où l'utilisateur doit agir.
  if (state === "error") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 text-xs text-destructive"
      >
        <AlertCircle aria-hidden className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">Échec de l&apos;enregistrement</span>
      </div>
    );
  }

  return (
    /* Le conteneur garde sa hauteur en permanence : l'apparition du check ne
       doit pas décaler le titre à côté. */
    <div
      role="status"
      aria-live="polite"
      className={`flex h-7 shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <CloudCheck aria-hidden className="size-4 shrink-0" />
      <span className="whitespace-nowrap">Enregistré</span>
    </div>
  );
}
