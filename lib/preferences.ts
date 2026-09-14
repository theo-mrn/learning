import { z } from "zod";

/**
 * Préférences d'affichage et d'édition d'un compte.
 *
 * Volontairement dans un module ordinaire, PAS dans `lib/account-actions.ts` :
 * un fichier `"use server"` n'autorise que l'export de fonctions asynchrones.
 * Y exporter ce schéma, ce type et cette constante faisait échouer le build
 * avec « A "use server" file can only export async functions, found object ».
 */
export const PreferencesSchema = z.object({
  /** Délai d'inactivité avant enregistrement, en secondes. */
  idleSaveSeconds: z.coerce.number().int().min(1).max(60),
  /** Version compacte de la barre latérale et de l'éditeur. */
  compactMode: z.coerce.boolean(),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  idleSaveSeconds: 8,
  compactMode: false,
};

/**
 * Lit des préférences stockées en base sans leur faire confiance.
 *
 * Le champ est un `Json` libre : il peut contenir n'importe quoi (ancienne
 * version du format, écriture manuelle). Chaque valeur est donc validée
 * individuellement, avec repli sur le défaut plutôt qu'un rejet global.
 */
export function readPreferences(stored: unknown): Preferences {
  const source = (stored ?? {}) as Partial<Preferences>;
  return {
    idleSaveSeconds:
      typeof source.idleSaveSeconds === "number" &&
      source.idleSaveSeconds >= 1 &&
      source.idleSaveSeconds <= 60
        ? source.idleSaveSeconds
        : DEFAULT_PREFERENCES.idleSaveSeconds,
    compactMode:
      typeof source.compactMode === "boolean"
        ? source.compactMode
        : DEFAULT_PREFERENCES.compactMode,
  };
}
