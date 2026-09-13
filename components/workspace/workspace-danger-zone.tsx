"use client";

import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace, leaveWorkspace } from "@/lib/workspace-actions";

/**
 * Actions irréversibles. La suppression exige de retaper le nom de l'espace :
 * un simple bouton, même rouge, se clique par accident, et ici le cascade
 * emporte pages, blocs, versions et images.
 */
export function WorkspaceDangerZone({
  workspaceId,
  workspaceName,
  isOwner,
  isOnlyWorkspace,
}: {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  isOnlyWorkspace: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const nameMatches = confirmation.trim() === workspaceName;

  return (
    <section>
      <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-destructive uppercase">
        Zone sensible
      </h2>

      <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        {!isOnlyWorkspace && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Quitter l&apos;espace</p>
              <p className="text-xs text-muted-foreground">
                Tu perds l&apos;accès à ses pages, sans rien supprimer.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => leaveWorkspace(workspaceId)}
            >
              <LogOut className="size-4" />
              Quitter
            </Button>
          </div>
        )}

        {isOwner && (
          <div className="flex flex-col gap-2 border-t border-destructive/20 pt-4">
            <p className="text-sm font-medium">Supprimer l&apos;espace</p>
            <p className="text-xs text-muted-foreground">
              Toutes ses pages, images et versions sont détruites
              définitivement. Irréversible.
            </p>

            {isOnlyWorkspace ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Impossible : c&apos;est ton seul espace. Crées-en un autre
                d&apos;abord.
              </p>
            ) : (
              <>
                <Label htmlFor="confirm-name" className="mt-2 text-xs">
                  Retape{" "}
                  <span className="font-mono font-medium">{workspaceName}</span>{" "}
                  pour confirmer
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="confirm-name"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="max-w-64"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!nameMatches}
                    onClick={() => deleteWorkspace(workspaceId)}
                  >
                    <Trash2 className="size-4" />
                    Supprimer définitivement
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
