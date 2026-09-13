"use client";

import { useEffect, useState, useTransition } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getPageVersions, restorePageVersion } from "@/lib/actions";

type VersionSummary = {
  id: string;
  title: string;
  createdAt: Date;
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const ABSOLUTE_TIME = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return RELATIVE_TIME.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RELATIVE_TIME.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return RELATIVE_TIME.format(diffDay, "day");
}

export function PageHistorySheet({
  pageId,
  open,
  onOpenChange,
  /** Consulter l'historique est une lecture, restaurer une écriture : un
   * membre en lecture seule voit les versions sans pouvoir y revenir. */
  canEdit = true,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPageVersions(pageId).then((result) => {
      if (!cancelled) setVersions(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  function handleRestore(versionId: string) {
    setRestoringId(versionId);
    startTransition(async () => {
      await restorePageVersion(pageId, versionId);
      onOpenChange(false);
      window.location.reload();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Historique des versions</SheetTitle>
          <SheetDescription>
            Un instantané est conservé automatiquement toutes les quelques
            minutes pendant l&apos;édition.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-4">
          {/* Squelettes plutôt qu'un texte « Chargement… » : la liste garde
              sa forme et rien ne saute quand les données arrivent. */}
          {versions === null &&
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-20 shrink-0" />
              </div>
            ))}

          {versions?.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <History
                aria-hidden
                className="mx-auto size-5 text-muted-foreground"
                strokeWidth={1.5}
              />
              <p className="mt-2.5 text-sm text-foreground">
                Aucune version pour l&apos;instant
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Continue d&apos;écrire : le premier instantané apparaîtra ici.
              </p>
            </div>
          )}

          {versions?.map((version, index) => {
            const createdAt = new Date(version.createdAt);
            const isRestoring = isPending && restoringId === version.id;
            return (
              <div
                key={version.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-card-foreground">
                    {version.title || "Sans titre"}
                    {index === 0 && (
                      <span className="ml-1.5 rounded-full bg-primary/12 px-1.5 py-0.5 align-middle text-[0.65rem] font-medium text-primary">
                        la plus récente
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={createdAt.toISOString()}
                    title={ABSOLUTE_TIME.format(createdAt)}
                    className="text-xs text-muted-foreground"
                  >
                    {formatRelative(createdAt)}
                  </time>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRestore(version.id)}
                    aria-label={`Restaurer la version du ${ABSOLUTE_TIME.format(createdAt)}`}
                    className="shrink-0"
                  >
                    {isRestoring ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RotateCcw />
                    )}
                    Restaurer
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
