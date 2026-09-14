"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type AccountFormState } from "@/lib/account-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    changePassword,
    undefined
  );

  return (
    <section>
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Mot de passe
      </h2>

      <form
        action={action}
        className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/50 p-4 shadow-paper"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">Mot de passe actuel</Label>
          <Input
            id="current-password"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state?.errors?.current)}
          />
          {state?.errors?.current?.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="next-password">Nouveau mot de passe</Label>
          <Input
            id="next-password"
            name="next"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state?.errors?.next)}
          />
          {state?.errors?.next?.length ? (
            <ul className="flex flex-col gap-0.5">
              {state.errors.next.map((error) => (
                <li key={error} className="text-xs text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Au moins 10 caractères, une lettre et un chiffre.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Confirmer</Label>
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state?.errors?.confirm)}
          />
          {state?.errors?.confirm?.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Changer ton mot de passe déconnecte tes autres appareils — c&apos;est
          justement le geste qu&apos;on fait quand on soupçonne un accès
          indésirable.
        </p>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="w-fit">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Changer le mot de passe
          </Button>
          {state?.ok && state.message && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3.5" />
              {state.message}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
