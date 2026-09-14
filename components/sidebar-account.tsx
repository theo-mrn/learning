"use client";

import Link from "next/link";
import { BadgeCheck, ChevronsUpDown, LogOut, Settings } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { logout } from "@/lib/auth-actions";

export type AccountUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Rôle dans l'espace courant ("owner" | "editor" | "viewer"). */
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecture seule",
};

/** Initiales pour le fallback d'avatar : « Théo Morin » → « TM ». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Le bloc compte en pied de sidebar.
 *
 * Trois entrées, toutes fonctionnelles : « Mon compte », « Préférences » et
 * la déconnexion. Les anciennes entrées désactivées (offre Pro, facturation,
 * notifications) ont été retirées — elles annonçaient des fonctionnalités
 * inexistantes et non prévues.
 */
export function SidebarAccount({ user }: { user: AccountUser }) {
  const { isMobile } = useSidebar();
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            // `data-open` (posé par le trigger) garde la ligne teintée tant
            // que le menu est ouvert : on voit d'où il sort.
            className="h-12 gap-2.5 px-2 data-open:bg-sidebar-accent"
            aria-label={`Compte de ${user.name}`}
          />
        }
      >
        <Avatar className="size-8 rounded-lg after:rounded-lg">
          {user.avatarUrl && (
            <AvatarImage
              src={user.avatarUrl}
              alt=""
              className="rounded-lg"
            />
          )}
          <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-xs font-medium text-sidebar-primary">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>

        <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-sidebar-foreground/60">
            {user.email}
          </span>
        </span>

        <ChevronsUpDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-sidebar-foreground/50"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        // Sur mobile la sidebar est un tiroir : le menu s'ouvre vers le bas
        // plutôt que sur un côté qui sortirait de l'écran.
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={8}
        className="min-w-60"
      >
        {/* En-tête d'identité : un simple bloc, pas un GroupLabel — celui-ci
            exigerait un Group parent dans Base UI, et ce n'est pas le
            libellé d'une liste mais la carte du compte. */}
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <Avatar className="size-9 rounded-lg after:rounded-lg">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt="" className="rounded-lg" />
            )}
            <AvatarFallback className="rounded-lg bg-primary/15 text-xs font-medium text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
          <Badge variant="outline" className="shrink-0">
            {roleLabel}
          </Badge>
        </div>

        <DropdownMenuSeparator />

        {/* Plus d'entrées « bientôt » : une offre Pro, une facturation et des
            notifications annonçaient des fonctionnalités qui n'existent pas et
            ne sont pas prévues. Ne restent que les deux pages réelles. */}
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/parametres/compte" />}>
            <BadgeCheck />
            Mon compte
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/parametres/preferences" />}>
            <Settings />
            Préférences
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {/* Pas de `<button>` ici, et pas de `<form>` : l'item de menu garde
              son élément natif (`role="menuitem"`) et appelle la Server Action
              depuis `onClick`.
              Base UI refuse un `<button>` dans `render` quand `nativeButton`
              vaut false (son défaut sur `Menu.Item`) : il appliquerait ses
              attributs non natifs par-dessus un bouton natif, créant un
              élément à double identité. L'alternative `nativeButton={true}`
              existe, mais un `<button type="submit">` portant un rôle
              `menuitem` reste bancal — autant ne pas en rendre du tout.
              La déconnexion demeure une mutation POST : `logout` est une
              Server Action, jamais un lien qu'un préchargement pourrait
              déclencher tout seul. */}
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Marque une entrée dont la fonctionnalité n'est pas encore branchée : sans
 * ça, un élément grisé se lit comme un bug plutôt que comme « à venir ». */
