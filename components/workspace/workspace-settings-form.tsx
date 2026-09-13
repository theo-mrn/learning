"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  renameWorkspace,
  type WorkspaceFormState,
} from "@/lib/workspace-actions";

export function WorkspaceSettingsForm({
  workspace,
  canEdit,
}: {
  workspace: { id: string; name: string; icon: string | null };
  canEdit: boolean;
}) {
  const [icon, setIcon] = useState<string | null>(workspace.icon);
  const [state, action, pending] = useActionState<WorkspaceFormState, FormData>(
    renameWorkspace.bind(null, workspace.id),
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
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>Emoji</Label>
            <EmojiPicker icon={icon} onSelect={setIcon} />
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="workspace-name">Nom de l&apos;espace</Label>
            <Input
              id="workspace-name"
              name="name"
              defaultValue={workspace.name}
              disabled={!canEdit}
              required
              aria-invalid={Boolean(state?.errors?.name)}
            />
          </div>
        </div>

        <input type="hidden" name="icon" value={icon ?? ""} />

        {state?.errors?.name?.map((error) => (
          <p key={error} className="text-xs text-destructive">
            {error}
          </p>
        ))}

        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending} className="w-fit">
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
            {state?.message && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5" />
                {state.message}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Seul un propriétaire peut renommer cet espace.
          </p>
        )}
      </form>
    </section>
  );
}
