"use client";

import { useLayoutEffect } from "react";
import { useThemeToggle } from "@/hooks/use-theme";

/**
 * Réapplique la classe `dark` sur `<html>` avant le paint.
 *
 * En développement, le remount du Strict Mode remet `<html>` aux seuls
 * attributs issus du JSX et efface donc la classe posée par le script inline
 * du layout racine. Sans cette réparation, le thème sombre saute au
 * rechargement.
 *
 * Ce correctif vivait dans `ThemeToggle`, dans la barre latérale. En retirant
 * ce sélecteur (il faisait doublon avec la page Préférences), il fallait le
 * déplacer ici plutôt que de le perdre : c'est un garde global, pas une
 * fonctionnalité du bouton.
 *
 * Ne rend rien, et reste sans effet en production.
 */
export function ThemeGuard() {
  const { syncFromStorage } = useThemeToggle();

  useLayoutEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  return null;
}
