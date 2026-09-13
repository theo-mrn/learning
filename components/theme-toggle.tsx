"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "@/hooks/use-theme";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, syncFromStorage, toggleTheme } = useThemeToggle();
  const isDark = theme === "dark";

  // En développement, le remount du Strict Mode remet <html> aux seuls
  // attributs issus du JSX et efface donc la classe posée par le script
  // inline. On la réapplique avant le paint. Sans effet en production.
  useLayoutEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  return (
    <SidebarMenuButton
      onClick={toggleTheme}
      // aria-pressed plutôt qu'un simple bouton : l'état courant est annoncé
      // au lecteur d'écran, pas seulement suggéré par l'icône.
      aria-pressed={isDark}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
    >
      {isDark ? <Moon /> : <Sun />}
      <span>{isDark ? "Thème sombre" : "Thème clair"}</span>
    </SidebarMenuButton>
  );
}
