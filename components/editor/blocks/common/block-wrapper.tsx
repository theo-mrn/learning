"use client";

import { useState } from "react";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BlockWrapperProps } from "./types";

export function BlockWrapper({
  children,
  title,
  onTitleChange,
  icon,
  onDelete,
  onDuplicate,
  isFullscreen,
  onToggleFullscreen,
  headerActions,
  className = "",
  selected,
}: BlockWrapperProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title ?? "");

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (onTitleChange && tempTitle.trim() && tempTitle !== title) {
      onTitleChange(tempTitle.trim());
    }
  };

  return (
    <div
      contentEditable={false}
      className={`group/block relative my-6 w-full rounded-2xl border transition-all duration-200 ${
        selected
          ? "border-primary/50 ring-2 ring-primary/20"
          : "border-border/70 hover:border-border"
      } bg-card/50 shadow-paper backdrop-blur-xs ${
        isFullscreen ? "block-fullscreen-active z-50" : ""
      } ${className}`}
    >
      {/* Bandeau de sortie plein écran */}
      {isFullscreen && (
        <div className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur-md">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {icon}
            {title || "Bloc en plein écran"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            className="h-7 text-xs"
          >
            <Minimize2 className="size-3.5" />
            Quitter plein écran
            <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.2 font-sans text-[0.65rem] text-muted-foreground">
              Échap
            </kbd>
          </Button>
        </div>
      )}

      {/* Barre d'en-tête du bloc */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              {icon}
            </span>
          )}

          {onTitleChange ? (
            isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSubmit();
                  if (e.key === "Escape") {
                    setTempTitle(title ?? "");
                    setIsEditingTitle(false);
                  }
                }}
                className="h-6 rounded border border-primary/40 bg-background px-1.5 font-heading text-sm font-medium text-foreground outline-none ring-1 ring-primary/30"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTitle(title ?? "");
                  setIsEditingTitle(true);
                }}
                className="group/title flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left font-heading text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                title="Cliquer pour renommer"
              >
                <span>{title || "Sans titre"}</span>
                <span className="text-[0.65rem] text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100">
                  ✎
                </span>
              </button>
            )
          ) : (
            <span className="font-heading text-sm font-medium text-foreground">
              {title}
            </span>
          )}
        </div>

        {/* Contrôles et actions d'en-tête */}
        <div className="flex items-center gap-1">
          {headerActions}

          {onToggleFullscreen && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onToggleFullscreen}
              className="text-muted-foreground hover:text-foreground"
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          )}

          {(onDelete || onDuplicate) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    title="Options du bloc"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onDuplicate && (
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="size-3.5 mr-2" />
                    Dupliquer
                  </DropdownMenuItem>
                )}
                {onDuplicate && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    Supprimer le bloc
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Contenu principal du bloc */}
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}
