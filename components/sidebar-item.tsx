"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import type { FlattenedPage } from "@/lib/flatten-tree";
import { archivePage, createPage } from "@/lib/actions";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarItem({
  page,
  itemRef,
  itemStyle,
  dragHandleProps,
  dragHandleIcon,
  isExpanded,
  onToggleExpanded,
  dropIndicator,
}: {
  page: FlattenedPage;
  itemRef?: React.Ref<HTMLLIElement>;
  itemStyle?: React.CSSProperties;
  dragHandleProps?: {
    attributes: React.HTMLAttributes<HTMLButtonElement>;
    listeners: Record<string, unknown> | undefined;
  };
  dragHandleIcon?: React.ReactNode;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  dropIndicator: "before" | "after" | "inside" | null;
}) {
  const params = useParams();
  const isActive = params?.id === page.id;
  const title = page.title || "Sans titre";

  return (
    <SidebarMenuItem
      ref={itemRef}
      style={itemStyle}
      className={`group/sortable relative ${
        dropIndicator === "inside"
          ? "rounded-md ring-2 ring-sidebar-primary ring-offset-1 ring-offset-sidebar"
          : ""
      }`}
    >
      {/* Indicateurs de dépôt : un filet terracotta plein, assez épais pour
          être vu pendant qu'on fait glisser. */}
      {dropIndicator === "before" && (
        <div
          aria-hidden
          className="absolute inset-x-1 -top-px z-20 h-0.5 rounded-full bg-sidebar-primary"
        />
      )}
      {dropIndicator === "after" && (
        <div
          aria-hidden
          className="absolute inset-x-1 -bottom-px z-20 h-0.5 rounded-full bg-sidebar-primary"
        />
      )}

      {/* Poignée de déplacement, à gauche de la ligne : elle n'entre plus en
          concurrence avec les actions de droite, et n'apparaît qu'au survol
          pour ne pas charger l'arborescence au repos. */}
      {dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          aria-label={`Déplacer ${title}`}
          title="Glisser pour déplacer"
          className="absolute top-1/2 -left-1 z-10 flex size-5 -translate-y-1/2 cursor-grab items-center justify-center rounded text-sidebar-foreground/50 opacity-0 transition-opacity duration-150 group-hover/sortable:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:opacity-100 active:cursor-grabbing"
          tabIndex={-1}
        >
          {dragHandleIcon}
        </button>
      )}

      <SidebarMenuButton
        isActive={isActive}
        // Deux actions à droite seulement : le chevron tient à gauche et la
        // poignée ne flotte plus au milieu de la ligne.
        className="pr-14"
        render={
          <Link
            href={`/page/${page.id}`}
            aria-current={isActive ? "page" : undefined}
          />
        }
      >
        {/* Le chevron n'est un bouton que s'il y a des enfants : sinon il ne
            reste qu'une réserve d'espace, non focusable. */}
        {page.hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpanded();
            }}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Replier les sous-pages de ${title}`
                : `Déplier les sous-pages de ${title}`
            }
            className="flex size-4 shrink-0 items-center justify-center rounded text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ChevronRight
              aria-hidden
              className={`size-3 transition-transform duration-200 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          <span aria-hidden className="size-4 shrink-0" />
        )}

        <span aria-hidden className="shrink-0 text-[0.95em] leading-none">
          {page.icon ?? (
            <FileText className="size-4 text-sidebar-foreground/50" />
          )}
        </span>
        <span className="truncate">{title}</span>
      </SidebarMenuButton>

      {/* Ajout rapide d'une sous-page : l'action la plus fréquente reste
          directement accessible. */}
      <form action={createPage.bind(null, page.id)}>
        <SidebarMenuAction
          showOnHover
          type="submit"
          title="Ajouter une sous-page"
          aria-label={`Ajouter une sous-page à ${title}`}
          className="right-7"
        >
          <Plus />
        </SidebarMenuAction>
      </form>

      {/* Le reste passe par un menu overflow : déplacement au clavier et
          suppression, sans empiler trois cibles au survol. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              showOnHover
              title="Plus d'options"
              aria-label={`Options de ${title}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-48">
          <DropdownMenuItem render={<Link href={`/page/${page.id}`} />}>
            <FileText />
            Ouvrir
          </DropdownMenuItem>
          {/* Le même ajout de sous-page qu'au survol, atteignable au
              clavier via le menu. */}
          <DropdownMenuItem onClick={() => createPage(page.id)}>
            <Plus />
            Ajouter une sous-page
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => archivePage(page.id)}
          >
            <Trash2 />
            Mettre à la corbeille
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
