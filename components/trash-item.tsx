"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deletePagePermanently, restorePage } from "@/lib/actions";
import type { Page } from "@/app/generated/prisma/client";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function TrashItem({
  page,
  /** Restaurer et supprimer définitivement sont des écritures : en lecture
   * seule, la corbeille se consulte mais ne se manipule pas. */
  canEdit = true,
}: {
  page: Page;
  canEdit?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const title = page.title || "Sans titre";

  function handleRestore() {
    startTransition(async () => {
      await restorePage(page.id);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deletePagePermanently(page.id);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base"
      >
        {page.icon ?? <FileText className="size-4 text-muted-foreground" />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-card-foreground">
          {title}
        </span>
        <time
          dateTime={page.updatedAt.toISOString()}
          className="text-xs text-muted-foreground"
        >
          Archivée le {DATE_FORMAT.format(page.updatedAt)}
        </time>
      </span>

      {/* Deux actions icône seulement : chacune porte un libellé accessible
          et une infobulle, et la cible de clic fait 36px de haut. */}
      {canEdit && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRestore}
                disabled={isPending}
                aria-label={`Restaurer « ${title} »`}
              />
            }
          >
            <RotateCcw />
          </TooltipTrigger>
          <TooltipContent>Restaurer</TooltipContent>
        </Tooltip>
      )}

      {/* Le `<Dialog>` reste monté même sans le déclencheur : le démonter
          conditionnellement casse Base UI (leçon du dialogue Kanban). */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        {canEdit && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isPending}
                  aria-label={`Supprimer définitivement « ${title} »`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              <Trash2 />
            </TooltipTrigger>
            <TooltipContent>Supprimer définitivement</TooltipContent>
          </Tooltip>
        )}

        {/* Un dialog plutôt que confirm() : le style suit la DA, le texte
            dit ce qui est perdu, et l'action par défaut est l'annulation. */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer définitivement ?</DialogTitle>
            <DialogDescription>
              « {title} » et ses sous-pages seront effacées. Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={isPending} />}
            >
              Annuler
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
