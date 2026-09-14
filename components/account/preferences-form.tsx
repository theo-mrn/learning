"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useThemeToggle } from "@/hooks/use-theme";
import { updatePreferences, type AccountFormState } from "@/lib/account-actions";
import type { Preferences } from "@/lib/preferences";

export function PreferencesForm({
  preferences,
}: {
  preferences: Preferences;
}) {
  const { theme, setTheme } = useThemeToggle();
  const [idleSeconds, setIdleSeconds] = useState(preferences.idleSaveSeconds);
  const [compact, setCompact] = useState(preferences.compactMode);
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updatePreferences,
    undefined
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Le thème n'est pas dans le formulaire : il s'applique immédiatement
          et vit en `localStorage`, parce qu'il doit être posé avant le premier
          rendu pour éviter un flash blanc au chargement. */}
      <section>
        <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Apparence
        </h2>

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4 shadow-paper">
          <Label>Thème</Label>
          <div className="flex gap-2">
            {(
              [
                { value: "light", label: "Clair", icon: Sun },
                { value: "dark", label: "Sombre", icon: Moon },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  theme === value
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/40"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Appliqué immédiatement, propre à cet appareil.
          </p>
        </div>
      </section>

      <form action={action} className="flex flex-col gap-10">
        <section>
          <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Édition
          </h2>

          <div className="flex flex-col gap-5 rounded-xl border border-border/70 bg-card/50 p-4 shadow-paper">
            <div className="flex flex-col gap-2">
              <Label htmlFor="idle-save">
                Enregistrement après{" "}
                <span data-numeric className="font-medium tabular-nums">
                  {idleSeconds} s
                </span>{" "}
                d&apos;inactivité
              </Label>
              <input
                id="idle-save"
                name="idleSaveSeconds"
                type="range"
                min={1}
                max={30}
                step={1}
                value={idleSeconds}
                onChange={(e) => setIdleSeconds(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Plus court : tes modifications partent vite, utile quand
                plusieurs personnes travaillent sur la même page. Plus long :
                moins d&apos;écritures. Dans un espace partagé, ce délai est
                automatiquement raccourci.
              </p>
              {state?.errors?.idleSaveSeconds?.map((error) => (
                <p key={error} className="text-xs text-destructive">
                  {error}
                </p>
              ))}
            </div>

            <div className="flex items-start gap-2.5">
              {/* Case **contrôlée**. En non contrôlée (`defaultChecked`), le
                  re-rendu serveur qui suit `revalidatePath` fournit une
                  nouvelle valeur par défaut, et Base UI signale à juste titre
                  qu'on change l'état initial d'un composant déjà monté. */}
              <Checkbox
                id="compact-mode"
                checked={compact}
                onCheckedChange={(value) => setCompact(value === true)}
                className="mt-0.5"
              />
              {/* La valeur voyage par un champ caché plutôt que par le `name`
                  de la case : Base UI ne rend pas un `<input type="checkbox">`
                  natif, donc rien ne garantit qu'une case cochée apparaisse
                  dans le `FormData`. Sans ce champ, l'action lirait « non
                  coché » à chaque envoi et désactiverait le mode en silence. */}
              <input
                type="hidden"
                name="compactMode"
                value={compact ? "on" : "off"}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="compact-mode">Affichage compact</Label>
                <p className="text-xs text-muted-foreground">
                  Réduit les espacements de la barre latérale et de
                  l&apos;éditeur.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="w-fit">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
          {state?.ok && state.message && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3.5" />
              {state.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
