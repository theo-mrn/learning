"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { OPEN_SEARCH_EVENT } from "@/components/search-command";

const emptySubscribe = () => () => {};

export function SearchTriggerButton() {
  // Le raccourci affiché doit correspondre au clavier réel : ⌘K sur macOS,
  // Ctrl K ailleurs. Détecté après montage pour ne pas diverger du HTML
  // rendu côté serveur.
  const isApple = useSyncExternalStore(
    emptySubscribe,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false
  );

  return (
    <SidebarMenuButton
      onClick={() => document.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      aria-keyshortcuts={isApple ? "Meta+K" : "Control+K"}
    >
      <Search />
      <span>Rechercher</span>
      <kbd className="ml-auto rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-sans text-[0.65rem] font-medium text-sidebar-foreground/70">
        {isApple ? "⌘K" : "Ctrl K"}
      </kbd>
    </SidebarMenuButton>
  );
}
