"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, readStoredTheme, type Theme } from "@/lib/theme";

/** Store externe minimal : la classe `dark` sur <html> est la source de
 * vérité (posée avant le premier paint par le script du layout racine), et
 * les abonnés sont notifiés sur changement local ou depuis un autre onglet. */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Un autre onglet a changé le thème : on resynchronise le DOM et l'UI.
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyToDocument(readStoredTheme());
    emit();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function applyToDocument(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  // Le sombre est le défaut de l'app, donc c'est ce que le serveur suppose.
  return "dark";
}

/** Thème courant, piloté par l'utilisateur (plus par l'OS). */
export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Thème courant + bascule persistée. */
export function useThemeToggle() {
  const theme = useTheme();

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Mode privé / storage bloqué : la bascule reste valable pour la session.
    }
    applyToDocument(next);
    emit();
  }, []);

  /** Resynchronise le DOM sur la valeur stockée **sans rien persister** : le
   * défaut sombre ne doit pas devenir un choix explicite de l'utilisateur.
   * Sert à réparer la classe que le Strict Mode efface en développement. */
  const syncFromStorage = useCallback(() => {
    applyToDocument(readStoredTheme());
    emit();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, syncFromStorage, toggleTheme };
}
