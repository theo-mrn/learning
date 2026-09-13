"use client";

import { useCallback, useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Presentation,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhiteboardCanvas } from "./whiteboard-canvas";
import { useBlockEditable } from "../common/use-block-editable";
import {
  WHITEBOARD_DEFAULT_HEIGHT,
  WHITEBOARD_DEFAULT_TITLE,
  WHITEBOARD_MAX_HEIGHT,
  WHITEBOARD_MIN_HEIGHT,
  type WhiteboardSnapshot,
} from "./whiteboard-types";

const FULLSCREEN_ATTR = "data-block-fullscreen";

export function WhiteboardBlockComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const canEdit = useBlockEditable(editor);
  const title = (node.attrs.title as string) || WHITEBOARD_DEFAULT_TITLE;
  const snapshot = (node.attrs.snapshot as WhiteboardSnapshot) ?? null;
  const height = (node.attrs.height as number) || WHITEBOARD_DEFAULT_HEIGHT;

  const [isFullscreen, setIsFullscreen] = useState(false);

  // L'instantané initial est figé au montage : le re-passer à tldraw à chaque
  // sauvegarde relancerait un chargement et écraserait le dessin en cours.
  const [initialSnapshot] = useState(() => snapshot);

  const handleSnapshotChange = useCallback(
    (next: WhiteboardSnapshot) => {
      updateAttributes({ snapshot: next });
    },
    [updateAttributes]
  );

  /**
   * Plein écran. `NodeViewWrapper` est un composant fonction sans
   * `forwardRef` : impossible de lui passer une ref pour marquer le nœud.
   * On remonte donc depuis un enfant jusqu'au `div.react-renderer` que Tiptap
   * place autour de chaque NodeView — c'est lui l'enfant direct de
   * `.ProseMirror`, donc le seul niveau que la règle CSS de plein écran peut
   * réafficher une fois tout le reste masqué.
   */
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);

  const attachHost = useCallback((el: HTMLDivElement | null) => {
    setHostEl(el?.closest<HTMLElement>(".react-renderer") ?? null);
  }, []);

  useEffect(() => {
    if (!hostEl) return;

    if (!isFullscreen) {
      document.documentElement.removeAttribute(FULLSCREEN_ATTR);
      hostEl.removeAttribute("data-fullscreen-target");
      return;
    }

    document.documentElement.setAttribute(FULLSCREEN_ATTR, "true");
    hostEl.setAttribute("data-fullscreen-target", "true");

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // tldraw se sert d'Échap pour annuler l'outil courant ou désélectionner.
      // On ne sort du plein écran que si le canvas n'a pas le focus, sinon on
      // arracherait l'utilisateur à son dessin au premier Échap.
      const active = document.activeElement;
      if (active && hostEl?.contains(active) && active.closest(".tl-container")) {
        return;
      }
      event.preventDefault();
      setIsFullscreen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.removeAttribute(FULLSCREEN_ATTR);
      hostEl?.removeAttribute("data-fullscreen-target");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [hostEl, isFullscreen]);

  // Redimensionnement : `drag` décrit le geste en cours (null au repos).
  const [drag, setDrag] = useState<{
    startY: number;
    startHeight: number;
    currentHeight: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      setDrag({ startY: event.clientY, startHeight: height, currentHeight: height });
    },
    [height]
  );

  useEffect(() => {
    if (!drag) return;

    function onMove(event: PointerEvent) {
      setDrag((current) =>
        current
          ? {
              ...current,
              currentHeight: Math.min(
                WHITEBOARD_MAX_HEIGHT,
                Math.max(
                  WHITEBOARD_MIN_HEIGHT,
                  current.startHeight + (event.clientY - current.startY)
                )
              ),
            }
          : current
      );
    }

    function onUp() {
      setDrag((current) => {
        if (current) updateAttributes({ height: current.currentHeight });
        return null;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, updateAttributes]);

  const effectiveHeight = drag?.currentHeight ?? height;

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="whiteboard-node-view not-prose my-6 w-full select-none"
    >
      <div
        ref={attachHost}
        className={`relative w-full rounded-2xl border bg-card/50 shadow-paper transition-colors ${
          selected ? "border-primary/50" : "border-border/70"
        } ${isFullscreen ? "flex h-screen flex-col rounded-none border-0" : ""}`}
      >
        {/* En-tête : titre, plein écran, menu. Calqué sur celui du Kanban,
            qui est le seul modèle éprouvé du projet. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <Presentation className="size-3.5" />
            </span>
            <input
              value={title}
              readOnly={!canEdit}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              aria-label="Titre du tableau blanc"
              className="min-w-0 flex-1 truncate rounded bg-transparent px-1 py-0.5 font-heading text-sm font-medium text-foreground outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
            />
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Réduire" : "Plein écran"}
              aria-label={isFullscreen ? "Réduire" : "Plein écran"}
              className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </button>

            {/* Le menu ne propose que la suppression : inutile en lecture
                seule. Le plein écran, lui, reste disponible (c'est une
                consultation). */}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                      title="Options du tableau"
                      aria-label="Options du tableau"
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={deleteNode}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    Supprimer le tableau
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Le canvas exige un parent positionné et de hauteur explicite :
            `.tl-container` est en `height: 100%`. */}
        <div
          className={`relative w-full overflow-hidden ${
            isFullscreen ? "min-h-0 flex-1" : ""
          }`}
          style={isFullscreen ? undefined : { height: effectiveHeight }}
        >
          <WhiteboardCanvas
            snapshot={initialSnapshot}
            onSnapshotChange={handleSnapshotChange}
            canEdit={canEdit}
          />
        </div>

        {/* Redimensionner écrit la hauteur dans le document : la poignée
            disparaît en lecture seule. */}
        {!isFullscreen && canEdit && (
          <div className="flex justify-center pb-1.5 pt-1">
            <div
              onPointerDown={handleResizeStart}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Redimensionner le tableau blanc"
              className="h-1.5 w-16 cursor-ns-resize rounded-full bg-border transition-colors hover:bg-muted-foreground"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
