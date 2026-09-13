"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus, Settings, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { switchWorkspace } from "@/lib/workspace-actions";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

export type WorkspaceSummary = {
  id: string;
  name: string;
  icon: string | null;
  role: string;
  memberCount: number;
};

/** Monogramme de repli : « Mon Espace » → « M ». */
function monogram(workspace: { name: string; icon: string | null }): string {
  return workspace.icon ?? workspace.name.trim().charAt(0).toUpperCase() ?? "N";
}

/**
 * L'identité de l'espace en tête de sidebar, et le sélecteur multi-espace.
 *
 * La bascule passe par une Server Action : l'espace actif vit dans un cookie
 * validé contre les appartenances réelles à chaque requête, donc le client ne
 * fait que demander — il ne décide pas.
 */
export function WorkspaceSwitcher({
  workspace,
  workspaces,
}: {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}) {
  const { isMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);

  const isOwner = workspace.role === "owner";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="h-12 gap-2.5 px-2 data-open:bg-sidebar-accent"
              aria-label={`Espace ${workspace.name}`}
            />
          }
        >
          {/* Monogramme terracotta : la marque de la DA, dès le coin
              supérieur gauche. */}
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-base leading-none text-sidebar-primary-foreground"
          >
            {monogram(workspace)}
          </span>

          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate font-heading text-sm">
              {workspace.name}
            </span>
            <span
              className="truncate text-xs text-sidebar-foreground/60"
              data-numeric
            >
              {workspace.memberCount} membre
              {workspace.memberCount > 1 ? "s" : ""}
            </span>
          </span>

          <ChevronDown
            aria-hidden
            className="ml-auto size-4 shrink-0 text-sidebar-foreground/50"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={isMobile ? "bottom" : "right"}
          align="start"
          sideOffset={8}
          className="min-w-64"
        >
          {/* Base UI exige qu'un GroupLabel vive dans un Group : le libellé et
              les items qu'il annonce sont donc groupés ensemble. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Espaces
            </DropdownMenuLabel>

            {workspaces.map((item) => {
              const isCurrent = item.id === workspace.id;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className="gap-2.5"
                  // Pas de `<form>` ni de `render={<button/>}` ici : Base UI
                  // refuse un bouton natif dans un item de menu.
                  onClick={
                    isCurrent ? undefined : () => switchWorkspace(item.id)
                  }
                >
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-xs leading-none text-primary-foreground"
                  >
                    {monogram(item)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate">{item.name}</span>
                    <span
                      className="truncate text-[0.65rem] text-muted-foreground"
                      data-numeric
                    >
                      {item.memberCount} membre
                      {item.memberCount > 1 ? "s" : ""}
                    </span>
                  </span>
                  {/* L'espace courant est coché : la coche, pas seulement un fond. */}
                  {isCurrent && (
                    <Check aria-hidden className="ml-auto size-4 text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus />
              Nouvel espace
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              render={<Link href="/parametres/espace#membres" />}
            >
              <Users />
              {isOwner ? "Inviter des membres" : "Membres"}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/parametres/espace" />}>
              <Settings />
              Paramètres de l&apos;espace
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
