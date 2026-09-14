"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount, type AccountFormState } from "@/lib/account-actions";

/**
 * Suppression définitive du compte.
 *
 * Double confirmation — retaper son email **et** son mot de passe — parce que
 * l'action est irréversible et emporte les espaces dont on est seul membre.
 * Ce qui sera détruit est annoncé avant, pas après.
 */
export function AccountDangerZone({
  email,
  pageCount,
  workspaceCount,
}: {
  email: string;
  pageCount: number;
  workspaceCount: number;
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    deleteAccount,
    undefined
  );

  return (
    <section>
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-destructive uppercase">
        Zone sensible
      </h2>

      <form
        action={action}
        className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      >
        <p className="text-sm font-medium">Supprimer mon compte</p>
        <p className="text-xs text-muted-foreground">
          {pageCount} page{pageCount > 1 ? "s" : ""} et {workspaceCount} espace
          {workspaceCount > 1 ? "s" : ""} sont rattachés à ce compte. Les espaces
          dont tu es le seul membre seront détruits avec leurs pages, images et
          historique. Irréversible.
        </p>

        <div className="mt-1 flex flex-col gap-1.5">
          <Label htmlFor="confirm-email" className="text-xs">
            Retape <span className="font-mono font-medium">{email}</span> pour
            confirmer
          </Label>
          <Input
            id="confirm-email"
            name="confirmation"
            autoComplete="off"
            className="max-w-80"
            aria-invalid={Boolean(state?.errors?.confirmation)}
          />
          {state?.errors?.confirmation?.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-password" className="text-xs">
            Mot de passe
          </Label>
          <Input
            id="delete-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="max-w-80"
            aria-invalid={Boolean(state?.errors?.password)}
          />
          {state?.errors?.password?.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>

        {state?.message && !state.ok && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {state.message}
          </p>
        )}

        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          className="mt-1 w-fit"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Supprimer définitivement
        </Button>
      </form>
    </section>
  );
}
