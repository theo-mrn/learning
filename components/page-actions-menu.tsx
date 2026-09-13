"use client";

import { useState } from "react";
import { Download, History, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHistorySheet } from "@/components/page-history-sheet";
import { archivePage } from "@/lib/actions";

export function PageActionsMenu({
  pageId,
  /** Un membre en lecture seule garde l'historique et l'export (des
   * lectures), mais pas la mise à la corbeille. */
  canEdit = true,
}: {
  pageId: string;
  canEdit?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Actions de la page"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
            <History />
            Historique des versions
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<a href={`/api/pages/${pageId}/export`} download />}
          >
            <Download />
            Exporter en Markdown
          </DropdownMenuItem>
          {/* L'action destructive est séparée du reste du menu, jamais
              adjacente à une action courante. Absente en lecture seule :
              le serveur la refuserait de toute façon. */}
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => archivePage(pageId)}
              >
                <Trash2 />
                Mettre à la corbeille
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PageHistorySheet
        pageId={pageId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        canEdit={canEdit}
      />
    </>
  );
}
