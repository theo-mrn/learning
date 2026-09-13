"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  createWorkspace,
  type WorkspaceFormState,
} from "@/lib/workspace-actions";

/**
 * Le `<Dialog>` reste monté en permanence : le démonter quand il est fermé
 * casse Base UI (leçon du dialogue Kanban) — seul son contenu est conditionné.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const [state, action, pending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspace,
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Nouvel espace</DialogTitle>
            <DialogDescription>
              Un espace regroupe ses propres pages. Tu en seras propriétaire.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-2 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Emoji</Label>
              {/* Le picker complet, comme partout ailleurs dans l'app. */}
              <EmojiPicker icon={icon} onSelect={setIcon} />
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="workspace-name">Nom</Label>
              <Input
                id="workspace-name"
                name="name"
                placeholder="Mes cours de L3"
                required
                autoFocus
                aria-invalid={Boolean(state?.errors?.name)}
              />
            </div>
          </div>

          {/* L'emoji voyage par un champ caché : le picker n'est pas un input. */}
          <input type="hidden" name="icon" value={icon ?? ""} />

          {state?.errors?.name?.map((error) => (
            <p key={error} className="pb-2 text-xs text-destructive">
              {error}
            </p>
          ))}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Créer l&apos;espace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
