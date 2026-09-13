export const THEME_STORAGE_KEY = "notes-theme";

export type Theme = "light" | "dark";

/** Le sombre est le défaut de l'app : tout ce qui n'est pas explicitement
 * "light" en storage est traité comme sombre, y compris l'absence de valeur.
 * Le script inline du layout racine applique exactement la même règle. */
export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
