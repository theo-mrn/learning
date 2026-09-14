"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type AccountFormState } from "@/lib/account-actions";

export function ProfileForm({
  user,
}: {
  user: { name: string | null; email: string };
  createdAt?: string | null;
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateProfile,
    undefined
  );

  return (
    <section>
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Identité
      </h2>

      <form
        action={action}
        className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/50 p-4 shadow-paper"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-name">Nom</Label>
          <Input
            id="account-name"
            name="name"
            defaultValue={user.name ?? ""}
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
          <Label htmlFor="account-email">Email</Label>
          <Input
            id="account-email"
            name="email"
            type="email"
            defaultValue={user.email}
            required
            aria-invalid={Boolean(state?.errors?.email)}
          />
          <p className="text-xs text-muted-foreground">
            C&apos;est aussi ton identifiant de connexion.
          </p>
          {state?.errors?.email?.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>

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
    </section>
  );
}
