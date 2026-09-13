"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchPages, type SearchResult } from "@/lib/search";

export const OPEN_SEARCH_EVENT = "open-search-command";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchPages(trimmed);
        setResults(res);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }

  function handleSelect(pageId: string) {
    handleOpenChange(false);
    router.push(`/page/${pageId}`);
  }

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery ? results : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Rechercher"
      description="Recherche dans toutes tes pages"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Rechercher une page ou du contenu…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[min(24rem,60dvh)]">
        {/* Pendant la frappe, on montre que ça travaille plutôt que de
            laisser croire à une absence de résultat. */}
        {trimmedQuery && isSearching && visibleResults.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Recherche…
          </div>
        )}

        {trimmedQuery && !isSearching && visibleResults.length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <span className="text-sm text-foreground">
                Aucun résultat pour «&nbsp;{trimmedQuery}&nbsp;»
              </span>
              <span className="text-xs text-muted-foreground">
                Essaie un autre mot, ou un extrait du contenu de la page.
              </span>
            </div>
          </CommandEmpty>
        )}

        {!trimmedQuery && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Search aria-hidden className="size-5 text-muted-foreground" />
              <span className="text-sm text-foreground">
                Cherche dans tes pages
              </span>
              <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Le titre et le contenu sont indexés. Navigue avec ↑ ↓ et ouvre
                avec ⏎.
              </span>
            </div>
          </CommandEmpty>
        )}

        {visibleResults.length > 0 && (
          <CommandGroup heading="Pages">
            {visibleResults.map((result) => (
              <CommandItem
                key={result.id}
                value={result.id}
                onSelect={() => handleSelect(result.id)}
                className="gap-2.5"
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm"
                >
                  {result.icon ?? (
                    <FileText className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">
                    {result.title || "Sans titre"}
                  </span>
                  {result.snippet && (
                    <span className="truncate text-xs text-muted-foreground">
                      {result.snippet}
                    </span>
                  )}
                </div>
                {/* Indice d'action sur l'élément sélectionné : on sait ce que
                    fera la touche Entrée. */}
                <CornerDownLeft
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-data-selected/command-item:opacity-100"
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
