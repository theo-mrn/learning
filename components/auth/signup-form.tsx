"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { signup, type AuthFormState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/50 p-5 shadow-paper"
    >
      {state?.message && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={Boolean(state?.errors?.name)}
        />
        {state?.errors?.name?.map((error) => (
          <p key={error} className="text-xs text-destructive">
            {error}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state?.errors?.email)}
        />
        {state?.errors?.email?.map((error) => (
          <p key={error} className="text-xs text-destructive">
            {error}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.errors?.password)}
        />
        {state?.errors?.password?.length ? (
          <ul className="flex flex-col gap-0.5">
            {state.errors.password.map((error) => (
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

      <Button type="submit" disabled={pending} className="mt-1">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Créer mon compte
      </Button>
    </form>
  );
}
